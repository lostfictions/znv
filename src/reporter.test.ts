import { z } from "zod";
import { deprecate, parseEnv, port } from "./compat.js";

describe("reporter", () => {
  it("should test the error output", () => {
    expect(() =>
      parseEnv(
        {
          FOO: "bar",
          CONFIG_OBJECT: JSON.stringify({ a: 123, c: { d: 21 } }),
          DO_NOT_USE_THIS_KEY: "this value shall not exist",
          DO_NOT_USE_LEGACY: "this value shall not exist",
        },
        {
          CONFIG_OBJECT: z
            .object({
              a: z.string(),
              b: z.number(),
              c: z.object({
                d: z.string(),
              }),
            })
            .meta({
              description:
                "This is a very special object that holds configuration.",
            }),
          BLA: z.string().default("bar"),
          FOO: z.number(),
          DO_NOT_USE_LEGACY: deprecate(),
          DO_NOT_USE_THIS_KEY: z.string().meta({
            deprecated: true,
          }),
          SOME_WITH_DEPRECATED_DESCRIPTION: {
            description: "Some description",
            schema: z.string(),
          },
          SOME_WITH_DEPRECATED_DESCRIPTION_AND_NEW_DESCRIPTION: {
            description: "Some description",
            schema: z.string().meta({ description: "New description" }),
          },
          PORT: {
            schema: port(),
            defaults: { _: 70000 },
          },
        },
      ),
    ).toThrowErrorMatchingSnapshot();
  });
});
