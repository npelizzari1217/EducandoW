export type EstadoTituloValue = 'EN_TRAMITE' | 'EMITIDO' | 'ENTREGADO';

const VALID: readonly EstadoTituloValue[] = ['EN_TRAMITE', 'EMITIDO', 'ENTREGADO'];

export class EstadoTitulo {
  private constructor(private readonly value: EstadoTituloValue) {}

  static create(value: string): EstadoTitulo {
    if (!VALID.includes(value as EstadoTituloValue)) {
      throw new Error(`EstadoTitulo inválido: ${value}. Valores válidos: ${VALID.join(', ')}`);
    }
    return new EstadoTitulo(value as EstadoTituloValue);
  }

  get(): EstadoTituloValue {
    return this.value;
  }

  equals(other: EstadoTitulo): boolean {
    return this.value === other.value;
  }
}
