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

  it("validates and throws on invalid env values", () => {
    // TODO: use more specific throw matcher
    expect(() =>
      parseCore(
        {
          HOST: "localhost",
          PORT: "50505050",
        },
        {
          HOST: z.string(),
          PORT: z.number().int().nonnegative().lte(65535),
        }
      )
    ).toThrow();
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

  it("handles a detailed spec with defaults", () => {
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

  it("handles a simple schema with a .transform postprocessor", () => {
    const x = parseCore(
      {
        FUN_LEVEL: "8",
      },
      {
        FUN_LEVEL: z
          .number()
          .int()
          .transform((n) => String(n)),
      }
    );

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fun: number = x.FUN_LEVEL;

    expect(x.FUN_LEVEL).toBe("8");
  });

  it("handles a spec with a .transform postprocessor and defaults", () => {
    const x = parseCore(
      {
        FUN_LEVEL: "8",
      },
      {
        FUN_LEVEL: {
          schema: z
            .number()
            .int()
            .transform((n) => String(n)),
        },
      }
    );

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fun: number = x.FUN_LEVEL;

    expect(x.FUN_LEVEL).toBe("8");
  });
});
