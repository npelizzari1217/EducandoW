export type CondicionCursadaValue = 'APROBADO' | 'DESAPROBADO' | 'AUSENTE';

const VALID: readonly CondicionCursadaValue[] = ['APROBADO', 'DESAPROBADO', 'AUSENTE'];

export class CondicionCursada {
  private constructor(private readonly value: CondicionCursadaValue) {}

  static create(value: string): CondicionCursada {
    if (!VALID.includes(value as CondicionCursadaValue)) {
      throw new Error(
        `CondicionCursada inválida: ${value}. Valores válidos: ${VALID.join(', ')}`,
      );
    }
    return new CondicionCursada(value as CondicionCursadaValue);
  }

  get(): CondicionCursadaValue {
    return this.value;
  }

  equals(other: CondicionCursada): boolean {
    return this.value === other.value;
  }
}
