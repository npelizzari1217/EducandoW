import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export class HexColor {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<HexColor, ValidationError> {
    if (!HEX_COLOR_REGEX.test(value)) {
      return err(
        new ValidationError(
          `Invalid hex color: "${value}". Must match pattern #RRGGBB (e.g. #1a56db)`,
        ),
      );
    }
    return ok(new HexColor(value));
  }

  static reconstruct(value: string): HexColor {
    return new HexColor(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: HexColor): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
