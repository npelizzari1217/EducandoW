import { Result, ok, err } from '../result';
import { ValidationError } from '../errors/validation-error';

/**
 * Nivel educativo base (sin modalidad).
 *
 * Los códigos 1-4 representan los 4 niveles pedagógicos reales.
 * El código 9 (ADMINISTRACION) es un scope de operación, no un nivel pedagógico.
 *
 * Los números se eligieron para que al combinarlos con modalidad (×10 + modality)
 * el rango de cada nivel sea contiguo: 10-19 Inicial, 20-29 Primario, etc.
 */
export enum EducationalLevelCode {
  INICIAL = 1,
  PRIMARIO = 2,
  SECUNDARIO = 3,
  TERCIARIO = 4,
  ADMINISTRACION = 9,
}

const LABELS: Record<EducationalLevelCode, string> = {
  [EducationalLevelCode.INICIAL]: 'Inicial',
  [EducationalLevelCode.PRIMARIO]: 'Primario',
  [EducationalLevelCode.SECUNDARIO]: 'Secundario',
  [EducationalLevelCode.TERCIARIO]: 'Terciario',
  [EducationalLevelCode.ADMINISTRACION]: 'Administración',
};

const PEDAGOGICAL_LEVELS: EducationalLevelCode[] = [
  EducationalLevelCode.INICIAL,
  EducationalLevelCode.PRIMARIO,
  EducationalLevelCode.SECUNDARIO,
  EducationalLevelCode.TERCIARIO,
];

export class EducationalLevel {
  private constructor(private readonly _code: EducationalLevelCode) {}

  static fromCode(code: EducationalLevelCode): EducationalLevel {
    return new EducationalLevel(code);
  }

  static fromLevelCode(compositeCode: number): EducationalLevel {
    const base = Math.floor(compositeCode / 10);
    return new EducationalLevel(base as EducationalLevelCode);
  }

  static create(value: string): Result<EducationalLevel, ValidationError> {
    const normalized = value.toUpperCase().trim();
    for (const [key, code] of Object.entries(EducationalLevelCode)) {
      if (typeof code === 'number' && key === normalized) {
        return ok(new EducationalLevel(code));
      }
    }
    const numeric = parseInt(normalized, 10);
    if (!isNaN(numeric) && Object.values(EducationalLevelCode).includes(numeric)) {
      return ok(new EducationalLevel(numeric));
    }
    return err(new ValidationError(
      `Invalid educational level: "${value}". Valid: INICIAL(1), PRIMARIO(2), SECUNDARIO(3), TERCIARIO(4), ADMINISTRACION(9)`,
    ));
  }

  get code(): EducationalLevelCode {
    return this._code;
  }

  get label(): string {
    return LABELS[this._code];
  }

  get isPedagogical(): boolean {
    return PEDAGOGICAL_LEVELS.includes(this._code);
  }

  /** Returns the base for composite codes: level * 10 */
  get compositeBase(): number {
    return this._code * 10;
  }

  equals(other: EducationalLevel): boolean {
    return this._code === other._code;
  }

  toString(): string {
    return EducationalLevelCode[this._code];
  }
}
