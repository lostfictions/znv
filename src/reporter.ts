import { ZodError, ZodErrorMap, ZodIssueCode } from "zod";
import type { Schemas } from "./parse-env.js";

// Even though we also have our own formatter, we pass a custom error map to
// Zod's `.parse()` for two reasons:
// - to ensure that no other consumer of zod in the codebase has set a default
//   error map that might override our formatting
// - to return slightly friendlier error messages in some common scenarios.
export const errorMap: ZodErrorMap = (issue, ctx) => {
  if (
    issue.code === ZodIssueCode.invalid_type &&
    issue.received === "undefined"
  ) {
    return { message: "This field is required." };
  }
  return { message: ctx.defaultError };
};

export interface ErrorWithContext {
  /** The env var name. */
  key: string;
  /** The actual value present in `process.env[key]`, or undefined. */
  receivedValue: unknown;
  /** `ZodError` if Zod parsing failed, or `Error` if a preprocessor threw. */
  error: unknown;
  /** If a default was provided, whether the default value was used. */
  defaultUsed: boolean;
  /** If a default was provided, the given default value. */
  defaultValue: unknown;
}

export interface TokenFormatters {
  /** Formatter for the env var name. */
  formatVarName?: (key: string) => string;

  /** For parsed objects with errors, formatter for object keys. */
  formatObjKey?: (key: string) => string;

  /** Formatter for the actual value we received for the env var. */
  formatReceivedValue?: (val: unknown) => string;

  /** Formatter for the default value provided for the schema. */
  formatDefaultValue?: (val: unknown) => string;

  /** Formatter for the error summary header. */
  formatHeader?: (header: string) => string;
}

const indent = (str: string, amt: number) => `${" ".repeat(amt)}${str}`;

export type Reporter = (errors: ErrorWithContext[], schemas: Schemas) => string;

export function makeDefaultReporter(formatters: TokenFormatters) {
  const reporter: Reporter = (errors, schemas) =>
    reportErrors(errors, schemas, formatters);

  return reporter;
}

export function reportErrors(
  errors: ErrorWithContext[],
  schemas: Schemas,
  {
    formatVarName = String,
    formatObjKey = String,
    formatReceivedValue = String,
    formatDefaultValue = String,
    formatHeader = String,
  }: TokenFormatters = {},
): string {
  const formattedErrors = errors.map(
    ({ key, receivedValue, error, defaultUsed, defaultValue }) => {
      let title = `[${formatVarName(key)}]:`;

      const desc = schemas[key]?.description;
      if (desc) {
        title += ` ${desc}`;
      }

      const message: string[] = [title];

      if (error instanceof ZodError) {
        const { formErrors, fieldErrors } = error.flatten();
        for (const fe of formErrors) message.push(indent(fe, 2));
        const fieldErrorEntries = Object.entries(fieldErrors);
        if (fieldErrorEntries.length > 0) {
          message.push(indent("Errors on object keys:", 2));
          for (const [objKey, keyErrors] of fieldErrorEntries) {
            message.push(indent(`[${formatObjKey(objKey)}]:`, 4));
            if (keyErrors) {
              for (const fe of keyErrors) message.push(indent(fe, 6));
            }
          }
        }
      } else if (error instanceof Error) {
        message.push(...error.message.split("\n").map((l) => indent(l, 2)));
      } else {
        message.push(
          ...JSON.stringify(error, undefined, 2)
            .split("\n")
            .map((l) => indent(l, 2)),
        );
      }

      message.push(
        indent(
          `(received ${formatReceivedValue(
            receivedValue === undefined
              ? "undefined"
              : JSON.stringify(receivedValue),
          )})`,
          2,
        ),
      );

      if (defaultUsed) {
        message.push(
          indent(
            `(used default of ${formatDefaultValue(
              defaultValue === undefined
                ? "undefined"
                : JSON.stringify(defaultValue),
            )})`,
            2,
          ),
        );
      }

      return message.map((l) => indent(l, 2)).join("\n");
    },
  );

  return `${formatHeader(
    "Errors found while parsing environment:",
  )}\n${formattedErrors.join("\n\n")}\n`;
}
