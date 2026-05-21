import { BoletínTemplate, DatosBoletin, MateriaBoletin } from './boletin.template';

/**
 * Boletín Nivel SECUNDARIO — notas + condición de previas.
 */
export class BoletínSecundario extends BoletínTemplate {
  titulo(datos: DatosBoletin): string {
    return `Boletín de Calificaciones — ${datos.grado}`;
  }

  formatearMateria(m: MateriaBoletin, _datos: DatosBoletin): string {
    const cond = m.aprobado ? 'APROBADO' : 'PREVIAS';
    return `${m.nombre} | Promedio: ${m.promedio} | Condición: ${cond} | ${m.valoracion}`;
  }

  pieBoletin(datos: DatosBoletin): string {
    return `Período: ${datos.periodo} — Firma del preceptor: ________________ — Firma del director: ________________`;
  }
}
