export type OrientacionCode = 'NATURALES' | 'SOCIALES' | 'ECONOMIA' | 'ARTE';

const VALID: ReadonlySet<OrientacionCode> = new Set(['NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE']);

export class Orientacion {
  private constructor(private readonly value: OrientacionCode) {}

  static create(value: string): Orientacion | null {
    if (!VALID.has(value as OrientacionCode)) return null;
    return new Orientacion(value as OrientacionCode);
  }

  static reconstruct(value: OrientacionCode): Orientacion {
    return new Orientacion(value);
  }

  get(): OrientacionCode {
    return this.value;
  }

  equals(other: Orientacion): boolean {
    return this.value === other.value;
  }
}
