import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import { parseEnv } from "./bridge.js";

describe("zod3 and zod4 support", () => {
  it("should support zod3", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
      },
      {
        HOST: z3.string(),
      },
    );
    expect(x).toStrictEqual({
      HOST: "localhost",
    });
  });
  it("should support zod3 with extended schemas", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
      },
      {
        HOST: z3.string(),
        PORT: {
          schema: z3.number(),
          defaults: { _: 4040 },
        },
      },
    );
    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 4040,
    });
  });
  it("should support zod4", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
      },
      {
        HOST: z4.string(),
      },
    );
    expect(x).toStrictEqual({
      HOST: "localhost",
    });
  });
  it("should support zod4 with extended schemas", () => {
    const x = parseEnv(
      {
        HOST: "localhost",
      },
      {
        HOST: z4.string(),
        PORT: {
          schema: z4.number(),
          defaults: { _: 4040 },
        },
      },
    );
    expect(x).toStrictEqual({
      HOST: "localhost",
      PORT: 4040,
    });
  });
});
