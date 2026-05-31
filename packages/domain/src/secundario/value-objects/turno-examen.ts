export type TurnoExamenCode = 'DICIEMBRE' | 'FEBRERO';

const VALID: ReadonlySet<TurnoExamenCode> = new Set(['DICIEMBRE', 'FEBRERO']);

export class TurnoExamen {
  private constructor(private readonly value: TurnoExamenCode) {}

  static create(value: string): TurnoExamen | null {
    if (!VALID.has(value as TurnoExamenCode)) return null;
    return new TurnoExamen(value as TurnoExamenCode);
  }

  static reconstruct(value: TurnoExamenCode): TurnoExamen {
    return new TurnoExamen(value);
  }

  get(): TurnoExamenCode {
    return this.value;
  }

  equals(other: TurnoExamen): boolean {
    return this.value === other.value;
  }
}
