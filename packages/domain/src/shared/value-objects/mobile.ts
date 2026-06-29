import { Result, ok, err } from '../result';
import { ValidationError } from '../errors/validation-error';

/**
 * Mobile value object.
 *
 * Normalization: strips spaces, dashes, parentheses and dots; preserves a
 * single optional leading `+`. After normalization the remaining characters
 * must be digits only, count between 8 and 15 (E.164 upper bound).
 *
 * Empty/whitespace → 'Mobile cannot be empty'.
 * Any other invalidity → 'Invalid mobile format'.
 *
 * REQ-RYT-11.
 */
export class Mobile {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<Mobile, ValidationError> {
    if (!raw || raw.trim().length === 0) {
      return err(new ValidationError('Mobile cannot be empty'));
    }

    // Step 1: Detect leading '+' before any normalization
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith('+');

    // Step 2: Strip normalizable chars (spaces, dashes, parentheses, dots)
    const stripped = trimmed.replace(/[\s\-().]/g, '');

    // Step 3: Remove the leading '+' if present for digit-only validation
    const withoutPlus = hasPlus ? stripped.slice(1) : stripped;

    // Step 4: withoutPlus must consist only of digits
    if (!/^\d+$/.test(withoutPlus)) {
      return err(new ValidationError('Invalid mobile format'));
    }

    // Step 5: Digit count must be between 8 and 15
    if (withoutPlus.length < 8 || withoutPlus.length > 15) {
      return err(new ValidationError('Invalid mobile format'));
    }

    const normalized = hasPlus ? '+' + withoutPlus : withoutPlus;
    return ok(new Mobile(normalized));
  }

  static reconstruct(value: string): Mobile {
    return new Mobile(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: Mobile): boolean {
    return this.value === other.value;
  }
}
