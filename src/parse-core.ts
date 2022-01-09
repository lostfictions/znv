import * as z from "zod";

import { getPreprocessedValidator } from "./preprocessors";

import type { DeepReadonlyObject } from "./util";

/**
 * For simple schemas we don't care about the Zod input type -- we just want the
 * output type for inferring the return type.
 */
export type SimpleSchema<TOut> = z.ZodType<TOut, z.ZodTypeDef, any>;

/**
 * For detailed specs, we'd like to be able to constain the types of `default`
 * and `devDefault` to the Zod input type, it's generic on both types.
 */
export type DetailedSpec<TOut, TIn> = {
  schema: z.ZodType<TOut, z.ZodTypeDef, TIn>;
  description?: string;
} & (
  | {
      /**
       * Default provided when the key is not defined in the environment and
       * `NODE_ENV === "production"`.
       */
      prodDefault?: TIn;

      /**
       * Default provided when the key is not defined in the environment and
       * `NODE_ENV !== "production"`. (Alternately, usage of `devDefault` can be
       * constrained to when `NODE_ENV === "development"` by passing the
       * `strictDev` option to the parse function.)
       */
      devDefault?: TIn;
    }
  | {
      /**
       * Default provided when the key is not defined in the environment,
       * regardless of whether `NODE_ENV` is "production" or not.
       */
      // ("default" would have been a more concise and consistent name here, but
      // because `ZodDefault` exists and has a `default` field, using the name
      // `default` causes TS to give a confusing error on invalid values where
      // it additionally tries to infer our `DetailedSchema` as a `SimpleSchema`
      // of `ZodDefault` with missing fields.)
      defaultValue: TIn;

      // disjoint unions by default optionally allow all members anyway, so
      // `never` is needed here to ensure these options are mutually exclusive.
      prodDefault: never;
      devDefault: never;
    }
);

// FIXME: declaring `TInputs extends TOutputs` breaks `.transform`
// postprocessing. so instead we declare
// `TInputs extends { [K in keyof TOutputs]: unknown }`, but that doesn't allow
// checking `default` and `devDefault`.
export type Schemas<
  TOutputs,
  TInputs extends { [K in keyof TOutputs]: unknown }
> = {
  [K in keyof TOutputs]:
    | SimpleSchema<TOutputs[K]>
    | DetailedSpec<TOutputs[K], TInputs[K]>;
};

export type AnySchemaOrSpec = SimpleSchema<any> | DetailedSpec<any, any>;

export interface ParseOptions {
  reporter?: unknown;

  /**
   * If `true`, `devDefault` values are only used for keys not defined in the
   * environment if and only if `NODE_ENV === "development"`. If `false`,
   * `devDefault` values will be used for keys not defined in the environment if
   * `NODE_ENV` is undefined, or is any value other than `production`. (Default:
   * `false`)
   */
  strictDev?: boolean;
}

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Doesn't assume the
 * existence of `process.env` and doesn't parse any `.env` file.
 */
export function parseCore<
  TOutputs,
  TInputs extends { [K in keyof TOutputs]: unknown }
>(
  env: Record<string, string | undefined>,
  schemas: Schemas<TOutputs, TInputs>,
  { reporter, strictDev = false }: ParseOptions = {}
): DeepReadonlyObject<TOutputs> {
  const parsed: TOutputs = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  // TODO: extract environment parsing to helper that also ingests strictDev
  const isProd = env["NODE_ENV"] === "production";

  for (const entry of Object.entries(schemas)) {
    const [key, schemaOrSpec] = entry as [keyof TOutputs, AnySchemaOrSpec];

    const envValue = env[key as string];

    if (schemaOrSpec instanceof z.ZodType) {
      try {
        parsed[key] = getPreprocessedValidator(schemaOrSpec).parse(envValue);
      } catch (e) {
        errors.push([key as string, envValue, e]);
      }
    } else if (envValue == null) {
      try {
        // FIXME: don't fall back to envValue at the end of the chain -- if
        // there's no appropriate default to choose, pass it through the
        // preprocessor instead of directly through the schema (since the schema
        // might be a nullable, for example, which would expect the preprocessor
        // to convert undefined to null)
        const valueToParse =
          "defaultValue" in schemaOrSpec
            ? schemaOrSpec.defaultValue
            : isProd && "prodDefault" in schemaOrSpec
            ? schemaOrSpec.prodDefault
            : "devDefault" in schemaOrSpec
            ? schemaOrSpec.devDefault
            : envValue;

        parsed[key] = schemaOrSpec.schema.parse(valueToParse);
      } catch (e) {
        errors.push([key as string, envValue, e]);
      }
    } else {
      parsed[key] = getPreprocessedValidator(schemaOrSpec.schema).parse(
        envValue
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Errors found!\n${errors
        .map(([k, v, e]) => `\t[${k}]:\n\t\t${e}\n\t\t(received ${v})`)
        .join("\n\n")}`
    );
  }

  return parsed as DeepReadonlyObject<TOutputs>;
}
