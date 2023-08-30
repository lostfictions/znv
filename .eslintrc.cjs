require("eslint-config-lostfictions/patch");
module.exports = {
  extends: ["lostfictions"],
  parserOptions: { tsconfigRootDir: __dirname },
};
