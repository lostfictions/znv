import * as z from "zod";
import { yellow, red, cyan } from "colorette";

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
  nodeEnv: string | undefined
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
  schemas: T & RestrictSchemas<T>
): T & RestrictSchemas<T> => schemas;

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment..
 */
export function parseEnv<T extends Schemas>(
  env: Record<string, string | undefined>,
  schemas: T & RestrictSchemas<T>
): DeepReadonlyObject<ParsedSchema<T>> {
  const parsed: Record<string, unknown> = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  for (const [key, schemaOrSpec] of Object.entries(schemas)) {
    const envValue = env[key];

    try {
      if (schemaOrSpec instanceof z.ZodType) {
        parsed[key] = getSchemaWithPreprocessor(schemaOrSpec).parse(envValue);
      } else if (envValue == null) {
        const [hasDefault, defaultValue] = resolveDefaultValueForSpec(
          schemaOrSpec.defaults,
          env["NODE_ENV"]
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
      } else {
        parsed[key] = getSchemaWithPreprocessor(schemaOrSpec.schema).parse(
          envValue
        );
      }
    } catch (e) {
      errors.push([key, envValue, e]);
    }
  }

  if (errors.length > 0) {
    throw new Error(reportErrors(errors, schemas));
  }

  return parsed as DeepReadonlyObject<ParsedSchema<T>>;
}

const indent = (msg: string) =>
  msg
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

function reportErrors(
  errors: [key: string, receivedValue: any, error: any][],
  schemas: Schemas
): string {
  const errorMap = errors.map(
    ([k, v, e]) =>
      `  [${yellow(k)}]:\n${indent(
        e instanceof Error ? e.message : JSON.stringify(e)
      )}\n    (received ${
        typeof v === "undefined" ? cyan("undefined") : `\`${cyan(v)}\``
      })${
        schemas[k]?.description
          ? `\n\n  Description of [${yellow(k)}]: ${schemas[k]!.description}`
          : ""
      }`
  );

  return `${red("Errors found!")}\n${errorMap.join("\n\n")}\n`;
}
