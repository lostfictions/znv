import * as z from "zod";

import { getPreprocessedValidator } from "./preprocessors";

import type { DeepReadonlyObject } from "./util";

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
  description?: string;
} & (
  | {
      /**
       * Default provided when the key is not defined in the environment and
       * NODE_ENV === "production".
       */
      prodDefault?: TIn;

      /**
       * Default provided when the key is not defined in the environment and
       * NODE_ENV !== "production".
       */
      devDefault?: TIn;
    }
  | {
      /**
       * Default provided when the key is not defined in the environment,
       * regardless of whether NODE_ENV is "production" or not.
       */
      // ("default" would have been a more concise and consistent name here, but
      // because `ZodDefault` exists and has a `default` field, using the name
      // `default` causes TS to give a confusing error on invalid values where
      // it additionally tries to infer our `DetailedSchema` as a `SimpleSchema`
      // of `ZodDefault` with missing fields.)
      defaultValue: TIn;

      // disjoint unions by default optionally allow all members anyway, so
      // `never` is needed here to ensure these options are mutually exclusive.
      prodDefault: never;
      devDefault: never;
    }
);

// FIXME: `U extends T` breaks `.transform` postprocessing. an alternative is `U
// extends { [K in keyof T]: any }, but that instead breaks checking `default`
// and `devDefault`.
export type Schemas<T, U extends T> = {
  [K in keyof T]: SimpleSchema<T[K]> | DetailedSchema<T[K], U[K]>;
};

export type AnySchema = SimpleSchema<any> | DetailedSchema<any>;

export interface ParseOptions {
  reporter?: unknown;
  /**
   * If true, `devDefault` values are only used for keys not defined in the
   * environment if and only if `NODE_ENV` is `development`. If false,
   * `devDefault` values will be used for keys not defined in the environment if
   * `NODE_ENV` is any value other than `production`. (Default: false)
   */
  strictDev?: boolean;
}

/**
 * Parses the passed environment object using the provided map of Zod schemas
 * and returns the immutably-typed, parsed environment. Doesn't assume the
 * existence of `process.env` and doesn't parse any `.env` file.
 */
export function parseCore<T, U extends T>(
  env: Record<string, string | undefined>,
  schemas: Schemas<T, U>,
  { reporter, strictDev = false }: ParseOptions = {}
): DeepReadonlyObject<T> {
  const parsed: T = {} as any;

  const errors: [key: string, receivedValue: any, error: any][] = [];

  for (const entry of Object.entries(schemas)) {
    const [k, v] = entry as [keyof T, AnySchema];

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
