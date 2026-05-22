import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|svg)(\?.*)?$/i;
const ABSOLUTE_URL_REGEX = /^(https?|s3):\/\/.+/i;
const RELATIVE_URL_REGEX = /^\/?[a-zA-Z0-9._\-/~?=&]+$/;

export class LogoUrl {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<LogoUrl, ValidationError> {
    if (!value || value.trim().length === 0) {
      return err(new ValidationError('Invalid logo URL: URL must not be empty'));
    }

    const trimmed = value.trim();

    // Check if it has a valid image extension
    if (!IMAGE_EXTENSIONS.test(trimmed)) {
      return err(
        new ValidationError(
          `Invalid logo URL: "${trimmed}". Must be a URL ending with .png, .jpg, .jpeg, or .svg`,
        ),
      );
    }

    // Accept absolute URLs (http, https, s3) or relative paths
    const isAbsolute = ABSOLUTE_URL_REGEX.test(trimmed);
    const isRelative = RELATIVE_URL_REGEX.test(trimmed);

    if (!isAbsolute && !isRelative) {
      return err(
        new ValidationError(
          `Invalid logo URL: "${trimmed}". Must be a valid http/https/s3 URL or a relative path`,
        ),
      );
    }

    return ok(new LogoUrl(trimmed));
  }

  static reconstruct(value: string): LogoUrl {
    return new LogoUrl(value);
  }

  get(): string {
    return this.value;
  }

  equals(other: LogoUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
