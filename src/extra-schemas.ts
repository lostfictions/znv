import * as z from "zod";

export const port = () => z.number().int().nonnegative().lte(65535);
