export function assertNever(value: never): never {
  throw new Error(`Unhandled type: ${JSON.stringify(value)}`);
}
