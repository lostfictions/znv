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
} from "./util/processing.js";
import type * as zCore from "zod/v4/core";

/**
 * Given a Zod schema, returns a function that tries to convert a string (or
 * undefined!) to a valid input type for the schema.
 */
export function getPreprocessorByZodType(
  _schema: zCore.$ZodType,
): (arg: string | undefined) => unknown {
  const schema = _schema as zCore.$ZodTypes;
  const {
    _zod: { def },
  } = schema;

  switch (def.type) {
    case "pipe":
      return getPreprocessorByZodType(def.in);
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
      return getPreprocessorByZodType(def.innerType);

    case "optional": {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType);
      return (arg) => {
        if (arg === undefined) return arg;
        return pp(arg);
      };
    }

    case "nullable": {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType);
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
          return getPreprocessorByZodType(z.number());
        case "string":
          return getPreprocessorByZodType(z.string());
        case "boolean":
          return getPreprocessorByZodType(z.boolean());
        default:
          return (arg) => arg;
      }

    case "null":
      return nullProcessor;

    case "union":
      throw new Error(
        `Zod type not yet supported: "${def.type}" (PRs welcome)`,
      );

    case "any":
    case "unknown":
      throw new Error(
        [
          `Zod type not supported: ${def.type}`,
          "You can use `z.string()` or `z.string().optional()` instead of the above type.",
          "(Environment variables are already constrained to `string | undefined`.)",
        ].join("\n"),
      );

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
    case "function":
    case "readonly":
      throw new Error(
        `Zod type not yet supported: "${def.type}" (PRs welcome)`,
      );
    default: {
      assertNever(def);
    }
  }
}

/**
 * Given a Zod schema, return the schema wrapped in a preprocessor that tries to
 * convert a string to the schema's input type.
 */
export function getSchemaWithPreprocessor(schema: zCore.$ZodType) {
  return z.preprocess(getPreprocessorByZodType(schema), schema);
}
