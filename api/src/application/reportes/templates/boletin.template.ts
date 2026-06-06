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

export interface MateriaBoletin {
  nombre: string;
  docente: string;
  notas: { periodo: string; valor: string }[];
  promedio: string;
  valoracion: string;
  aprobado: boolean;
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
