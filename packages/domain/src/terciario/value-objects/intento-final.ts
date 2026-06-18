export type IntentoFinalValue = 1 | 2 | 3;

const VALID: readonly IntentoFinalValue[] = [1, 2, 3];

export class IntentoFinal {
  private constructor(private readonly value: IntentoFinalValue) {}

  static create(n: number): IntentoFinal {
    if (!VALID.includes(n as IntentoFinalValue)) {
      throw new Error(
        `IntentoFinal inválido: ${n}. Valores válidos: 1, 2, 3`,
      );
    }
    return new IntentoFinal(n as IntentoFinalValue);
  }

  get(): IntentoFinalValue {
    return this.value;
  }

  equals(other: IntentoFinal): boolean {
    return this.value === other.value;
  }
}
