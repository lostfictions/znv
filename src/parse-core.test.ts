import * as z from "zod";

import { parseCore } from "./parse-core";

describe("parseCore", () => {
  it("handles a basic case", () => {
    const [x] = parseCore(
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

  it("handles a basic case with defaults", () => {
    const [x] = parseCore(
      {
        PORT: "5050",
      },
      {
        HOST: z.string().default("localhost"),
        PORT: z.number().int().nonnegative().lte(65535),
      }
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 5050,
    });
  });

  it("parses NODE_ENV and returns resolved values", () => {
    const x = parseCore(
      {
        NODE_ENV: "production",
        HOST: "localhost",
        PORT: "5050",
      },
      {
        HOST: z.string(),
        PORT: z.number().int().nonnegative().lte(65535),
      }
    );

    expect(x).toStrictEqual([
      {
        HOST: "localhost",
        PORT: 5050,
      },
      {
        isDev: false,
        isProd: true,
      },
    ]);
  });

  it("handles an object", () => {
    const animal = z.object({
      sound: z.string(),
      size: z.enum(["big", "medium", "small"]),
    });

    const [x] = parseCore(
      {
        ANIMALS:
          '{ "dog": { "sound": "woof", "size": "big" }, "cat": { "sound": "meow", "size": "small" } }',
      },
      {
        ANIMALS: z.object({
          dog: animal,
          cat: animal,
        }),
      }
    );

    expect(x).toStrictEqual({
      ANIMALS: {
        dog: {
          sound: "woof",
          size: "big",
        },
        cat: {
          sound: "meow",
          size: "small",
        },
      },
    });
  });

  it("handles an intersection type", () => {
    const animal = z.object({
      sound: z.string(),
      size: z.enum(["big", "medium", "small"]),
    });

    const thingWithSmell = z.object({
      smell: z.enum(["bad", "very bad"]),
    });

    const [x] = parseCore(
      { pet: '{ "sound": "woof", "size": "big", "smell": "bad" }' },
      { pet: z.intersection(animal, thingWithSmell) }
    );

    expect(x).toStrictEqual({
      pet: { sound: "woof", size: "big", smell: "bad" },
    });

    expect(() =>
      parseCore(
        { pet: '{ "sound": "woof", "size": "big" }' },
        { pet: z.intersection(animal, thingWithSmell) }
      )
    ).toThrow();
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

  it("doesn't pass through any env values not in the schema", () => {
    const [x] = parseCore(
      { HOST: "localhost", PORT: "5050" },
      { HOST: z.string() }
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
    });
  });

  it("handles a detailed spec with defaults", () => {
    const [x] = parseCore(
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

  it("validates defaults against the schema and throws", () => {
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
    const [x] = parseCore(
      {
        FUN_LEVEL: "8",
      },
      {
        FUN_LEVEL: z
          .number()
          .int()
          .transform((n) => String(n + 10)),
      }
    );

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fun: number = x.FUN_LEVEL;

    expect(x.FUN_LEVEL).toBe("18");
  });

  it("handles a spec with a .transform postprocessor and defaults", () => {
    const [x] = parseCore(
      {},
      {
        FUN_LEVEL: {
          schema: z
            .number()
            .int()
            .transform((n) => String(n + 10)),
          defaultValue: 8,
        },
      }
    );

    const funLevel: string = x.FUN_LEVEL;

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const funLevelAsNumber: number = x.FUN_LEVEL;

    expect(funLevel).toBe("18");
  });

  it("throws on a .transform postprocessor with invalid default type", () => {
    expect(() =>
      parseCore(
        {},
        {
          FUN_LEVEL: {
            schema: z
              .number()
              .int()
              .transform((n) => String(n)),
            // @ts-expect-error (2322) -- should be number
            defaultValue: new Map(),
          },
        }
      )
    ).toThrow();
  });

  const schemasWithDefaults: [z.ZodTypeAny, any][] = [
    [z.number(), 5],
    [z.object({ a: z.string(), b: z.bigint() }), { a: "ok", b: 4n }],
  ];

  it("handles spec-provided defaults for common schema types", () => {
    expect.hasAssertions();

    for (const [schema, defaultValue] of schemasWithDefaults) {
      const [{ SOME_SCHEMA }] = parseCore(
        {},
        { SOME_SCHEMA: { schema, defaultValue } as any }
      );

      expect(SOME_SCHEMA).toStrictEqual(defaultValue);
    }
  });

  it("handles validator-provided defaults for common schema types", () => {
    expect.hasAssertions();

    for (const [schema, defaultValue] of schemasWithDefaults) {
      const [{ SOME_SCHEMA }] = parseCore(
        {},
        { SOME_SCHEMA: schema.default(defaultValue) }
      );

      expect(SOME_SCHEMA).toStrictEqual(defaultValue);
    }
  });
});
