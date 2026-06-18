export type SlotCursadaTerciarioValue =
  | 'PARCIAL_1'
  | 'PARCIAL_2'
  | 'RECUPERATORIO_PARCIAL_1'
  | 'RECUPERATORIO_PARCIAL_2'
  | 'TP';

const VALID: readonly SlotCursadaTerciarioValue[] = [
  'PARCIAL_1',
  'PARCIAL_2',
  'RECUPERATORIO_PARCIAL_1',
  'RECUPERATORIO_PARCIAL_2',
  'TP',
];

export class SlotCursadaTerciario {
  private constructor(private readonly value: SlotCursadaTerciarioValue) {}

  static create(value: string): SlotCursadaTerciario {
    if (!VALID.includes(value as SlotCursadaTerciarioValue)) {
      throw new Error(
        `SlotCursadaTerciario inválido: ${value}. Valores válidos: ${VALID.join(', ')}`,
      );
    }
    return new SlotCursadaTerciario(value as SlotCursadaTerciarioValue);
  }

  get(): SlotCursadaTerciarioValue {
    return this.value;
  }

  esRecuperatorio(): boolean {
    return this.value === 'RECUPERATORIO_PARCIAL_1' || this.value === 'RECUPERATORIO_PARCIAL_2';
  }

  parcialBase(): 'PARCIAL_1' | 'PARCIAL_2' {
    if (this.value === 'RECUPERATORIO_PARCIAL_1') return 'PARCIAL_1';
    if (this.value === 'RECUPERATORIO_PARCIAL_2') return 'PARCIAL_2';
    throw new Error(
      `parcialBase() solo aplica a slots recuperatorios, no a ${this.value}`,
    );
  }

  equals(other: SlotCursadaTerciario): boolean {
    return this.value === other.value;
  }
}
