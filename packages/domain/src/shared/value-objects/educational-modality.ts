import { Result, ok, err } from '../result';
import { ValidationError } from '../errors/validation-error';

/**
 * Modalidad educativa dentro de un nivel.
 *
 * Se codifica como dígito de unidades en el código compuesto (levelBase + modality).
 * Los valores 0-2 son modos reales de enseñanza. El código 9 (TODOS) es solo
 * para scopes de consulta/filtro — no representa una modalidad pedagógica.
 */
export enum EducationalModalityCode {
  COMUN = 0,
  TALLERES = 1,
  BILINGÜISMO = 2,
  TODOS = 9,
}

const LABELS: Record<EducationalModalityCode, string> = {
  [EducationalModalityCode.COMUN]: 'Común',
  [EducationalModalityCode.TALLERES]: 'Talleres',
  [EducationalModalityCode.BILINGÜISMO]: 'Bilingüismo',
  [EducationalModalityCode.TODOS]: 'Todos',
};

const PEDAGOGICAL_MODALITIES: EducationalModalityCode[] = [
  EducationalModalityCode.COMUN,
  EducationalModalityCode.TALLERES,
  EducationalModalityCode.BILINGÜISMO,
];

export class EducationalModality {
  private constructor(private readonly _code: EducationalModalityCode) {}

  static fromCode(code: EducationalModalityCode): EducationalModality {
    return new EducationalModality(code);
  }

  static fromCompositeCode(compositeCode: number): EducationalModality {
    const mod = compositeCode % 10;
    return new EducationalModality(mod as EducationalModalityCode);
  }

  static create(value: string): Result<EducationalModality, ValidationError> {
    const normalized = value.toUpperCase().trim();
    for (const [key, code] of Object.entries(EducationalModalityCode)) {
      if (typeof code === 'number' && key === normalized) {
        return ok(new EducationalModality(code));
      }
    }
    const numeric = parseInt(normalized, 10);
    if (!isNaN(numeric) && Object.values(EducationalModalityCode).includes(numeric)) {
      return ok(new EducationalModality(numeric));
    }
    return err(new ValidationError(
      `Invalid educational modality: "${value}". Valid: COMUN(0), TALLERES(1), BILINGÜISMO(2), TODOS(9)`,
    ));
  }

  get code(): EducationalModalityCode {
    return this._code;
  }

  get label(): string {
    return LABELS[this._code];
  }

  get isPedagogical(): boolean {
    return PEDAGOGICAL_MODALITIES.includes(this._code);
  }

  equals(other: EducationalModality): boolean {
    return this._code === other._code;
  }

  toString(): string {
    return EducationalModalityCode[this._code];
  }
}
