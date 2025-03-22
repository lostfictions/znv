import { defineConfig } from "eslint/config";

import { default as lostificationConfig } from "eslint-config-lostfictions";

export default defineConfig([
  lostificationConfig,
  {
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
]);
