# znv

<a href="https://www.npmjs.com/package/znv">
<img src="https://img.shields.io/npm/v/znv.svg?logo=npm" alt="NPM version" />
</a>

Parse your environment with [Zod](https://github.com/colinhacks/zod). Pass in a
schema and it will be checked against your `process.env` (or any other object
you provide shaped like `Record<string, string | undefined>`). Get back a
validated, read-only environment object that you can export for use in your app.
You can optionally provide defaults (which can be matched against `NODE_ENV`
values like `production` or `development`) and even transform the validated
result.

```bash
npm i znv zod
# or
yarn add znv zod
```

<!--
## Why?

### Why do I need znv?
 -->

## Usage

```ts
import { parseEnv, z, port } from "znv";

// a basic example. znv re-exports zod as `z` for convenience.
export const { HOST, PORT } = parseEnv(process.env, {
  HOST: z.string(),
  PORT: port(),
});
```

```ts
// you can provide defaults with `.default()`.
export const { HOST, PORT } = parseEnv(process.env, {
  HOST: z.string().default("localhost"),
  PORT: port().default(8080),
});
```

```ts
export const { HOST, PORT } = parseEnv(process.env, {
  // specs can also be more detailed.
  HOST: {
    schema: z.string(),

    // the description is handy as in-code documentation, but is also printed
    // to the console if validation for this env var fails.
    description: "The hostname for this service.",

    // instead of specifying defaults as part of the zod schema, you can pass
    // them in the `defaults` object. a default will be matched based on the
    // value of `NODE_ENV`.
    defaults: {
      production: "my-cool-horse.website",
      staging: "cool-horse-staging.cloud-provider.zone",
      // "_" is a special token that can be used in `defaults`. its value will
      // be used if `NODE_ENV` doesn't match any other provided key.
      // use this with care -- it's not rare to forget to set `NODE_ENV` in
      // a production server's environment, which may cause this value to be
      // used when it shouldn't.
      _: "localhost",
    },
  },

  AUTH_SERVER: {
    // use all of the expressiveness of zod, including post-processing the
    // validated result.
    spec: z.enum(["production", "staging", "development"]).transform((env) => {
      switch (env) {
        case "production":
          return "http://auth.cool-horse.app";
        case "staging":
          return "http://auth-staging.cool-horse.app";
        case "development":
          return "http://localhost:91";
      }
    }),
  },

  // mix and match simple and detailed specs.
  PORT: port().default(8080),

  // using zod arrays or objects as a spec will attempt to `JSON.parse` the env
  // var if it's present. remember, with great power comes great responsibility!
  // if you're passing large amounts of data in as an env var, you might be
  // doing something wrong.
  EDITORS: z.array(z.string().nonempty()),

  // optional values are also supported and provide a way to still benefit from
  // the validation and static typing provided by zod
  POST_LIMIT: z.number().optional(),
});
```

It's recommended to define a single file (you can call it something like
`env.ts`) that parses your environment and exports the result.

## Complementary tooling

The [eslint-plugin-node](https://github.com/mysticatea/eslint-plugin-node) rule
[`no-process-env`](https://github.com/mysticatea/eslint-plugin-node/blob/master/docs/rules/no-process-env.md)
is recommended to restrict usage of `process.env` outside of the module that
parses your schema.

znv also works great with [dotenv](https://github.com/motdotla/dotenv).
