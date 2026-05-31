export type EstadoInscripcionValue = 'INSCRIPTO' | 'CURSANDO' | 'REGULAR' | 'APROBADO' | 'LIBRE';

const VALID: readonly EstadoInscripcionValue[] = ['INSCRIPTO', 'CURSANDO', 'REGULAR', 'APROBADO', 'LIBRE'];

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
}
