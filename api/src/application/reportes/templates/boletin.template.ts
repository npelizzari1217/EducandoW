import type { SlotCursadaTerciarioValue } from '@educandow/domain';

/**
 * Template Method — Estructura común de boletín.
 * Cada nivel pedagógico implementa sus hooks específicos.
 */
export interface AsistenciaBoletin {
  /** Total de días / clases registradas */
  totalDias: number;
  /** Días presentes (isPresent = true) */
  diasPresente: number;
  /** Inasistencias completas (absenceValue = 1) */
  inasistencias: number;
  /** Inasistencias medias (absenceValue = 0.5) */
  mediasFaltas: number;
  /** Porcentaje de asistencia, e.g. "87.5" */
  porcentaje: string;
}

export interface MesaExamenBoletin {
  /** Nombre de la materia */
  materia: string;
  /** Turno del examen: "DICIEMBRE" | "FEBRERO" */
  turno: string;
  /** Fecha formateada dd/mm/aaaa */
  fecha: string;
  /** Nota obtenida, o "—" si no rindió / ausente */
  nota: string;
  /** Condición final: "APROBADO" | "DESAPROBADO" | "AUSENTE" */
  condicion: string;
  /** True cuando condicionFinal === 'APROBADO', para helpers Handlebars */
  aprobada: boolean;
}

/**
 * A single materia previa (academic debt) record for the Secundario boletín.
 * Only populated by buildMateriasSecundario. Undefined for all other levels.
 */
export interface PreviaBoletin {
  /** Name of the owed subject (resolved from Subject.name at boletín generation time). */
  subjectName: string;
  /** The academic year the debt originated from (e.g. "2024"). */
  originAcademicYear: string;
  /** How the debt arose: "PREVIA" or "LIBRE" (SubjectFinalGradeCondicion string value). */
  condicion: string;
  /** Current resolution state: "PENDIENTE" | "APROBADA" | "LIBRE" (MateriaPreviaStatus string value). */
  status: string;
}

// ── Inicial-specific sub-types ─────────────────────────────────────────────────

/** One área de desarrollo inside an InformeEvolutivo (Inicial only). */
export interface AreaInicialBoletin {
  /** Free string — enum deferred (P1). E.g. "SOCIO_AFECTIVA". */
  nombre: string;
  /** Qualitative narrative — the key Inicial field. */
  observacion: string;
  /** "DESTACADO" | "LOGRADO" | "EN_PROCESO" | "NO_LOGRADO" (free string — VO deferred P3). */
  valoracion: string;
}

/** One trimestre informe evolutivo for the Inicial boletín. */
export interface InformeInicialBoletin {
  periodo: string;                  // "1T" | "2T" | "3T"
  fecha: string;                    // dd/mm/aaaa
  observacionesGenerales?: string;  // optional
  areas: AreaInicialBoletin[];
}

export interface DatosBoletin {
  alumnoNombre: string;
  alumnoApellido: string;
  alumnoDni: string;
  institucionNombre: string;
  nivel: string;
  grado: string;
  periodo: string;
  materias: MateriaBoletin[];
  /** Resumen de asistencia. Undefined cuando no hay registros o no aplica. */
  asistencia?: AsistenciaBoletin;
  /** Mesas de examen del alumno. Solo para nivel SECUNDARIO. Undefined o vacío cuando no aplica. */
  mesasExamen?: MesaExamenBoletin[];
  /**
   * Materias previas (academic debts) for the student.
   * Only populated by the Secundario branch (buildMateriasSecundario).
   * Undefined for Primario / Terciario / Inicial — {{#if previas}} guards no-op.
   */
  previas?: PreviaBoletin[];
  /**
   * Informes evolutivos del alumno (todos los trimestres disponibles), ordenados 1T→2T→3T.
   * Only populated by buildMateriasInicial (level decade 1).
   * Undefined for Primario/Secundario/Terciario — {{#if informesInicial}} no-ops cleanly.
   */
  informesInicial?: InformeInicialBoletin[];
  /**
   * Carrera name for the Terciario boletín header (REQ-6).
   * Resolved from InscripcionMateria → MateriaCarrera → Carrera.name; falls back to
   * enrollment.grade; null when both are absent. Undefined for all other levels.
   */
  carreraName?: string | null;
  /**
   * Materias grouped by cuatrimestre for the Terciario transcript layout (REQ-7).
   * Sorted 1C → 2C → ANUAL/other. Undefined for all other levels.
   */
  cuatrimestresTerciario?: GrupoCuatrimestreBoletin[];
}

// ── Terciario-specific sub-types (optional fields on MateriaBoletin / DatosBoletin) ──

/** One slot in the cursada grading grid (canonical 5-slot order, REQ-3). */
export interface SlotCursadaBoletin {
  slot: SlotCursadaTerciarioValue;
  nota: number | null;  // null → blank in template
}

/** One final exam attempt for a Terciario materia (REQ-5). */
export interface IntentoFinalBoletin {
  intento: number;
  nota: number;
  condicion: string;  // "Aprobado" | "Desaprobado" | "Ausente"
}

/** Materias grouped by cuatrimestre for the Terciario boletín render (REQ-7). */
export interface GrupoCuatrimestreBoletin {
  cuatrimestre: string;  // "1C" | "2C" | "ANUAL"
  materias: MateriaBoletin[];
}

// ── Primario-specific sub-types (optional fields on MateriaBoletin) ────────────

/** One period column in the Primario grading grid (dynamic — from SubjectGradingPeriod snapshot). */
export interface PeriodGradeBoletin {
  periodOrdinal: number;
  /** Human-readable name captured at snapshot time (e.g. "1° Trimestre"). */
  periodName: string;
  /** Alphanumeric grade code, or empty string when not yet graded. */
  gradeCode: string;
}

/** One of the four final grade instances (FINAL / DICIEMBRE / MARZO / DEFINITIVA). */
export interface FinalGradeBoletin {
  /** SubjectFinalGradeType string value. */
  type: string;
  /** Alphanumeric grade code, or empty string when the row is absent. */
  gradeCode: string;
}

/** A competency filtered to imprimible=true by the use case, with one grade slot per boletín period column. */
export interface CompetencyBoletin {
  competencyName: string;
  /**
   * One entry per boletín period column (index-aligned with the materia's periodGrades array).
   * gradeCode is '' when the period is not imprimible for this competency.
   * Populated by buildMateriasPrimario only (Primario branch).
   */
  periodGrades: Array<{ gradeCode: string }>;
}

/** OR-aggregated pedagogical flags across all reported periods for a subject. */
export interface FlagsBoletin {
  pa: boolean;
  ppi: boolean;
  pp: boolean;
}

// ── Core MateriaBoletin type ───────────────────────────────────────────────────

export interface MateriaBoletin {
  nombre: string;
  docente: string;
  notas: { periodo: string; valor: string }[];
  promedio: string;
  valoracion: string;
  aprobado: boolean;
  /**
   * Dynamic period columns from SubjectGradingPeriod snapshot.
   * Only populated by the Primario branch. Undefined for all other levels —
   * non-Primario templates MUST NOT crash when this is absent.
   */
  periodGrades?: PeriodGradeBoletin[];
  /**
   * Four final grade instances (FINAL / DICIEMBRE / MARZO / DEFINITIVA).
   * Absent instance → gradeCode is '' (blank). Only populated for Primario.
   */
  finalGrades?: FinalGradeBoletin[];
  /**
   * Competencies already filtered by imprimible=true at the use-case level.
   * Only populated for Primario.
   */
  competencies?: CompetencyBoletin[];
  /**
   * OR-aggregated pedagogical flags across all reported periods per subject.
   * Only populated for Primario.
   */
  flags?: FlagsBoletin;
  /**
   * Year-end verdict for this subject (REGULAR | PREVIA | LIBRE).
   * Populated by the Secundario branch. Null when no FINAL/DEFINITIVA condicion exists.
   * Undefined for Primario / Terciario / Inicial — {{#if condicion}} guards no-op.
   */
  condicion?: string | null;
  /**
   * Fixed 5-slot array in canonical order: PARCIAL_1, PARCIAL_2, RECUPERATORIO_PARCIAL_1,
   * RECUPERATORIO_PARCIAL_2, TP. nota is null when no record exists for that slot.
   * Only populated by the Terciario branch (REQ-3).
   */
  slotsCursada?: SlotCursadaBoletin[];
  /**
   * Confirmed cursada grade from InscripcionMateria.notaCursada.
   * Null when no confirmed grade exists. Only populated for Terciario (REQ-4).
   */
  notaCursadaConfirmada?: number | null;
  /**
   * Human-readable cursada state label (e.g. "Regular", "Cursando").
   * Null only when estado is unmappable. Only populated for Terciario (REQ-4).
   */
  condicionCursada?: string | null;
  /**
   * All-time final exam attempts for this materia.
   * Empty array when no records exist. Only populated for Terciario (REQ-5).
   */
  intentosFinales?: IntentoFinalBoletin[];
  /**
   * Cuatrimestre assignment for this materia ("1C" | "2C" | "ANUAL").
   * Used as the grouping key in cuatrimestresTerciario. Only present for Terciario.
   */
  cuatrimestre?: string;
}

export interface BoletinResultado {
  titulo: string;
  secciones: BoletinSeccion[];
}

export interface BoletinSeccion {
  encabezado: string;
  cuerpo: string[];
  pie: string;
}

/**
 * BoletínTemplate abstracto — define la estructura fija (template method).
 * Subclases por nivel sobrescriben los métodos hook.
 */
export abstract class BoletínTemplate {
  generar(datos: DatosBoletin): BoletinResultado {
    return {
      titulo: this.titulo(datos),
      secciones: [
        {
          encabezado: this.encabezadoInstitucion(datos),
          cuerpo: [this.datosAlumno(datos)],
          pie: '',
        },
        {
          encabezado: 'Calificaciones',
          cuerpo: this.cuerpoMaterias(datos),
          pie: this.pieBoletin(datos),
        },
      ],
    };
  }

  /** Hook: título del boletín (difiere por nivel) */
  abstract titulo(datos: DatosBoletin): string;

  /** Template: encabezado institucional (común pero overridable) */
  protected encabezadoInstitucion(datos: DatosBoletin): string {
    return `${datos.institucionNombre} — Nivel ${datos.nivel}`;
  }

  /** Template: datos del alumno (común) */
  protected datosAlumno(datos: DatosBoletin): string {
    return `Alumno: ${datos.alumnoApellido}, ${datos.alumnoNombre} | DNI: ${datos.alumnoDni} | ${datos.grado} | ${datos.periodo}`;
  }

  /** Template: tabla de materias (común, formatea según nivel) */
  protected cuerpoMaterias(datos: DatosBoletin): string[] {
    return datos.materias.map((m) =>
      this.formatearMateria(m, datos),
    );
  }

  /** Hook: formatea una materia individual */
  abstract formatearMateria(materia: MateriaBoletin, datos: DatosBoletin): string;

  /** Hook: pie del boletín (firmas, observaciones) */
  abstract pieBoletin(datos: DatosBoletin): string;
}
