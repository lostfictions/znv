import * as z from "zod";

import { getSchemaWithPreprocessor } from "./preprocessors.js";
import {
  makeDefaultReporter,
  errorMap,
  type TokenFormatters,
  type ErrorWithContext,
  type Reporter,
} from "./reporter.js";

import type { DeepReadonlyObject } from "./util/type-helpers.js";

export type SimpleSchema<TOut = any, TIn = any> = z.ZodType<
  TOut,
  z.ZodTypeDef,
  TIn
>;

export type DetailedSpec<
  TSchema extends SimpleSchema = SimpleSchema<unknown, unknown>,
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
       * An object that maps `NODE_ENV` values to default values to pass to the
       * schema for this var when the var isn't defined in the environment. For
       * example, you could specify `{ production: "my.cool.website",
       * development: "localhost:9021" }` to use a local hostname in
       * development.
       *
       * A special key for this object is `_`, which means "the default when
       * `NODE_ENV` isn't defined or doesn't match any other provided default."
       *
       * You can also use `.default()` in a Zod schema to provide a default.
       * (For example, `z.number().gte(20).default(50)`.)
       */
      defaults?: Record<string, TIn | undefined>;
    }
  : never;

export type Schemas = Record<string, SimpleSchema | DetailedSpec>;

type DetailedSpecKeys = keyof DetailedSpec;

// There's some trickiness with the function parameter where in some
// circumstances excess parameters are allowed, and this strange-looking type
// fixes it.
export type RestrictSchemas<T extends Schemas> = {
  [K in keyof T]: T[K] extends SimpleSchema
    ? SimpleSchema
    : T[K] extends DetailedSpec
      ? DetailedSpec<T[K]["schema"]> &
          Omit<Record<keyof T[K], never>, DetailedSpecKeys>
      : never;
};

export type ParsedSchema<T extends Schemas> = T extends any
  ? {
      [K in keyof T]: T[K] extends SimpleSchema<infer TOut>
        ? TOut
        : T[K] extends DetailedSpec
          ? T[K]["schema"] extends SimpleSchema<infer TOut>
            ? TOut
            : never
          : never;
    }
  : never;

/**
 * Since there might be a provided default value of `null` or `undefined`, we
 * return a tuple that also indicates whether we found a default.
 */
export function resolveDefaultValueForSpec<TIn = unknown>(
  defaults: Record<string, TIn> | undefined,
  nodeEnv: string | undefined,
): [hasDefault: boolean, defaultValue: TIn | undefined] {
  if (defaults) {
    if (
      nodeEnv != null &&
      Object.prototype.hasOwnProperty.call(defaults, nodeEnv)
    ) {
      return [true, defaults[nodeEnv]];
    }
    if ("_" in defaults) return [true, defaults["_"]];
  }
  return [false, undefined];
}

/**
 * Mostly an internal convenience function for testing. Returns the input
 * parameter unchanged, but with the same inference used in `parseEnv` applied.
 */
export const inferSchemas = <T extends Schemas>(
  schemas: T & RestrictSchemas<T>,
): T & RestrictSchemas<T> => schemas;

export type ParseEnv = <T extends Schemas>(
  env: Record<string, string | undefined>,
  schemas: T & RestrictSchemas<T>,
  reporterOrTokenFormatters?: Reporter | TokenFormatters,
) => DeepReadonlyObject<ParsedSchema<T>>;

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment.
 */
export function parseEnvImpl<T extends Schemas>(
  env: Record<string, string | undefined>,
  schemas: T,
  reporterOrTokenFormatters: Reporter | TokenFormatters,
): DeepReadonlyObject<ParsedSchema<T>> {
  const reporter =
    typeof reporterOrTokenFormatters === "function"
      ? reporterOrTokenFormatters
      : makeDefaultReporter(reporterOrTokenFormatters);

  const parsed: Record<string, unknown> = {} as any;

  const errors: ErrorWithContext[] = [];

  for (const [key, schemaOrSpec] of Object.entries(schemas)) {
    const envValue = env[key];

    let defaultUsed = false;
    let defaultValue: unknown;
    try {
      if (schemaOrSpec instanceof z.ZodType) {
        if (envValue == null && schemaOrSpec instanceof z.ZodDefault) {
          defaultUsed = true;
          defaultValue = schemaOrSpec._def.defaultValue();
          // we "unwrap" the default value ourselves and pass it to the schema.
          // in the very unlikely case that the value isn't stable AND
          // validation fails, this ensures the default value we report is the
          // one that was actually used.
          // (consider `z.number().gte(0.5).default(() => Math.random())` -- if
          //  we invoked the default getter and got 0.7, and then ran the parser
          //  against a missing env var and it generated another default of 0.4,
          //  we'd report a default value that _should_ have passed.)
          parsed[key] = schemaOrSpec.parse(defaultValue, { errorMap });
        } else {
          parsed[key] = getSchemaWithPreprocessor(schemaOrSpec).parse(
            envValue,
            { errorMap },
          );
        }
      } else if (envValue == null) {
        [defaultUsed, defaultValue] = resolveDefaultValueForSpec(
          schemaOrSpec.defaults,
          env["NODE_ENV"],
        );

        if (defaultUsed) {
          parsed[key] = schemaOrSpec.schema.parse(defaultValue, { errorMap });
        } else {
          // if there's no default, pass our envValue through the
          // schema-with-preprocessor (it's an edge case, but our schema might
          // accept `null`, and the preprocessor will convert `undefined` to
          // `null` for us).
          parsed[key] = getSchemaWithPreprocessor(schemaOrSpec.schema).parse(
            envValue,
            { errorMap },
          );
        }
      } else {
        parsed[key] = getSchemaWithPreprocessor(schemaOrSpec.schema).parse(
          envValue,
          { errorMap },
        );
      }
    } catch (e) {
      errors.push({
        key,
        receivedValue: envValue,
        error: e,
        defaultUsed,
        defaultValue,
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(reporter(errors, schemas));
  }

  return parsed as DeepReadonlyObject<ParsedSchema<T>>;
}
