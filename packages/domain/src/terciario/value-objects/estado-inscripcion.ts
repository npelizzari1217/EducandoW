export type EstadoInscripcionValue =
  | 'INSCRIPTO'
  | 'CURSANDO'
  | 'REGULAR'
  | 'APROBADO'
  | 'LIBRE'
  | 'PROMOCIONAL'; // PROMOCIONAL valid value — see ADR-1

const VALID: readonly EstadoInscripcionValue[] = [
  'INSCRIPTO',
  'CURSANDO',
  'REGULAR',
  'APROBADO',
  'LIBRE',
  'PROMOCIONAL',
];

export class EstadoInscripcion {
  private constructor(private readonly value: EstadoInscripcionValue) {}

  static create(value: string): EstadoInscripcion {
    if (!VALID.includes(value as EstadoInscripcionValue)) {
      throw new Error(`EstadoInscripcion inválido: ${value}. Valores válidos: ${VALID.join(', ')}`);
    }
    return new EstadoInscripcion(value as EstadoInscripcionValue);
  }

  get(): EstadoInscripcionValue {
    return this.value;
  }

  equals(other: EstadoInscripcion): boolean {
    return this.value === other.value;
  }

  esRegular(): boolean {
    return this.value === 'REGULAR';
  }

  esLibre(): boolean {
    return this.value === 'LIBRE';
  }

  esPromocional(): boolean {
    return this.value === 'PROMOCIONAL';
  }

  /** True for states that represent a confirmed cursada condition */
  esConfirmada(): boolean {
    return ['REGULAR', 'PROMOCIONAL', 'LIBRE', 'APROBADO'].includes(this.value);
  }
}
