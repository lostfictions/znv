import * as z from "zod";

import { getSchemaWithPreprocessor } from "./preprocessors";

import type { DeepReadonlyObject } from "./util";

export type SimpleSchema<TOut = any, TIn = any> = z.ZodType<
  TOut,
  z.ZodTypeDef,
  TIn
>;

export type DetailedSpec<
  TSchema extends SimpleSchema = SimpleSchema<unknown, unknown>
> = TSchema extends SimpleSchema<any, infer TIn>
  ? {
      /**
       * The Zod schema that will be used to parse the passed environment value
       * (or any provided default).
       */
      schema: TSchema;

      /**
       * A description of this env var that's provided as help text if the
       * passed value fails validation, or is required but missing.
       */
      description?: string;

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

      /**
       * Default provided when the key is not defined in the environment,
       * regardless of whether `NODE_ENV` is "production" or not.
       */
      // ("default" would have been a more concise and consistent name here, but
      // because `ZodDefault` exists and has a `default` field, using the name
      // `default` causes TS to give a confusing error on invalid values where
      // it additionally tries to infer our `DetailedSchema` as a `SimpleSchema`
      // of `ZodDefault` with missing fields.)
      defaultValue?: TIn;
    }
  : never;

export type Schemas = Record<string, DetailedSpec>;

type DetailedSpecKeys = keyof DetailedSpec;

// There's some trickiness with the function parameter where in some
// circumstances excess parameters are allowed. We'd also like to restrict
// options, such that only either
// { defaultValue? } or { devDefault?, prodDefault? } is passed in -- that is,
// `defaultValue` can't be used alongside `prodDefault` or `devDefault`, though
// all are optional. Normally in TypeScript we'd do this by typing the parameter
// as an object of common properties intersected with a union of
// mutually-exclusive options, but because of the complex inference we're doing,
// this doesn't seem to work. The below strategy isn't totally ideal and doesn't
// scale well, but hopefully it's good enough for now.
export type RestrictSchemas<T extends Schemas> = {
  [K in keyof T]: DetailedSpec<T[K]["schema"]> &
    Omit<
      Record<keyof T[K], never>,
      // if this object doesn't define a `defaultValue`...
      undefined extends T[K]["defaultValue"]
        ? // ...all keys are allowed...
          DetailedSpecKeys
        : // ...otherwise all keys except `prodDefault` and `devDefault` are allowed.
          Exclude<DetailedSpecKeys, "prodDefault" | "devDefault">
    >;
};

export type ParsedSchema<T extends Schemas> = T extends any
  ? {
      [K in keyof T]: T[K]["schema"] extends SimpleSchema<infer TOut>
        ? TOut
        : never;
    }
  : never;

export interface ParseOptions {
  /**
   * If `true`, `devDefault` values are only used for keys not defined in the
   * environment if and only if `NODE_ENV === "development"`. If `false`,
   * `devDefault` values will be used for keys not defined in the environment if
   * `NODE_ENV` is undefined, or is any value other than `production`. (Default:
   * `false`)
   */
  strictDev?: boolean;
}

export interface NodeEnvInfo {
  readonly isProd: boolean;
  readonly isDev: boolean;
}

export function resolveNodeEnv(
  nodeEnv: string | undefined,
  strictDev = false
): NodeEnvInfo {
  if (nodeEnv === "production") return { isProd: true, isDev: false };
  if (nodeEnv === "development") return { isProd: false, isDev: true };
  if (strictDev) return { isProd: false, isDev: false };
  return { isProd: false, isDev: true };
}

/**
 * Since there might be a provided default value of `null` or `undefined`, we
 * return a tuple that also indicates whether we found a default.
 */
export function resolveDefaultValueForSpec(
  isProd: boolean,
  isDev: boolean,
  spec: DetailedSpec
): [hasDefault: boolean, defaultValue: unknown] {
  if ("defaultValue" in spec) return [true, spec.defaultValue];
  if (isProd && "prodDefault" in spec) return [true, spec.prodDefault];
  if (isDev && "devDefault" in spec) return [true, spec.devDefault];
  return [false, undefined];
}

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Doesn't assume the
 * existence of `process.env` and doesn't parse any `.env` file.
 */
export function parseCore<T extends Schemas>(
  env: Record<string, string | undefined>,
  schemas: T & RestrictSchemas<T>,
  { strictDev = false }: ParseOptions = {}
): [DeepReadonlyObject<ParsedSchema<T>>, NodeEnvInfo] {
  const parsed: ParsedSchema<T> = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  const resolvedNodeEnv = resolveNodeEnv(env["NODE_ENV"], strictDev);

  const { isProd, isDev } = resolvedNodeEnv;

  for (const entry of Object.entries(schemas)) {
    const [key, schemaOrSpec] = entry as [
      keyof ParsedSchema<T>,
      DetailedSpec<SimpleSchema>
    ];

    const envValue = env[key as string];

    if (schemaOrSpec instanceof z.ZodType) {
      try {
        parsed[key] = getSchemaWithPreprocessor(schemaOrSpec).parse(envValue);
      } catch (e) {
        errors.push([key as string, envValue, e]);
      }
    } else if (envValue == null) {
      try {
        const [hasDefault, defaultValue] = resolveDefaultValueForSpec(
          isProd,
          isDev,
          schemaOrSpec
        );

        if (hasDefault) {
          parsed[key] = schemaOrSpec.schema.parse(defaultValue);
        } else {
          // if there's no default, pass our envValue through the
          // schema-with-preprocessor (it's an edge case, but our schema might
          // accept `null`, and the preprocessor will convert `undefined` to
          // `null` for us).
          parsed[key] = getSchemaWithPreprocessor(schemaOrSpec.schema).parse(
            envValue
          );
        }
      } catch (e) {
        errors.push([key as string, envValue, e]);
      }
    } else {
      parsed[key] = getSchemaWithPreprocessor(schemaOrSpec.schema).parse(
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

  return [parsed as DeepReadonlyObject<ParsedSchema<T>>, resolvedNodeEnv];
}
