/**
 * Constantes de `AttendanceBehavior` para el frontend (PR2 — asistencia-behavior-e-impresion).
 *
 * Fuente de verdad: @educandow/domain (packages/domain/src/attendance-type/value-objects/attendance-behavior.ts)
 * Los valores string se definen localmente (no importamos runtime values del barrel del
 * dominio en el web — mismo criterio que web/src/constants/levels.ts) pero DEBEN coincidir
 * 1:1 con `AttendanceBehaviorValue` en el dominio/Prisma. Si el catálogo cambia allá,
 * actualizar también acá.
 */

export interface AttendanceBehaviorOption {
  value: string;
  label: string;
}

// ── Catálogo canónico (debe coincidir con AttendanceBehaviorValue) ──────────

export const ATTENDANCE_BEHAVIOR_OPTIONS: AttendanceBehaviorOption[] = [
  { value: 'AUSENTE_INJUSTIFICADO', label: 'Ausente Injustificado' },
  { value: 'AUSENTE_JUSTIFICADO', label: 'Ausente Justificado' },
  { value: 'NO_ELEGIBLE', label: 'No elegible (no aparece en la grilla diaria)' },
  { value: 'NO_COMPUTA', label: 'No computa ausentismo (ej. Presente)' },
  { value: 'TARDE_INJUSTIFICADA', label: 'Tarde Injustificada' },
  { value: 'TARDE_JUSTIFICADA', label: 'Tarde Justificada' },
  { value: 'DIA_NO_HABIL', label: 'Día no hábil (Feriado)' },
];

/** Valor que excluye un tipo del combo de la grilla diaria (REQ-P1-6). */
export const NO_ELEGIBLE_BEHAVIOR = 'NO_ELEGIBLE';

/** Código → etiqueta legible */
export const ATTENDANCE_BEHAVIOR_LABELS: Record<string, string> = Object.fromEntries(
  ATTENDANCE_BEHAVIOR_OPTIONS.map((o) => [o.value, o.label]),
);

/** Helper: dado un valor, devuelve la etiqueta o el valor crudo como fallback */
export function attendanceBehaviorLabel(value: string): string {
  return ATTENDANCE_BEHAVIOR_LABELS[value] ?? value;
}
