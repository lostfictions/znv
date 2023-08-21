const identity = (input: string | number) => input;

declare const EdgeRuntime: unknown;

let colors = {
  yellow: identity,
  red: identity,
  cyan: identity,
  green: identity,
};

if (typeof EdgeRuntime !== "string") {
  colors = require("colorette");
}

export { colors };
