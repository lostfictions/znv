export function assertNever(value: never): never {
  throw new Error(`Unhandled type: ${JSON.stringify(value)}`);
}

type primitive = string | number | boolean | undefined | null;

export type DeepReadonlyArray<T> = readonly DeepReadonly<T>[];

export type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type DeepReadonly<T> = T extends primitive
  ? T
  : T extends (infer U)[]
    ? DeepReadonlyArray<U>
    : DeepReadonlyObject<T>;
