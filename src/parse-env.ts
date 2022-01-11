import {
  NodeEnvInfo,
  parseCore,
  ParsedSchema,
  ParseOptions,
  RestrictSchemas,
  Schemas,
} from "./parse-core";

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
export function parseEnv<T extends Schemas>(
  schemas: T & RestrictSchemas<T>,
  { dotenv = true, ...parseOptions }: ParseEnvOptions = {}
): [DeepReadonlyObject<ParsedSchema<T>>, NodeEnvInfo] {
  if (dotenv) {
    require("dotenv").config();
  }

  // the typechecker seems to sort of give up here, and so did i
  return parseCore(process.env, schemas as any, parseOptions as any) as [
    DeepReadonlyObject<ParsedSchema<T>>,
    NodeEnvInfo
  ];
}
