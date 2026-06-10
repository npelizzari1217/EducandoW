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

/** A single competency already filtered to imprimible=true by the use case. */
export interface CompetencyBoletin {
  competencyName: string;
  /** Grade code for the first imprimible period, or empty string. */
  gradeCode: string;
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
