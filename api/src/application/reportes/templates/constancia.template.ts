/**
 * Data contract for the constancia de alumno regular PDF template.
 * All MUST fields are required; SHOULD/optional fields are null when absent.
 */
export interface DatosConstancia {
  // ── Group B: Alumno ────────────────────────────────────────────────────────
  alumnoApellido: string;
  alumnoNombre: string;
  alumnoDni: string;

  // ── Group A: Institución ────────────────────────────────────────────────────
  institucionNombre: string;
  cue?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  logoDataUri?: string | null;

  // ── Group C: Académico ──────────────────────────────────────────────────────
  nivel: string;
  grado?: string | null;
  division?: string | null;
  cicloLectivo: string;

  // ── Group D: Validación ─────────────────────────────────────────────────────
  destinatario: string;
  fechaEmisionLarga: string;
}

/**
 * Typed error for constancia generation failures.
 * Mirror of BoletinError — keeps error handling symmetrical in the controller.
 */
export class ConstanciaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = 'ConstanciaError';
  }
}
