import * as z from "zod/v3";

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

const { ZodFirstPartyTypeKind: TypeName } = z;

/**
 * Given a Zod schema, returns a function that tries to convert a string (or
 * undefined!) to a valid input type for the schema.
 */
export function getPreprocessorByZodType(
  schema: z.ZodFirstPartySchemaTypes,
): (arg: string | undefined) => unknown {
  const def = schema._def;
  const { typeName } = def;

  switch (typeName) {
    case TypeName.ZodString:
    case TypeName.ZodEnum:
    case TypeName.ZodUndefined:
      return identity;

    case TypeName.ZodNumber:
      return number;

    case TypeName.ZodBigInt:
      return bigInt;

    case TypeName.ZodBoolean:
      return boolean;

    case TypeName.ZodArray:
    case TypeName.ZodObject:
    case TypeName.ZodTuple:
    case TypeName.ZodRecord:
    case TypeName.ZodIntersection:
      return json;

    case TypeName.ZodEffects:
      return getPreprocessorByZodType(def.schema);

    case TypeName.ZodDefault:
      // eslint-disable-next-line unicorn/consistent-destructuring -- false positive
      return getPreprocessorByZodType(def.innerType);

    case TypeName.ZodOptional: {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType);
      return (arg) => {
        if (arg === undefined) return arg;
        return pp(arg);
      };
    }

    case TypeName.ZodNullable: {
      const { innerType } = def;
      const pp = getPreprocessorByZodType(innerType);
      return (arg) => {
        // coerce undefined to null.
        if (arg == null) return null;
        return pp(arg);
      };
    }

    case TypeName.ZodDate:
      return date;

    case TypeName.ZodLiteral:
      switch (typeof def.value) {
        case "number":
          return getPreprocessorByZodType({
            _def: { typeName: TypeName.ZodNumber },
          } as z.ZodFirstPartySchemaTypes);
        case "string":
          return getPreprocessorByZodType({
            _def: { typeName: TypeName.ZodString },
          } as z.ZodFirstPartySchemaTypes);
        case "boolean":
          return getPreprocessorByZodType({
            _def: { typeName: TypeName.ZodBoolean },
          } as z.ZodFirstPartySchemaTypes);
        default:
          return (arg) => arg;
      }

    case TypeName.ZodNull:
      return nullProcessor;

    case TypeName.ZodDiscriminatedUnion:
    case TypeName.ZodUnion:
    case TypeName.ZodNativeEnum:
      return throwIfCurrentlyUnsupported(typeName);

    case TypeName.ZodAny:
    case TypeName.ZodUnknown:
      return throwIfUnknown(typeName);

    // some of these types could maybe be supported (if only via the identity
    // function), but don't necessarily represent something meaningful as a
    // top-level schema passed to znv.
    case TypeName.ZodVoid:
    case TypeName.ZodNever:
    case TypeName.ZodLazy:
    case TypeName.ZodFunction:
    case TypeName.ZodPromise:
    case TypeName.ZodMap:
    case TypeName.ZodSet:
    case TypeName.ZodNaN:
    case TypeName.ZodCatch:
    case TypeName.ZodBranded:
    case TypeName.ZodPipeline:
    case TypeName.ZodSymbol:
    case TypeName.ZodReadonly:
      return throwIfWillNeverBeSupported(typeName);

    default: {
      assertNever(typeName);
    }
  }
}

/**
 * Given a Zod schema, return the schema wrapped in a preprocessor that tries to
 * convert a string to the schema's input type.
 */
export function getSchemaWithPreprocessor(schema: z.ZodTypeAny) {
  return z.preprocess(
    getPreprocessorByZodType(schema) as (arg: unknown) => unknown,
    schema,
  );
}
