/**
 * AsistenciaReportingError — error codes for asistencia-mensual PDF generation
 * (PR3c — general and por-materia). Pattern mirrors BoletinError/ConstanciaError.
 */
export class AsistenciaReportingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = 'AsistenciaReportingError';
  }
}
