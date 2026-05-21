import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const MIN_LENGTH = 6;
const MAX_LENGTH = 128;

export class Password {
  private constructor(private readonly value: string) {}

  static create(plain: string): Result<Password, ValidationError> {
    if (!plain || plain.length < MIN_LENGTH) {
      return err(new ValidationError(`Password must be at least ${MIN_LENGTH} characters`));
    }
    if (plain.length > MAX_LENGTH) {
      return err(new ValidationError(`Password must be at most ${MAX_LENGTH} characters`));
    }
    return ok(new Password(plain));
  }

  static reconstruct(value: string): Password {
    return new Password(value);
  }

  get(): string {
    return this.value;
  }
}
