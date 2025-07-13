/**
 * Since there might be a provided default value of `null` or `undefined`, we
 * return a tuple that also indicates whether we found a default.
 */
export function resolveDefaultValueForSpec<TIn = unknown>(
  defaults: Record<string, TIn> | undefined,
  nodeEnv: string | undefined,
): [hasDefault: boolean, defaultValue: TIn | undefined] {
  if (defaults) {
    if (nodeEnv != null && Object.hasOwn(defaults, nodeEnv)) {
      return [true, defaults[nodeEnv]];
    }
    if ("_" in defaults) return [true, defaults["_"]];
  }
  return [false, undefined];
}
