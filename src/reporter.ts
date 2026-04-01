import { $ZodError, toDotPath } from "zod/v4/core";
import type * as z from "zod/v4";
import type { Schemas } from "./parse-env.js";

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

// this is zod's `prettifyError`, but with formatting for the object path.
function prettifyError(
  error: $ZodError,
  formatObjectPath: (string: string) => string = String,
): string {
  const lines: string[] = [];
  // sort by path length
  const issues = [...error.issues].toSorted(
    (a, b) => a.path.length - b.path.length,
  );

  // Process each issue
  for (const issue of issues) {
    lines.push(`✖ ${issue.message}`);
    if (issue.path?.length) {
      lines.push(`→ at ${formatObjectPath(toDotPath(issue.path))}`);
    }
  }

  // Convert Map to formatted string
  return lines.map((l) => indent(l, 2)).join("\n");
}

export function reportErrors(
  errors: ErrorWithContext[],
  schemas: Schemas,
  {
    formatVarName = String,
    formatReceivedValue = String,
    formatDefaultValue = String,
    formatObjKey = String,
    formatHeader = String,
  }: TokenFormatters = {},
): string {
  const formattedErrors = errors.map(
    ({ key, receivedValue, error, defaultUsed, defaultValue }) => {
      let title = `[${formatVarName(key)}]:`;

      const typeSchema = (
        schemas[key] && "schema" in schemas[key]
          ? schemas[key].schema
          : schemas[key]
      ) as z.ZodType;
      const meta = typeSchema.meta();
      const desc =
        meta?.description ??
        (schemas[key] && "description" in schemas[key]
          ? // eslint-disable-next-line @typescript-eslint/no-deprecated
            schemas[key].description
          : undefined);
      if (desc) {
        title += ` ${desc}`;
      }

      const message: string[] = [title];

      if (error instanceof $ZodError) {
        message.push(prettifyError(error, formatObjKey));
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
          4,
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
            4,
          ),
        );
      }

      return message.join("\n");
    },
  );

  return `${formatHeader(
    "Errors found while parsing environment:",
  )}\n${formattedErrors.join("\n\n")}\n`;
}
