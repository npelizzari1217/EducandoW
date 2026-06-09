// ─── Props ────────────────────────────────────────────────────────────────────

export interface PedagogicalFlagsInput {
  pa?: boolean;
  ppi?: boolean;
  pp?: boolean;
}

// ─── Value Object ─────────────────────────────────────────────────────────────

/**
 * Immutable value object grouping the three pedagogical condition flags.
 * PA  — Proyecto Asistido
 * PPI — Proyecto Pedagógico Individual
 * PP  — Proyecto en Proceso
 *
 * Granularity: per (student, courseCycle, subject, periodOrdinal) — stored
 * as three Boolean columns on SubjectPeriodGrade (AD-3).
 */
export class PedagogicalFlags {
  private constructor(
    private readonly _pa: boolean,
    private readonly _ppi: boolean,
    private readonly _pp: boolean,
  ) {}

  // ── Factories ──────────────────────────────────────────────────────────────

  /** All flags false. */
  static none(): PedagogicalFlags {
    return new PedagogicalFlags(false, false, false);
  }

  /** Construct with explicit values; omitted fields default to false. */
  static with(input: PedagogicalFlagsInput): PedagogicalFlags {
    return new PedagogicalFlags(
      input.pa ?? false,
      input.ppi ?? false,
      input.pp ?? false,
    );
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get pa(): boolean { return this._pa; }
  get ppi(): boolean { return this._ppi; }
  get pp(): boolean { return this._pp; }

  // ── Equality ──────────────────────────────────────────────────────────────

  equals(other: PedagogicalFlags): boolean {
    return this._pa === other._pa && this._ppi === other._ppi && this._pp === other._pp;
  }
}
