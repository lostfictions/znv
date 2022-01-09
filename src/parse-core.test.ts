import * as z from "zod";

import { parseCore } from "./parse-core";

describe("parseCore", () => {
  it("handles a basic case", () => {
    const x = parseCore(
      {
        HOST: "localhost",
        PORT: "5050",
      },
      {
        HOST: z.string(),
        PORT: z.number().int().nonnegative().lte(65535),
      }
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 5050,
    });
  });

  it("strips excess properties", () => {
    const x = parseCore(
      { HOST: "localhost", PORT: "5050" },
      { HOST: z.string() }
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
    });
  });

  it("handles a detailed schema with defaults", () => {
    const x = parseCore(
      {
        HOST: "localhost",
      },
      {
        HOST: z.string(),
        PORT: {
          schema: z.number().int().nonnegative().lte(65535),
          defaultValue: 4040,
        },
      }
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 4040,
    });
  });

  it("validates defaults and throws", () => {
    // TODO: use more specific throw matcher
    expect(() =>
      parseCore(
        {
          HOST: "localhost",
        },
        {
          HOST: z.string(),
          PORT: {
            schema: z.number().int().nonnegative().lte(65535),
            defaultValue: 70000,
          },
        }
      )
    ).toThrow();
  });
});
