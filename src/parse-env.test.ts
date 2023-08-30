import * as z from "zod";

import { parseEnv } from "./parse-env.js";
import { port } from "./extra-schemas.js";

// FIXME: many of these don't need to be part of parseCore tests, or at minimum
// can be categorized further
describe("parseCore", () => {
  it("handles a basic case", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
        PORT: "5050",
      },
      {
        HOST: z.string(),
        PORT: port(),
      },
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 5050,
    });
  });

  it("handles a basic case with a zod default", () => {
    const x = parseEnv(
      {
        PORT: "5050",
      },
      {
        HOST: z.string().default("localhost"),
        PORT: port(),
      },
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 5050,
    });
  });

  it("returns the correct default based on NODE_ENV", () => {
    expect(
      parseEnv(
        {
          NODE_ENV: "production",
          HOST: "envhost",
          PORT: "5050",
        },
        {
          HOST: {
            schema: z.string(),
            defaults: {
              production: "prodhost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "envhost",
      PORT: 5050,
    });

    expect(
      parseEnv(
        {
          NODE_ENV: "production",
        },
        {
          HOST: {
            schema: z.string(),
            defaults: {
              production: "prodhost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "prodhost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {
          NODE_ENV: "production",
          HOST: "envhost",
        },
        {
          HOST: {
            schema: z.string(),
            defaults: {
              development: "devhost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "envhost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {
          NODE_ENV: "production",
        },
        {
          HOST: {
            schema: z.string(),
            defaults: {
              production: "prodhost",
              development: "devhost",
              _: "defaulthost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "prodhost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {
          NODE_ENV: "production",
          HOST: "envhost",
        },
        {
          HOST: {
            schema: z.string(),
            defaults: {
              production: "prodhost",
              development: "devhost",
              _: "defaulthost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "envhost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {},
        {
          HOST: {
            schema: z.string(),
            defaults: {
              production: "prodhost",
              development: "devhost",
              _: "defaulthost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "defaulthost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {},
        {
          HOST: {
            schema: z.string().default("zoddefaulthost"),
            defaults: {
              production: "prodhost",
              development: "devhost",
              _: "defaulthost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "defaulthost",
      PORT: 80,
    });

    expect(
      parseEnv(
        {},
        {
          HOST: {
            schema: z.string().default("zoddefaulthost"),
            defaults: {
              production: "prodhost",
              development: "devhost",
            },
          },
          PORT: port().default(80),
        },
      ),
    ).toStrictEqual({
      HOST: "zoddefaulthost",
      PORT: 80,
    });
  });

  it("handles optional values", () => {
    const res = parseEnv(
      { dogs: "12" },
      {
        cats: z.number().nonnegative().optional(),
        dogs: z.bigint().optional(),
      },
    );

    expect(res).toStrictEqual({
      cats: undefined,
      dogs: 12n,
    });
  });

  it("handles an optional nonempty string", () => {
    expect(
      parseEnv(
        {},
        {
          myValue: z.string().nonempty().optional(),
        },
      ),
    ).toStrictEqual({
      myValue: undefined,
    });

    expect(() =>
      parseEnv(
        { myValue: "" },
        {
          myValue: z.string().nonempty().optional(),
        },
      ),
    ).toThrow();
  });

  it("fails a string schema when value is missing", () => {
    // a missing value should never be coerced to an empty string, for example
    expect(() => parseEnv({}, { dogs: z.string() })).toThrow();
  });

  it("handles a positive int", () => {
    expect(
      parseEnv({ dogCount: "34" }, { dogCount: z.number() }),
    ).toStrictEqual({
      dogCount: 34,
    });
  });

  it("handles a positive float", () => {
    expect(
      parseEnv({ dogCount: "29.453" }, { dogCount: z.number() }),
    ).toStrictEqual({
      dogCount: 29.453,
    });
  });

  it("handles a negative int", () => {
    expect(
      parseEnv({ dogCount: "-32" }, { dogCount: z.number() }),
    ).toStrictEqual({
      dogCount: -32,
    });
  });

  it("handles a negative float", () => {
    expect(
      parseEnv({ dogCount: "-329.3" }, { dogCount: z.number() }),
    ).toStrictEqual({
      dogCount: -329.3,
    });
  });

  it("throws on a number schema given a string with leading dash", () => {
    expect(() =>
      parseEnv({ dogCount: "-323hello3.3942" }, { dogCount: z.number() }),
    ).toThrow();
  });

  it("handles an object", () => {
    const animal = z.object({
      sound: z.string(),
      size: z.enum(["big", "medium", "small"]),
    });

    const x = parseEnv(
      {
        ANIMALS:
          '{ "dog": { "sound": "woof", "size": "big" }, "cat": { "sound": "meow", "size": "small" } }',
      },
      {
        ANIMALS: z.object({
          dog: animal,
          cat: animal,
        }),
      },
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

    const x = parseEnv(
      { pet: '{ "sound": "woof", "size": "big", "smell": "bad" }' },
      { pet: z.intersection(animal, thingWithSmell) },
    );

    expect(x).toStrictEqual({
      pet: { sound: "woof", size: "big", smell: "bad" },
    });

    expect(() =>
      parseEnv(
        { pet: '{ "sound": "woof", "size": "big" }' },
        { pet: z.intersection(animal, thingWithSmell) },
      ),
    ).toThrow();
  });

  it("validates and throws on invalid env values", () => {
    // TODO: use more specific throw matcher
    expect(() =>
      parseEnv(
        {
          HOST: "localhost",
          PORT: "50505050",
        },
        {
          HOST: z.string(),
          PORT: port(),
        },
      ),
    ).toThrow();
  });

  it("doesn't pass through any env values not in the schema", () => {
    const x = parseEnv(
      { HOST: "localhost", PORT: "5050" },
      { HOST: z.string() },
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
    });
  });

  it("handles a detailed spec with defaults", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
      },
      {
        HOST: z.string(),
        PORT: {
          schema: port(),
          defaults: { _: 4040 },
        },
      },
    );

    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 4040,
    });
  });

  it("validates defaults against the schema and throws", () => {
    // TODO: use more specific throw matcher
    expect(() =>
      parseEnv(
        {
          HOST: "localhost",
        },
        {
          HOST: z.string(),
          PORT: {
            schema: port(),
            defaults: { _: 70000 },
          },
        },
      ),
    ).toThrow();
  });

  it("handles a simple schema with a .transform postprocessor", () => {
    const x = parseEnv(
      {
        FUN_LEVEL: "8",
      },
      {
        FUN_LEVEL: z
          .number()
          .int()
          .transform((n) => String(n + 10)),
      },
    );

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fun: number = x.FUN_LEVEL;

    expect(x.FUN_LEVEL).toBe("18");
  });

  it("handles a spec with a .transform postprocessor and defaults", () => {
    const x = parseEnv(
      {},
      {
        FUN_LEVEL: {
          schema: z
            .number()
            .int()
            .transform((n) => String(n + 10)),
          defaults: { _: 8 },
        },
      },
    );

    const funLevel: string = x.FUN_LEVEL;

    // @ts-expect-error (2322) -- shouldn't be assignable to number
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const funLevelAsNumber: number = x.FUN_LEVEL;

    expect(funLevel).toBe("18");
  });

  it("throws on a .transform postprocessor with invalid default type", () => {
    expect(() =>
      parseEnv(
        {},
        {
          FUN_LEVEL: {
            schema: z
              .number()
              .int()
              .transform((n) => String(n)),
            // @ts-expect-error (2322) -- should be number
            defaults: {
              _: new Map(),
            },
            // @ts-expect-error (2322) -- excess properties should be checked
            nonsense: "oops",
          },
        },
      ),
    ).toThrow();
  });

  const schemasWithDefaults: [z.ZodTypeAny, any][] = [
    [z.number(), 5],
    [z.object({ a: z.string(), b: z.bigint() }), { a: "ok", b: 4n }],
  ];

  it("handles spec-provided defaults for common schema types", () => {
    expect.hasAssertions();

    for (const [schema, defaultValue] of schemasWithDefaults) {
      const { SOME_SCHEMA } = parseEnv(
        {},
        { SOME_SCHEMA: { schema, defaults: { _: defaultValue } } as any },
      );

      expect(SOME_SCHEMA).toStrictEqual(defaultValue);
    }
  });

  it("handles validator-provided defaults for common schema types", () => {
    expect.hasAssertions();

    for (const [schema, defaultValue] of schemasWithDefaults) {
      const { SOME_SCHEMA } = parseEnv(
        {},
        { SOME_SCHEMA: schema.default(defaultValue) },
      );

      expect(SOME_SCHEMA).toStrictEqual(defaultValue);
    }
  });

  it("handles undefined in production and the given default otherwise", () => {
    const schema = {
      COOL: {
        schema: z.string().nonempty(),
        defaults: {
          production: undefined,
          _: "verycool",
        },
      },
    };

    const expected = { COOL: "verycool" };

    expect(parseEnv({}, schema)).toStrictEqual(expected);
    expect(parseEnv({ NODE_ENV: "dev" }, schema)).toStrictEqual(expected);
    expect(() => parseEnv({ NODE_ENV: "production" }, schema)).toThrow();
  });

  it("throws when a value is passed to z.undefined()", () => {
    expect(() =>
      parseEnv({ DEPRECATED: "something" }, { DEPRECATED: z.undefined() }),
    ).toThrow();

    expect(() =>
      parseEnv({ DEPRECATED: "" }, { DEPRECATED: z.undefined() }),
    ).toThrow();

    expect(() => parseEnv({}, { DEPRECATED: z.undefined() })).not.toThrow();
  });

  it("handles a schema with refinement type", () => {
    const schema = {
      AT_LEAST_FIVE_WORDS: z.string().refine((s) => s.split(" ").length >= 5),
    };

    expect(() =>
      parseEnv({ AT_LEAST_FIVE_WORDS: "only four words here" }, schema),
    ).toThrow();

    expect(() =>
      parseEnv({ AT_LEAST_FIVE_WORDS: "but there's five words here!" }, schema),
    ).not.toThrow();
  });

  it("handles a schema that transforms the result", () => {
    const res = parseEnv(
      {
        wordList: "hello there friends",
      },
      {
        wordList: z.string().transform((s) => s.split(" ")),
      },
    );

    expect(res).toStrictEqual({ wordList: ["hello", "there", "friends"] });
  });
});
