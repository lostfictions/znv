import * as z from "zod";

import { getPreprocessedValidator } from "./preprocessors";

export interface ParseOptions {
  reporter?: unknown;
}

export type Spec<TOut, TIn = any> = z.ZodType<TOut, z.ZodTypeDef, TIn>;
export type DetailedSpec<TOut, TIn = any> = {
  spec: Spec<TOut, TIn>;
  default?: TIn;
  devDefault?: TIn;
  description?: string;
};

export type Specs<T> = { [K in keyof T]: Spec<T[K]> | DetailedSpec<T[K]> };

export function parse<T>(
  env: Record<string, string | unknown>,
  specs: Specs<T>,
  { reporter }: ParseOptions = {}
): T {
  const parsed: T = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  for (const entry of Object.entries(specs)) {
    const [k, v] = entry as [keyof T, z.ZodFirstPartySchemaTypes];

    const envValue = env[k as string];

    try {
      parsed[k] = getPreprocessedValidator(v).parse(envValue);
    } catch (e) {
      errors.push([k as string, envValue, e]);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Errors found!\n${errors
        .map(([k, v, e]) => `\t[${k}]:\n\t\t${e}\n\t\t(received ${v})`)
        .join("\n\n")}`
    );
  }

  return parsed;
}
