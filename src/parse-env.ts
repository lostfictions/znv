import { parse, ParseOptions, Specs } from "./parse";

export interface ParseEnvOptions extends ParseOptions {
  dotenv?: boolean;
}

export function parseEnv<T>(
  specs: Specs<T>,
  { dotenv = true, ...parseOptions }: ParseEnvOptions = {}
): T {
  if (dotenv) {
    require("dotenv").config();
  }

  return parse(process.env, specs, parseOptions);
}
