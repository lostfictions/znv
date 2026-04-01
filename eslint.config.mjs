import { defineConfig } from "eslint/config";
import lostfictions from "eslint-config-lostfictions";

export default defineConfig(lostfictions, {
  ignores: ["dist/", "dist-cjs/", "node_modules/"],
});
