import * as z from "zod";
import { assertNever } from "./util/type-helpers.js";
import {
  bigInt,
  boolean,
  date,
  identity,
  json,
  nullProcessor,
  number,
  throwIfUnknown,
  throwIfCurrentlyUnsupported,
  throwIfWillNeverBeSupported,
} from "./shared/processing.js";
import type * as zCore from "zod/v4/core";

/**
 * Given a Zod schema, returns a function that tries to convert a string (or
 * undefined!) to a valid input type for the schema.
 */
export function getPreprocessorByZodType(
  schema: zCore.$ZodTypes,
): (arg: string | undefined) => unknown {
  const { def } = schema._zod;

  switch (def.type) {
    case "pipe":
      return getPreprocessorByZodType(def.in as zCore.$ZodTypes);
    case "string":
    case "enum":
    case "undefined":
      return identity;

    case "number":
      return number;

    case "bigint":
      return bigInt;

    case "boolean":
      return boolean;

    case "array":
    case "object":
    case "tuple":
    case "record":
    case "intersection":
      return json;

    case "default":
      return getPreprocessorByZodType(def.innerType as zCore.$ZodTypes);

    case "optional": {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType as zCore.$ZodTypes);
      return (arg) => {
        if (arg === undefined) return arg;
        return pp(arg);
      };
    }

    case "nullable": {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType as zCore.$ZodTypes);
      return (arg) => {
        // coerce undefined to null.
        if (arg == null) return null;
        return pp(arg);
      };
    }

    case "date":
      return date;

    case "literal":
      switch (typeof def.values?.[0]) {
        case "number":
          return getPreprocessorByZodType({
            _zod: { def: { type: "number" } },
          } as zCore.$ZodTypes);
        case "string":
          return getPreprocessorByZodType({
            _zod: { def: { type: "string" } },
          } as zCore.$ZodTypes);
        case "boolean":
          return getPreprocessorByZodType({
            _zod: { def: { type: "boolean" } },
          } as zCore.$ZodTypes);
        default:
          return (arg) => arg;
      }

    case "null":
      return nullProcessor;

    case "union":
      return throwIfCurrentlyUnsupported(def.type);

    case "any":
    case "unknown":
      return throwIfUnknown(def.type);

    // some of these types could maybe be supported (if only via the identity
    // function), but don't necessarily represent something meaningful as a
    // top-level schema passed to znv.
    case "success":
    case "catch":
    case "nan":
    case "template_literal":
    case "custom":
    case "nonoptional":
    case "prefault":
    case "transform":
    case "file":
    case "void":
    case "never":
    case "lazy":
    case "promise":
    case "map":
    case "set":
    case "symbol":
    case "readonly":
      return throwIfWillNeverBeSupported(def.type);
    default: {
      assertNever(def);
    }
  }
}

/**
 * Given a Zod schema, return the schema wrapped in a preprocessor that tries to
 * convert a string to the schema's input type.
 */
export function getSchemaWithPreprocessor(schema: zCore.$ZodTypes) {
  return z.preprocess(
    getPreprocessorByZodType(schema) as (arg: unknown) => unknown,
    schema,
  );
}
