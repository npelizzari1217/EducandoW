import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { EducationalLevel, EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModality, EducationalModalityCode } from '../../shared/value-objects/educational-modality';

/**
 * Códigos de nivel compuesto = nivel × 10 + modalidad.
 *
 * ┌──────────┬──────┬──────────────┬──────────────────────────────────┐
 * │ Rango    │ Base │ Modalidad    │ Significado                       │
 * ├──────────┼──────┼──────────────┼──────────────────────────────────┤
 * │ 10       │  1   │ 0 (Común)    │ Inicial                           │
 * │ 11       │  1   │ 1 (Talleres)  │ Talleres de Inicial              │
 * │ 12       │  1   │ 2 (Biling.)   │ Bilingüismo Inicial              │
 * │ 20       │  2   │ 0 (Común)    │ Primario                          │
 * │ 21       │  2   │ 1 (Talleres)  │ Talleres de Primario             │
 * │ 22       │  2   │ 2 (Biling.)   │ Bilingüismo Primario             │
 * │ 30       │  3   │ 0 (Común)    │ Secundario                        │
 * │ 31       │  3   │ 1 (Talleres)  │ Talleres de Secundario           │
 * │ 32       │  3   │ 2 (Biling.)   │ Bilingüismo Secundario           │
 * │ 40       │  4   │ 0 (Común)    │ Terciario                         │
 * │ 90       │  9   │ 0            │ Administración (scope, no nivel)   │
 * │ 99       │  9   │ 9            │ Todos (filtro, no nivel)           │
 * └──────────┴──────┴──────────────┴──────────────────────────────────┘
 *
 * Consultas por rango:
 *   WHERE level BETWEEN 20 AND 29  → todo Primario (cualquier modalidad)
 *   WHERE level % 10 = 1           → todo Talleres (cualquier nivel)
 */
export enum LevelType {
  INICIAL = 10,
  TALLERES_INICIAL = 11,
  BILINGÜISMO_INICIAL = 12,

  PRIMARIO = 20,
  TALLERES_PRIMARIO = 21,
  BILINGÜISMO_PRIMARIO = 22,

  SECUNDARIO = 30,
  TALLERES_SECUNDARIO = 31,
  BILINGÜISMO_SECUNDARIO = 32,

  TERCIARIO = 40,

  ADMINISTRACION = 90,
  TODOS = 99,
}

const LABELS: Record<LevelType, string> = {
  [LevelType.INICIAL]: 'Inicial',
  [LevelType.TALLERES_INICIAL]: 'Talleres de Inicial',
  [LevelType.BILINGÜISMO_INICIAL]: 'Bilingüismo Inicial',
  [LevelType.PRIMARIO]: 'Primario',
  [LevelType.TALLERES_PRIMARIO]: 'Talleres de Primario',
  [LevelType.BILINGÜISMO_PRIMARIO]: 'Bilingüismo Primario',
  [LevelType.SECUNDARIO]: 'Secundario',
  [LevelType.TALLERES_SECUNDARIO]: 'Talleres de Secundario',
  [LevelType.BILINGÜISMO_SECUNDARIO]: 'Bilingüismo Secundario',
  [LevelType.TERCIARIO]: 'Terciario',
  [LevelType.ADMINISTRACION]: 'Administración',
  [LevelType.TODOS]: 'Todos',
};

/** Niveles que representan contextos pedagógicos reales */
const PEDAGOGICAL_LEVELS: LevelType[] = [
  LevelType.INICIAL, LevelType.TALLERES_INICIAL, LevelType.BILINGÜISMO_INICIAL,
  LevelType.PRIMARIO, LevelType.TALLERES_PRIMARIO, LevelType.BILINGÜISMO_PRIMARIO,
  LevelType.SECUNDARIO, LevelType.TALLERES_SECUNDARIO, LevelType.BILINGÜISMO_SECUNDARIO,
  LevelType.TERCIARIO,
];

/**
 * Nombre canónico → LevelType (para parseo de strings de API/DB).
 * Soportamos los nombres viejos (INICIAL, PRIMARIO, etc.)
 * y los nuevos compuestos (TALLERES_INICIAL, BILINGÜISMO_PRIMARIO, etc.).
 */
const NAME_TO_TYPE: Record<string, LevelType> = {
  INICIAL: LevelType.INICIAL,
  'TALLERES DE INICIAL': LevelType.TALLERES_INICIAL,
  TALLERES_INICIAL: LevelType.TALLERES_INICIAL,
  'BILINGÜISMO INICIAL': LevelType.BILINGÜISMO_INICIAL,
  BILINGÜISMO_INICIAL: LevelType.BILINGÜISMO_INICIAL,

  PRIMARIO: LevelType.PRIMARIO,
  'TALLERES DE PRIMARIO': LevelType.TALLERES_PRIMARIO,
  TALLERES_PRIMARIO: LevelType.TALLERES_PRIMARIO,
  'BILINGÜISMO PRIMARIO': LevelType.BILINGÜISMO_PRIMARIO,
  BILINGÜISMO_PRIMARIO: LevelType.BILINGÜISMO_PRIMARIO,

  SECUNDARIO: LevelType.SECUNDARIO,
  'TALLERES DE SECUNDARIO': LevelType.TALLERES_SECUNDARIO,
  TALLERES_SECUNDARIO: LevelType.TALLERES_SECUNDARIO,
  'BILINGÜISMO SECUNDARIO': LevelType.BILINGÜISMO_SECUNDARIO,
  BILINGÜISMO_SECUNDARIO: LevelType.BILINGÜISMO_SECUNDARIO,

  TERCIARIO: LevelType.TERCIARIO,

  ADMINISTRACION: LevelType.ADMINISTRACION,
  ADMINISTRACIÓN: LevelType.ADMINISTRACION,
  TODOS: LevelType.TODOS,
};

export class Level {
  private constructor(private readonly value: LevelType) {}

  /**
   * Crea un Level desde un string (nombre canónico) o número (código compuesto).
   *
   * Acepta formatos:
   *   - "INICIAL"     → LevelType.INICIAL (10)
   *   - "TALLERES_INICIAL" → LevelType.TALLERES_INICIAL (11)
   *   - "inicial" (case-insensitive, trimmed)
   *   - "10" o 10     → LevelType.INICIAL
   *   - "32" o 32     → LevelType.BILINGÜISMO_SECUNDARIO
   */
  static create(value: string | number): Result<Level, ValidationError> {
    if (typeof value === 'number') {
      const found = Object.values(LevelType).includes(value as LevelType);
      if (!found) {
        return err(new ValidationError(
          `Invalid level code: ${value}. Valid range: 10-40 (pedagógicos), 90 (admin), 99 (todos)`,
        ));
      }
      return ok(new Level(value as LevelType));
    }

    const normalized = value.toUpperCase().trim();

    // Try numeric string first
    const numeric = parseInt(normalized, 10);
    if (!isNaN(numeric) && Object.values(LevelType).includes(numeric)) {
      return ok(new Level(numeric as LevelType));
    }

    // Try known name
    if (NAME_TO_TYPE[normalized]) {
      return ok(new Level(NAME_TO_TYPE[normalized]));
    }

    // Try by enum key reverse lookup
    for (const [key, code] of Object.entries(LevelType)) {
      if (key === normalized && typeof code === 'number') {
        return ok(new Level(code as LevelType));
      }
    }

    return err(new ValidationError(
      `Invalid pedagogical level: "${value}". Valid: ${Object.keys(NAME_TO_TYPE).join(', ')}`,
    ));
  }

  static reconstruct(value: LevelType): Level {
    return new Level(value);
  }

  /** El código numérico del nivel (ej: 10, 21, 32, 40). */
  get(): LevelType {
    return this.value;
  }

  /** Código numérico como número plano. */
  toCode(): number {
    return this.value as number;
  }

  /** Nombre canónico: "INICIAL", "TALLERES_PRIMARIO", etc. */
  toString(): string {
    return LevelType[this.value];
  }

  /** Etiqueta legible: "Inicial", "Talleres de Primario", etc. */
  toLabel(): string {
    return LABELS[this.value];
  }

  equals(other: Level): boolean {
    return this.value === other.value;
  }

  // ── Descomposición ──────────────────────────────────────────

  /** Código del nivel base (1–4, 9). */
  get levelCode(): EducationalLevelCode {
    return this.educationalLevel.code;
  }

  /** Código de la modalidad (0–2, 9). */
  get modalityCode(): EducationalModalityCode {
    return this.modality.code;
  }

  /** Nivel educativo base (Inicial=1, Primario=2, etc). */
  get educationalLevel(): EducationalLevel {
    return EducationalLevel.fromLevelCode(this.toCode());
  }

  /** Modalidad (Común=0, Talleres=1, Bilingüismo=2, Todos=9). */
  get modality(): EducationalModality {
    return EducationalModality.fromCompositeCode(this.toCode());
  }

  // ── Predicados ──────────────────────────────────────────────

  /** ¿Es un nivel pedagógico real (no ADMINISTRACION ni TODOS)? */
  get isPedagogical(): boolean {
    return PEDAGOGICAL_LEVELS.includes(this.value);
  }

  /** ¿Pertenece al nivel educativo base indicado (ignorando modalidad)? */
  belongsToLevel(levelCode: EducationalLevelCode): boolean {
    return this.educationalLevel.code === levelCode;
  }

  /** ¿Tiene la modalidad indicada? */
  hasModality(modalityCode: EducationalModalityCode): boolean {
    return this.modality.code === modalityCode;
  }

  /** Código compuesto (levelCode, modalityCode) → Level. */
  static fromParts(levelCode: EducationalLevelCode, modalityCode: EducationalModalityCode): Level {
    const composite = levelCode * 10 + modalityCode;
    if (!Object.values(LevelType).includes(composite)) {
      throw new Error(
        `Invalid level composite: ${composite} (level=${levelCode}, modality=${modalityCode}). ` +
        `Must be one of: ${Object.values(LevelType).filter(v => typeof v === 'number').join(', ')}`,
      );
    }
    return new Level(composite as LevelType);
  }

  /** Lista de todos los niveles pedagógicos. */
  static allPedagogical(): Level[] {
    return PEDAGOGICAL_LEVELS.map((lt) => new Level(lt));
  }

  /** Niveles pedagógicos que pertenecen a un nivel base dado. */
  static forLevel(levelCode: EducationalLevelCode): Level[] {
    const base = levelCode * 10;
    return PEDAGOGICAL_LEVELS.filter(
      (lt) => lt >= base && lt < base + 10,
    ).map((lt) => new Level(lt));
  }
}
