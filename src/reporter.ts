import { ZodError, ZodErrorMap, ZodIssueCode } from "zod";
import { yellow, red, cyan, green } from "colorette";
import { Schemas } from "./parse-env.js";

// Even though we also have our own formatter, we pass a custom error map to
// Zod's `.parse()` for two reasons:
// - to ensure that no other consumer of zod in the codebase has set a default
//   error map that might override our formatting
// - to return slightly friendly error messages in some common scenarios.
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
  key: string;
  receivedValue: unknown;
  error: unknown;
  defaultUsed: boolean;
  defaultValue: unknown;
}

const indent = (str: string, amt: number) => `${" ".repeat(amt)}${str}`;

export function reportErrors(
  errors: ErrorWithContext[],
  schemas: Schemas,
): string {
  const formattedErrors = errors.map(
    ({ key, receivedValue, error, defaultUsed, defaultValue }) => {
      let title = `[${yellow(key)}]:`;

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
            message.push(indent(`[${green(objKey)}]:`, 4));
            for (const fe of keyErrors) message.push(indent(fe, 6));
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
          `(received ${cyan(
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
            `(used default of ${cyan(
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

  return `${red(
    "Errors found while parsing environment:",
  )}\n${formattedErrors.join("\n\n")}\n`;
}
