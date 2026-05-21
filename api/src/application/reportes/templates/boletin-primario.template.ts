import { BoletínTemplate, DatosBoletin, MateriaBoletin } from './boletin.template';

/**
 * Boletín Nivel PRIMARIO — notas 1-10 por trimestre.
 */
export class BoletínPrimario extends BoletínTemplate {
  titulo(datos: DatosBoletin): string {
    return `Boletín de Calificaciones — ${datos.grado}`;
  }

  formatearMateria(m: MateriaBoletin, _datos: DatosBoletin): string {
    const notas = m.notas.map((n) => `${n.periodo}: ${n.valor}`).join(' | ');
    return `${m.nombre} — ${notas} — Promedio: ${m.promedio} — ${m.valoracion}`;
  }

  pieBoletin(datos: DatosBoletin): string {
    return `Período: ${datos.periodo} — Firma del docente: ________________ — Firma del director: ________________`;
  }
}
