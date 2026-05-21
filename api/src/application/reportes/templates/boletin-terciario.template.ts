import { BoletínTemplate, DatosBoletin, MateriaBoletin } from './boletin.template';

/**
 * Boletín Nivel TERCIARIO — cuatrimestral + condición de promoción.
 */
export class BoletínTerciario extends BoletínTemplate {
  titulo(datos: DatosBoletin): string {
    return `Analítico Parcial — ${datos.grado}`;
  }

  formatearMateria(m: MateriaBoletin, _datos: DatosBoletin): string {
    return `${m.nombre} | ${m.valoracion} | Promedio: ${m.promedio} | Condición: ${m.aprobado ? 'APROBADO' : 'LIBRE'}`;
  }

  pieBoletin(datos: DatosBoletin): string {
    return `Período: ${datos.periodo} — Firma del jefe de carrera: ________________`;
  }
}
