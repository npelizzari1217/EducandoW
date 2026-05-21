import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export enum LevelType {
  INICIAL = 'INICIAL',
  PRIMARIO = 'PRIMARIO',
  SECUNDARIO = 'SECUNDARIO',
  TERCIARIO = 'TERCIARIO',
}

export class Level {
  private constructor(private readonly value: LevelType) {}

  static create(value: string): Result<Level, ValidationError> {
    const upper = value.toUpperCase().trim();
    if (!Object.values(LevelType).includes(upper as LevelType)) {
      return err(
        new ValidationError(
          `Invalid pedagogical level: "${value}". Valid: ${Object.values(LevelType).join(', ')}`,
        ),
      );
    }
    return ok(new Level(upper as LevelType));
  }

  static reconstruct(value: LevelType): Level {
    return new Level(value);
  }

  get(): LevelType {
    return this.value;
  }

  equals(other: Level): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
