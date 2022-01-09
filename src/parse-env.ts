import { parseCore, ParseOptions, Schemas } from "./parse-core";

import type { DeepReadonlyObject } from "./util";

export interface ParseEnvOptions extends ParseOptions {
  /**
   * Should the environment be augmented by reading in a `.env` file?
   */
  dotenv?: boolean;
}

/**
 * Parses `process.env` using the provided map of Zod schemas (optionally
 * augmenting it by reading a `.env` file) and returns the immutably-typed,
 * parsed environment.
 */
export function parseEnv<T, U extends T>(
  schemas: Schemas<T, U>,
  { dotenv = true, ...parseOptions }: ParseEnvOptions = {}
): DeepReadonlyObject<T> {
  if (dotenv) {
    require("dotenv").config();
  }

  return parseCore(process.env, schemas, parseOptions);
}
