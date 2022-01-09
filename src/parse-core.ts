import * as z from "zod";

import { getPreprocessedValidator } from "./preprocessors";

import type { DeepReadonlyObject } from "./util";

export interface ParseOptions {
  reporter?: unknown;
}

export type Schema<TOut> = SimpleSchema<TOut> | DetailedSchema<TOut>;

/**
 * For simple schemas we don't care about the Zod input type -- we just want the
 * output type for inferring the return type.
 */
export type SimpleSchema<TOut> = z.ZodType<TOut, z.ZodTypeDef, any>;

/**
 * For detailed schemas, we'd like to be able to constain the types of `default`
 * and `devDefault` to the Zod input type. Unfortunately I can't figure out how
 * to actually make the inference work correctly on this one yet -- maybe for a
 * later version.
 */
export type DetailedSchema<TOut, TIn = unknown> = {
  schema: z.ZodType<TOut, z.ZodTypeDef, TIn>;
  default?: TIn;
  devDefault?: TIn;
  description?: string;
};

export type Schemas<T> = { [K in keyof T]: Schema<T[K]> };

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Doesn't assume the
 * existence of `process.env` and doesn't parse any `.env` file.
 */
export function parseCore<T>(
  env: Record<string, string | undefined>,
  schemas: Schemas<T>,
  { reporter }: ParseOptions = {}
): DeepReadonlyObject<T> {
  const parsed: T = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  for (const entry of Object.entries(schemas)) {
    const [k, v] = entry as [keyof T, Schema<unknown>];

    let envValue = env[k as string];
    if (envValue == null) {
      // TODO: handle default/devDefault
    }

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

  return parsed as DeepReadonlyObject<T>;
}
