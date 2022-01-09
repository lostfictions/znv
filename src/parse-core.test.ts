import * as z from "zod";

import { parseCore } from "./parse-core";

describe("parseCore", () => {
  it("handles a basic case", () => {
    const x = parseCore(
      { HOST: "localhost", PORT: "5050" },
      { HOST: z.string() }
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
});
