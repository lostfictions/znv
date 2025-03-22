export { z } from "zod";
export * from "./parse-env.js";
export * from "./preprocessors.js";
export * from "./extra-schemas.js";

export type {
  DeepReadonly,
  DeepReadonlyArray,
  DeepReadonlyObject,
} from "./util/type-helpers.js";

import { parseEnvImpl, type ParseEnv } from "./parse-env.js";

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Compatible with
 * serverless and browser environments.
 */
export const parseEnv: ParseEnv = (
  env,
  schemas,
  reporterOrTokenFormatters = {},
) => parseEnvImpl(env, schemas, reporterOrTokenFormatters);
