import { parseEnv } from "./index.js";
import { deprecate } from "./extra-schemas.js";

describe("extra schemas", () => {
  describe("deprecate", () => {
    it("throws when a value is passed", () => {
      expect(() =>
        parseEnv({ DEPRECATED: "something" }, { DEPRECATED: deprecate() }),
      ).toThrow();

      expect(() =>
        parseEnv({ DEPRECATED: "" }, { DEPRECATED: deprecate() }),
      ).toThrow();

      expect(() => parseEnv({}, { DEPRECATED: deprecate() })).not.toThrow();
    });
  });
});
