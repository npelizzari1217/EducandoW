import { BoletínTemplate, DatosBoletin, MateriaBoletin } from './boletin.template';

/**
 * Boletín Nivel INICIAL — valoraciones cualitativas por área de desarrollo.
 * No tiene notas numéricas, solo observaciones.
 */
export class BoletínInicial extends BoletínTemplate {
  titulo(datos: DatosBoletin): string {
    return `Informe Evolutivo — ${datos.institucionNombre}`;
  }

  formatearMateria(m: MateriaBoletin, _datos: DatosBoletin): string {
    return `Área: ${m.nombre} | Docente: ${m.docente} | Valoración: ${m.valoracion}`;
  }

  pieBoletin(datos: DatosBoletin): string {
    return `Período: ${datos.periodo} — Firma del docente: ________________`;
  }
}
