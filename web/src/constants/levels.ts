/**
 * Constantes de niveles pedagógicos para el frontend.
 *
 * Uso:
 *   - combos desplegables: LEVEL_OPTIONS
 *   - mostrar label dado un código: LEVEL_LABELS[10] → "Inicial"
 *   - agrupar por nivel base: LEVELS_BY_BASE[EducationalLevelCode.PRIMARIO] → [20, 21, 22]
 *
 * Fuente de verdad: @educandow/domain
 * Los datos se definen localmente (no importamos runtime values por compatibilidad CJS/ESM).
 * Si el catálogo cambia en el dominio, actualizar también acá.
 */

import type { LevelCatalogEntry } from '@educandow/domain';

// ── Re-exported types (backward-compatible aliases) ──────────

/** Re-exported from domain — kept for backward compatibility */
export type LevelOption = LevelCatalogEntry;

// ── Catálogo canónico (debe coincidir con @educandow/domain) ─

export const LEVEL_CATALOG: LevelCatalogEntry[] = [
  { code: 10, name: 'INICIAL',                label: 'Inicial',                levelCode: 1, modalityCode: 0, pedagogical: true },
  { code: 11, name: 'TALLERES_INICIAL',       label: 'Talleres de Inicial',    levelCode: 1, modalityCode: 1, pedagogical: true },
  { code: 12, name: 'BILINGÜISMO_INICIAL',    label: 'Bilingüismo Inicial',    levelCode: 1, modalityCode: 2, pedagogical: true },
  { code: 20, name: 'PRIMARIO',               label: 'Primario',               levelCode: 2, modalityCode: 0, pedagogical: true },
  { code: 21, name: 'TALLERES_PRIMARIO',      label: 'Talleres de Primario',   levelCode: 2, modalityCode: 1, pedagogical: true },
  { code: 22, name: 'BILINGÜISMO_PRIMARIO',   label: 'Bilingüismo Primario',   levelCode: 2, modalityCode: 2, pedagogical: true },
  { code: 30, name: 'SECUNDARIO',             label: 'Secundario',             levelCode: 3, modalityCode: 0, pedagogical: true },
  { code: 31, name: 'TALLERES_SECUNDARIO',    label: 'Talleres de Secundario',  levelCode: 3, modalityCode: 1, pedagogical: true },
  { code: 32, name: 'BILINGÜISMO_SECUNDARIO', label: 'Bilingüismo Secundario',  levelCode: 3, modalityCode: 2, pedagogical: true },
  { code: 40, name: 'TERCIARIO',              label: 'Terciario',              levelCode: 4, modalityCode: 0, pedagogical: true },
  { code: 90, name: 'ADMINISTRACION',         label: 'Administración',         levelCode: 9, modalityCode: 0, pedagogical: false },
  { code: 99, name: 'TODOS',                  label: 'Todos',                  levelCode: 9, modalityCode: 9, pedagogical: false },
];

// ── Lookups ────────────────────────────────────────────────

/** Código → etiqueta legible */
export const LEVEL_LABELS: Record<number, string> = Object.fromEntries(
  LEVEL_CATALOG.map((e) => [e.code, e.label]),
);

/** Solo niveles pedagógicos (para combos de institución y enrollment) */
export const PEDAGOGICAL_LEVELS: LevelCatalogEntry[] = LEVEL_CATALOG.filter((e) => e.pedagogical);

/** Opciones agrupadas por nivel base (para combos con optgroups) */
export const LEVELS_BY_BASE: Record<number, LevelCatalogEntry[]> = {
  1: LEVEL_CATALOG.filter((e) => e.levelCode === 1 && e.pedagogical),
  2: LEVEL_CATALOG.filter((e) => e.levelCode === 2 && e.pedagogical),
  3: LEVEL_CATALOG.filter((e) => e.levelCode === 3 && e.pedagogical),
  4: LEVEL_CATALOG.filter((e) => e.levelCode === 4 && e.pedagogical),
};

/** Helper: dado un código, devuelve la etiqueta o el código como fallback */
export function levelLabel(code: number): string {
  return LEVEL_LABELS[code] ?? String(code);
}
