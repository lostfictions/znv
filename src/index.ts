export { z } from "zod";
export * from "./parse-env.js";
export * from "./preprocessors.js";
export * from "./extra-schemas.js";

import { parseEnvImpl, type ParseEnv } from "./parse-env.js";
import { cyan, green, red, yellow } from "./util/tty-colors.js";

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
