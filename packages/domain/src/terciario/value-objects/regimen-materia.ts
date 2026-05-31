export type RegimenMateriaValue = 'PROMOCIONAL' | 'REGULAR' | 'LIBRE';

const VALID: readonly RegimenMateriaValue[] = ['PROMOCIONAL', 'REGULAR', 'LIBRE'];

export class RegimenMateria {
  private constructor(private readonly value: RegimenMateriaValue) {}

  static create(value: string): RegimenMateria {
    if (!VALID.includes(value as RegimenMateriaValue)) {
      throw new Error(`RegimenMateria inválido: ${value}. Valores válidos: ${VALID.join(', ')}`);
    }
    return new RegimenMateria(value as RegimenMateriaValue);
  }

  get(): RegimenMateriaValue {
    return this.value;
  }

  equals(other: RegimenMateria): boolean {
    return this.value === other.value;
  }
}
