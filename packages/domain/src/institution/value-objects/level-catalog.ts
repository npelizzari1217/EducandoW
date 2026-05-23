import { Level, LevelType } from './level';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';

/**
 * Entrada del catálogo de niveles — un nivel con todos sus metadatos.
 * Sirve tanto para el endpoint GET /v1/levels como para constantes del frontend.
 */
export interface LevelCatalogEntry {
  /** Código compuesto (10-40, 90, 99) */
  code: LevelType;
  /** Nombre canónico: "INICIAL", "TALLERES_PRIMARIO" */
  name: string;
  /** Etiqueta legible: "Inicial", "Talleres de Primario" */
  label: string;
  /** Código del nivel base (1-4, 9) */
  levelCode: EducationalLevelCode;
  /** Código de la modalidad (0-2, 9) */
  modalityCode: EducationalModalityCode;
  /** ¿Es un nivel pedagógico real? (excluye ADMINISTRACION, TODOS) */
  pedagogical: boolean;
}

/**
 * Catálogo canónico de todos los niveles del sistema.
 * Fuente única de verdad — cualquier cambio de niveles se hace acá.
 */
export const LEVEL_CATALOG: LevelCatalogEntry[] = Level.allPedagogical()
  .map((l): LevelCatalogEntry => ({
    code: l.get(),
    name: l.toString(),
    label: l.toLabel(),
    levelCode: l.educationalLevel.code,
    modalityCode: l.modality.code,
    pedagogical: l.isPedagogical,
  }))
  .concat([
    {
      code: LevelType.ADMINISTRACION,
      name: 'ADMINISTRACION',
      label: 'Administración',
      levelCode: EducationalLevelCode.ADMINISTRACION,
      modalityCode: EducationalModalityCode.COMUN,
      pedagogical: false,
    },
    {
      code: LevelType.TODOS,
      name: 'TODOS',
      label: 'Todos',
      levelCode: EducationalLevelCode.ADMINISTRACION,
      modalityCode: EducationalModalityCode.TODOS,
      pedagogical: false,
    },
  ]);

/** Lookup rápido: código → etiqueta */
export const LEVEL_LABELS: Record<number, string> = Object.fromEntries(
  LEVEL_CATALOG.map((e) => [e.code, e.label]),
);

/** Lookup rápido: código → nombre canónico */
export const LEVEL_NAMES: Record<number, string> = Object.fromEntries(
  LEVEL_CATALOG.map((e) => [e.code, e.name]),
);
