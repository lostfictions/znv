import * as z from "zod/v4";

export const port = () => z.number().int().nonnegative().lte(65535);

export const deprecate = () =>
  z
    .undefined({ error: "This var is deprecated." })
    .transform(() => undefined as never);
