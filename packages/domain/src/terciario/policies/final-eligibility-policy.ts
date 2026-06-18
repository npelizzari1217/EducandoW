import { ok, err, Result } from '../../shared/result';
import { EstadoInscripcion } from '../value-objects/estado-inscripcion';
import { IntentoFinal } from '../value-objects/intento-final';
import { CondicionExamen } from '../value-objects/condicion-examen';
import { NotaCursadaTerciario } from '../entities/nota-cursada-terciario';
import { DomainError } from '../../shared/errors/domain-error';
import { CursadaNoConfirmadaError } from '../errors/cursada-no-confirmada.error';
import { AlumnoLibreNoPuedeRendirError } from '../errors/alumno-libre-no-puede-rendir.error';
import { TpObligatorioFaltanteError } from '../errors/tp-obligatorio-faltante.error';
import { MaxIntentosAlcanzadoError } from '../errors/max-intentos-alcanzado.error';
import { RegularidadVencidaError } from '../errors/regularidad-vencida.error';

export class FinalEligibilityPolicy {
  /**
   * Pure guard — no I/O. Returns Ok(IntentoFinal) when the student can sit the exam.
   *
   * Guard evaluation order (spec FR-5.2):
   * 1. estado not confirmed (null/INSCRIPTO/CURSANDO) → CURSADA_NO_CONFIRMADA
   * 2. estado = REGULAR AND llamadosTranscurridos >= llamadosVencimiento → REGULARIDAD_VENCIDA
   * 3. estado = LIBRE → ALUMNO_LIBRE_NO_PUEDE_RENDIR
   * 4. TP faltante or AUSENTE → TP_OBLIGATORIO_FALTANTE
   * 5. intentosPrevios >= 3 → MAX_INTENTOS_ALCANZADO
   * 6. OK → return IntentoFinal = intentosPrevios + 1
   */
  static check(input: {
    estado: EstadoInscripcion;
    tpSlot: NotaCursadaTerciario | null;
    intentosPrevios: number;
    llamadosTranscurridos: number;
    llamadosVencimiento: number;
  }): Result<IntentoFinal, DomainError> {
    const { estado, tpSlot, intentosPrevios, llamadosTranscurridos, llamadosVencimiento } = input;

    // 1. Not confirmed
    if (!estado.esConfirmada()) {
      return err(new CursadaNoConfirmadaError());
    }

    // 2. Regularidad vencida (only for REGULAR estado — FR-5.3)
    if (estado.esRegular() && llamadosTranscurridos >= llamadosVencimiento) {
      return err(new RegularidadVencidaError());
    }

    // 3. LIBRE cannot sit exam
    if (estado.esLibre()) {
      return err(new AlumnoLibreNoPuedeRendirError());
    }

    // 4. TP obligatorio faltante o no aprobado [SUPUESTO]
    if (!tpSlot || tpSlot.condicion.get() !== 'APROBADO') {
      return err(new TpObligatorioFaltanteError());
    }

    // 5. Límite de 3 intentos
    if (intentosPrevios >= 3) {
      return err(new MaxIntentosAlcanzadoError());
    }

    // 6. OK — assign next intento
    return ok(IntentoFinal.create((intentosPrevios + 1) as 1 | 2 | 3));
  }

  /**
   * Returns true when the student must transition to LIBRE after this attempt.
   * Condition: 3rd attempt AND condicion is DESAPROBADO or AUSENTE.
   */
  static shouldTransitionToLibre(
    intento: IntentoFinal,
    condicion: CondicionExamen,
  ): boolean {
    return intento.get() === 3 && condicion.get() !== 'APROBADO';
  }
}
