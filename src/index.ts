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
import { cyan, green, red, yellow } from "./util/tty-colors.js";

// This entrypoint provides a colorized reporter by default; this requires tty
// detection, which in turn relies on Node's built-in `tty` module.

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment.
 */
export const parseEnv: ParseEnv = (
  env,
  schemas,
  reporterOrTokenFormatters = {
    formatVarName: yellow,
    formatObjKey: green,
    formatReceivedValue: cyan,
    formatDefaultValue: cyan,
    formatHeader: red,
  },
) => parseEnvImpl(env, schemas, reporterOrTokenFormatters);
