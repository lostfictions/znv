import { $ZodTypes, $ZodType, $ZodDefault } from "zod/v4/core";
import { getSchemaWithPreprocessor } from "./preprocessors.js";
import { ErrorWithContext, Reporter, TokenFormatters } from "../reporter.js";
import { resolveDefaultValueForSpec } from "../shared/utils.js";
import type * as z from "zod/v4";
import type { DeepReadonlyObject } from "../util/type-helpers.js";

export type SimpleSchema<Out = any, In = any> = $ZodType<Out, In>;

export type DetailedSpec<TSchema extends SimpleSchema = SimpleSchema> =
  TSchema extends SimpleSchema<any, infer TIn>
    ? {
        /**
         * The Zod schema that will be used to parse the passed environment value
         * (or any provided default).
         */
        schema: TSchema;

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

export type ParseEnv = <T extends Schemas & RestrictSchemas<T>>(
  env: Record<string, string | undefined>,
  schemas: T,
  reporterOrTokenFormatters?: Reporter | TokenFormatters,
) => DeepReadonlyObject<ParsedSchema<T>>;

const handleDeprecatedFields = (schema: z.ZodType) => {
  const meta = schema.meta();
  if (meta?.deprecated) {
    // TODO: Output deprecation hint
  }
};

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment.
 *
 * This version of `parseEnv` is intended for internal use and requires a
 * reporter or token formatters to be passed in. The versions exported in
 * `index.js` and `compat.js` provide defaults for this third parameter, making
 * it optional.
 */
export function parseEnvImpl<T extends Schemas & RestrictSchemas<T>>(
  env: Record<string, string | undefined>,
  schemas: T,
): DeepReadonlyObject<ParsedSchema<T>> {
  const parsed: Record<string, unknown> = {} as DeepReadonlyObject<
    ParsedSchema<T>
  >;

  const errors: ErrorWithContext[] = [];

  for (const [key, schemaOrSpec] of Object.entries(schemas)) {
    const envValue = env[key];

    let defaultUsed = false;
    let defaultValue: unknown;
    try {
      if (schemaOrSpec instanceof $ZodType) {
        if (envValue == null && schemaOrSpec instanceof $ZodDefault) {
          defaultUsed = true;
          const spec = schemaOrSpec._zod;
          defaultValue = spec.def.defaultValue;
          // we "unwrap" the default value ourselves and pass it to the schema.
          // in the very unlikely case that the value isn't stable AND
          // validation fails, this ensures the default value we report is the
          // one that was actually used.
          // (consider `z.number().gte(0.5).default(() => Math.random())` -- if
          //  we invoked the default getter and got 0.7, and then ran the parser
          //  against a missing env var and it generated another default of 0.4,
          //  we'd report a default value that _should_ have passed.)
          parsed[key] = (spec.def.innerType as z.ZodType).parse(defaultValue);
        } else {
          handleDeprecatedFields(schemaOrSpec as z.ZodType);
          parsed[key] = getSchemaWithPreprocessor(
            schemaOrSpec as $ZodTypes,
          ).parse(envValue, {});
        }
      } else if (envValue == null) {
        handleDeprecatedFields(schemaOrSpec.schema as z.ZodType);
        [defaultUsed, defaultValue] = resolveDefaultValueForSpec(
          schemaOrSpec.defaults,
          env["NODE_ENV"],
        );

        if (defaultUsed) {
          parsed[key] = (schemaOrSpec.schema as z.ZodType).parse(defaultValue);
        } else {
          // if there's no default, pass our envValue through the
          // schema-with-preprocessor (it's an edge case, but our schema might
          // accept `null`, and the preprocessor will convert `undefined` to
          // `null` for us).
          parsed[key] = getSchemaWithPreprocessor(
            schemaOrSpec.schema as $ZodTypes,
          ).parse(envValue, {});
        }
      } else {
        parsed[key] = getSchemaWithPreprocessor(
          schemaOrSpec.schema as $ZodTypes,
        ).parse(envValue, {});
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
    // TODO: Implement reporting...
    throw new Error(`Got errors`);
  }

  return parsed as DeepReadonlyObject<ParsedSchema<T>>;
}
