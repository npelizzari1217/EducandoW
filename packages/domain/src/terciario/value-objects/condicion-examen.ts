export type CondicionExamenValue = 'APROBADO' | 'DESAPROBADO' | 'AUSENTE';

const VALID: readonly CondicionExamenValue[] = ['APROBADO', 'DESAPROBADO', 'AUSENTE'];

export class CondicionExamen {
  private constructor(private readonly value: CondicionExamenValue) {}

  static create(value: string): CondicionExamen {
    if (!VALID.includes(value as CondicionExamenValue)) {
      throw new Error(`CondicionExamen inválida: ${value}. Valores válidos: ${VALID.join(', ')}`);
    }
    return new CondicionExamen(value as CondicionExamenValue);
  }

  get(): CondicionExamenValue {
    return this.value;
  }

  equals(other: CondicionExamen): boolean {
    return this.value === other.value;
  }
}
