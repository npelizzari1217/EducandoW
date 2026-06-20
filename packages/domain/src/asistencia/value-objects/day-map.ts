/**
 * DayMap — Value Object for monthly attendance day storage (ADR-1).
 *
 * Encapsulates the JSON day-map shape: { "1": "P", "2": "A", ... }
 * Keys: day-of-month as numeric strings "1".."31".
 * Values: AttendanceType.code — any non-empty string (catalog validation is app-layer concern).
 *
 * Immutable: withDay() always returns a NEW instance.
 */
export class DayMap {
  private constructor(private readonly days: Readonly<Record<string, string>>) {}

  /** Creates an empty DayMap (no days recorded). */
  static empty(): DayMap {
    return new DayMap({});
  }

  /** Rehydrates a DayMap from a persisted JSON record. */
  static fromRecord(record: Record<string, string>): DayMap {
    return new DayMap({ ...record });
  }

  /**
   * Returns a new DayMap with the given day set to the given code.
   * Validates: day must be 1..31; code must be non-empty.
   * Does NOT validate code against AttendanceType catalog — that is an application-layer concern.
   */
  withDay(day: number, code: string): DayMap {
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error(`DayMap: invalid day "${day}" — must be an integer between 1 and 31`);
    }
    if (!code || code.trim() === '') {
      throw new Error(`DayMap: code must be a non-empty string`);
    }
    return new DayMap({ ...this.days, [String(day)]: code });
  }

  /** Returns the code for the given day, or undefined if not yet recorded. */
  get(day: number): string | undefined {
    return this.days[String(day)];
  }

  /** Returns a plain-object snapshot suitable for JSON serialization to Prisma Json column. */
  toJSON(): Record<string, string> {
    return { ...this.days };
  }
}
