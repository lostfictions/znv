import {
  parseEnvImpl as parseEnvImplV4,
  ParsedSchema as ParsedSchemaV4,
  RestrictSchemas as RestrictSchemasV4,
  Schemas as SchemasV4,
} from "./v4/parse-env.js";
import {
  parseEnv as parseEnvImplV3,
  ParsedSchema as ParsedSchemaV3,
  RestrictSchemas as RestrictSchemasV3,
  Schemas as SchemasV3,
} from "./index.js";
import type { DeepReadonlyObject } from "./util/type-helpers.js";

const isZodV4Schema = (
  schema: Record<string, any>,
): schema is SchemasV4 & RestrictSchemasV4<SchemasV4> => {
  const firstKey = Object.keys(schema)[0]!;
  const thisSchema = schema[firstKey].schema ?? schema[firstKey];
  return "_zod" in thisSchema && typeof thisSchema._zod === "object";
};

export function parseEnv<
  V3SchemaT extends SchemasV3 & RestrictSchemasV3<V3SchemaT>,
>(
  env: Record<string, string | undefined>,
  schemas: V3SchemaT,
): DeepReadonlyObject<ParsedSchemaV3<V3SchemaT>>;
export function parseEnv<
  V4SchemaT extends SchemasV4 & RestrictSchemasV4<V4SchemaT>,
>(
  env: Record<string, string | undefined>,
  schemas: V4SchemaT,
): DeepReadonlyObject<ParsedSchemaV4<V4SchemaT>>;
export function parseEnv(
  env: Record<string, string | undefined>,
  schemas: Record<string, unknown>,
) {
  if (isZodV4Schema(schemas)) {
    return parseEnvImplV4(env, schemas);
  }
  // we assume zod3 otherwise
  return parseEnvImplV3(
    env,
    schemas as SchemasV3 & RestrictSchemasV3<SchemasV3>,
  );
}
