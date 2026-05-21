export type Result<T, E = Error> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly _tag = 'ok' as const;
  constructor(readonly value: T) {}
  isOk(): this is Ok<T, E> {
    return true;
  }
  isErr(): this is Err<T, E> {
    return false;
  }
  unwrap(): T {
    return this.value;
  }
  unwrapErr(): never {
    throw new Error('Called unwrapErr on Ok');
  }
}

export class Err<T, E> {
  readonly _tag = 'err' as const;
  constructor(readonly error: E) {}
  isOk(): this is Ok<T, E> {
    return false;
  }
  isErr(): this is Err<T, E> {
    return true;
  }
  unwrap(): never {
    throw this.error;
  }
  unwrapErr(): E {
    return this.error;
  }
}

export function ok<T, E = never>(value: T): Result<T, E> {
  return new Ok(value);
}

export function err<T, E>(error: E): Result<T, E> {
  return new Err(error);
}
