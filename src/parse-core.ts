import * as z from "zod";

import { getPreprocessedValidator } from "./preprocessors";

import type { DeepReadonlyObject } from "./util";

/**
 * For simple schemas we don't care about the Zod input type -- we just want the
 * output type for inferring the return type.
 */
export type SimpleSchema<TOut> = z.ZodType<TOut, z.ZodTypeDef, any>;

/**
 * For detailed schemas, we'd like to be able to constain the types of `default`
 * and `devDefault` to the Zod input type, it's generic on both types.
 */
export type DetailedSchema<TOut, TIn> = {
  schema: z.ZodType<TOut, z.ZodTypeDef, TIn>;
  description?: string;
} & (
  | {
      /**
       * Default provided when the key is not defined in the environment and
       * NODE_ENV === "production".
       */
      prodDefault?: TIn;

      /**
       * Default provided when the key is not defined in the environment and
       * NODE_ENV !== "production".
       */
      devDefault?: TIn;
    }
  | {
      /**
       * Default provided when the key is not defined in the environment,
       * regardless of whether NODE_ENV is "production" or not.
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

// FIXME: `TInputs extends TOutputs` breaks `.transform` postprocessing. an
// alternative is `TInputs extends { [K in keyof TOutputs]: any }`, but that
// instead breaks checking `default` and `devDefault`.
export type Schemas<TOutputs, TInputs extends TOutputs> = {
  [K in keyof TOutputs]:
    | SimpleSchema<TOutputs[K]>
    | DetailedSchema<TOutputs[K], TInputs[K]>;
};

export type AnySchema = SimpleSchema<any> | DetailedSchema<any, any>;

export interface ParseOptions {
  reporter?: unknown;

  /**
   * If true, `devDefault` values are only used for keys not defined in the
   * environment if and only if `NODE_ENV` is `development`. If false,
   * `devDefault` values will be used for keys not defined in the environment if
   * `NODE_ENV` is any value other than `production`. (Default: false)
   */
  strictDev?: boolean;
}

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Doesn't assume the
 * existence of `process.env` and doesn't parse any `.env` file.
 */
export function parseCore<TOutputs, TInputs extends TOutputs>(
  env: Record<string, string | undefined>,
  schemas: Schemas<TOutputs, TInputs>,
  { reporter, strictDev = false }: ParseOptions = {}
): DeepReadonlyObject<TOutputs> {
  const parsed: TOutputs = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  const isProd = env["NODE_ENV"] === "production";

  for (const entry of Object.entries(schemas)) {
    const [k, v] = entry as [keyof TOutputs, AnySchema];

    let envValue = env[k as string];
    if (envValue == null && !(v instanceof z.ZodAny)) {
      if (isProd) {
        if ("prodDefault" in v) {
          envValue = v.prodDefault as any;
        }
      } else {
        //
      }
    }

    try {
      parsed[k] = getPreprocessedValidator(v).parse(envValue);
    } catch (e) {
      errors.push([k as string, envValue, e]);
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
