/**
 * asistencia-totals — pure aggregator for the "asistencia mensual" print
 * (general and por-materia). Zero external dependencies, mirrors calendar-utils.
 * Satisfies: REQ-P2-6, REQ-P2-7 (ADR-06, ADR-07)
 *
 * Reusable identically for "general" and "por materia" scope — both callers pass
 * the same shape (a student's day→code map + the AttendanceType catalog for the level).
 */
import { AttendanceBehaviorValue } from '../../attendance-type/value-objects/attendance-behavior';

/** Minimal catalog projection needed for aggregation: behavior + weighted absenceValue. */
export interface AttendanceTypeCatalogEntry {
  behavior: AttendanceBehaviorValue;
  absenceValue: number;
}

export type AttendanceTypeCatalog = Map<string, AttendanceTypeCatalogEntry>;

/** The six weighted totals per student, per ADR-06 formula. */
export interface StudentAttendanceTotals {
  tardesJust: number;
  tardesInj: number;
  totalTardes: number;
  ausJust: number;
  ausInj: number;
  ausTotal: number;
}

/** Behaviors that mark a calendar day as NOT a día hábil (ADR-07). */
const NON_HABIL_BEHAVIORS = new Set<AttendanceBehaviorValue>([
  AttendanceBehaviorValue.NO_ELEGIBLE,
  AttendanceBehaviorValue.DIA_NO_HABIL,
]);

/**
 * Computes the six weighted totals (Σ absenceValue grouped by behavior) for a
 * single student's day-map, given the AttendanceType catalog for the level.
 *
 * `days`: day→code record (e.g. DayMap.toJSON()), any subset of "1".."31".
 * `catalog`: code→{behavior, absenceValue}, built by the caller from
 * `attendanceType.findMany({ level })`.
 *
 * Defensive: an empty/blank day-map, or a day code missing from the catalog,
 * never throws — it simply contributes 0 to every total (P2-9 / edge cases).
 */
export function computeStudentTotals(
  days: Record<string, string>,
  catalog: AttendanceTypeCatalog,
): StudentAttendanceTotals {
  let tardesJust = 0;
  let tardesInj = 0;
  let ausJust = 0;
  let ausInj = 0;

  for (const code of Object.values(days)) {
    const entry = catalog.get(code);
    if (!entry) continue;

    switch (entry.behavior) {
      case AttendanceBehaviorValue.TARDE_JUSTIFICADA:
        tardesJust += entry.absenceValue;
        break;
      case AttendanceBehaviorValue.TARDE_INJUSTIFICADA:
        tardesInj += entry.absenceValue;
        break;
      case AttendanceBehaviorValue.AUSENTE_JUSTIFICADO:
        ausJust += entry.absenceValue;
        break;
      case AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO:
        ausInj += entry.absenceValue;
        break;
      default:
        // NO_ELEGIBLE, NO_COMPUTA, DIA_NO_HABIL — contribute to none of the six totals.
        break;
    }
  }

  return {
    tardesJust,
    tardesInj,
    totalTardes: tardesJust + tardesInj,
    ausJust,
    ausInj,
    ausTotal: ausJust + ausInj,
  };
}

/**
 * Computes días hábiles for the month at course level: daysInMonth − days
 * classified as NO_ELEGIBLE (calendar SAB/DOM/X) or DIA_NO_HABIL (feriado).
 *
 * Uses a `Set` of day indices (1..daysInMonth) so a day whose single code maps
 * to either non-hábil behavior is only ever counted once — a day can only carry
 * one code, so this is inherently double-count-safe (ADR-07 / P2-6).
 *
 * Only evaluates indices `1..daysInMonth`: extra grid columns beyond the real
 * month length (rendered as "X" by the web grid) are ignored (P2-10).
 */
export function computeDiasHabiles(
  daysInMonth: number,
  dayCodes: Record<string, string>,
  catalog: AttendanceTypeCatalog,
): number {
  const nonHabilDays = new Set<number>();

  for (let day = 1; day <= daysInMonth; day++) {
    const code = dayCodes[String(day)];
    if (!code) continue;

    const entry = catalog.get(code);
    if (!entry) continue;

    if (NON_HABIL_BEHAVIORS.has(entry.behavior)) {
      nonHabilDays.add(day);
    }
  }

  return daysInMonth - nonHabilDays.size;
}
