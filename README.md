# znv

Parse your environment with [Zod](https://github.com/colinhacks/zod).

<a href="https://www.npmjs.com/package/znv">
<img src="https://img.shields.io/npm/v/znv.svg?logo=npm" alt="NPM version" />
</a>

```bash
npm i znv zod
# or
yarn add znv zod
```

## Complementary tooling

The [eslint-plugin-node](https://github.com/mysticatea/eslint-plugin-node) rule
[`no-process-env`](https://github.com/mysticatea/eslint-plugin-node/blob/master/docs/rules/no-process-env.md)
is recommended to restrict usage of `process.env` outside of the module that
parses your schema.

znv also works great with [dotenv](https://github.com/motdotla/dotenv).
