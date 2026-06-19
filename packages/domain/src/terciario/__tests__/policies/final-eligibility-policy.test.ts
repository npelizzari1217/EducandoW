import { describe, it, expect } from 'vitest';
import { FinalEligibilityPolicy } from '../../policies/final-eligibility-policy';
import { EstadoInscripcion } from '../../value-objects/estado-inscripcion';
import { NotaCursadaTerciario } from '../../entities/nota-cursada-terciario';
import { SlotCursadaTerciario } from '../../value-objects/slot-cursada-terciario';
import { CondicionCursada } from '../../value-objects/condicion-cursada';
import { CondicionExamen } from '../../value-objects/condicion-examen';
import { IntentoFinal } from '../../value-objects/intento-final';

function makeTpSlot(condicion: string): NotaCursadaTerciario {
  return NotaCursadaTerciario.create({
    inscripcionMateriaId: 'insc-1',
    slot: SlotCursadaTerciario.create('TP'),
    condicion: CondicionCursada.create(condicion),
  });
}

describe('FinalEligibilityPolicy.check()', () => {
  describe('Guard: estado no confirmada', () => {
    it.each(['INSCRIPTO', 'CURSANDO'])(
      'returns Err(CursadaNoConfirmadaError) when estado = %s',
      (estado) => {
        const result = FinalEligibilityPolicy.check({
          estado: EstadoInscripcion.create(estado),
          tpSlot: null,
          intentosPrevios: 0,
          llamadosTranscurridos: 0,
          llamadosVencimiento: 5,
        });

        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr().code).toBe('CURSADA_NO_CONFIRMADA');
      },
    );
  });

  describe('Guard: regularidad vencida (NEW — step 2, FR-5.1–FR-5.4)', () => {
    it('Ok when estado=REGULAR, llamadosTranscurridos=0, llamadosVencimiento=5 (Scenario D — NULL path)', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });
      // Should not fire expiry guard; may fail TP or intentos guard — we just check it's not REGULARIDAD_VENCIDA
      expect(result.isErr() && result.unwrapErr().code === 'REGULARIDAD_VENCIDA').toBe(false);
    });

    it('Err(REGULARIDAD_VENCIDA) when estado=REGULAR, llamadosTranscurridos=5, llamadosVencimiento=5 (Scenario E — at-threshold)', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 5,
        llamadosVencimiento: 5,
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('REGULARIDAD_VENCIDA');
    });

    it('guard does NOT fire when llamadosTranscurridos=4, llamadosVencimiento=5 (Scenario F — below threshold)', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 4,
        llamadosVencimiento: 5,
      });
      // Not expired → proceeds; with APROBADO TP and 0 intentos, should be Ok
      expect(result.isOk()).toBe(true);
    });

    it('Ok when estado=REGULAR, llamadosTranscurridos=0, llamadosVencimiento=1 (Scenario G — boundary, count 0 < 1)', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 1,
      });
      expect(result.isErr() && result.unwrapErr().code === 'REGULARIDAD_VENCIDA').toBe(false);
    });

    it('LIBRE with llamadosTranscurridos=99 → ALUMNO_LIBRE (guard step 2 skipped for LIBRE — FR-5.3)', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('LIBRE'),
        tpSlot: null,
        intentosPrevios: 0,
        llamadosTranscurridos: 99,
        llamadosVencimiento: 1,
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('ALUMNO_LIBRE_NO_PUEDE_RENDIR');
    });

    it('REGULARIDAD_VENCIDA fires BEFORE TP check when both conditions met (FR-5.2 order)', () => {
      // expired REGULAR + no TP → expiry fires first, not TP error
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: null,   // no TP
        intentosPrevios: 0,
        llamadosTranscurridos: 5,
        llamadosVencimiento: 5,
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('REGULARIDAD_VENCIDA');
    });
  });

  describe('Guard: estado LIBRE', () => {
    it('returns Err(AlumnoLibreNoPuedeRendirError) when estado = LIBRE', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('LIBRE'),
        tpSlot: null,
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('ALUMNO_LIBRE_NO_PUEDE_RENDIR');
    });
  });

  describe('Guard: TP obligatorio', () => {
    it('returns Err(TpObligatorioFaltanteError) when estado = REGULAR and no TP slot', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: null,
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('TP_OBLIGATORIO_FALTANTE');
    });

    it('returns Err(TpObligatorioFaltanteError) when TP slot condicion = AUSENTE', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('AUSENTE'),
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('TP_OBLIGATORIO_FALTANTE');
    });

    it('returns Err(TpObligatorioFaltanteError) when TP slot condicion = DESAPROBADO', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('DESAPROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('TP_OBLIGATORIO_FALTANTE');
    });
  });

  describe('Guard: límite de intentos', () => {
    it('returns Err(MaxIntentosAlcanzadoError) when intentosPrevios = 3', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 3,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().code).toBe('MAX_INTENTOS_ALCANZADO');
    });
  });

  describe('Success paths', () => {
    it('returns Ok(IntentoFinal(1)) when intentosPrevios = 0', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 0,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().get()).toBe(1);
    });

    it('returns Ok(IntentoFinal(3)) when intentosPrevios = 2', () => {
      const result = FinalEligibilityPolicy.check({
        estado: EstadoInscripcion.create('REGULAR'),
        tpSlot: makeTpSlot('APROBADO'),
        intentosPrevios: 2,
        llamadosTranscurridos: 0,
        llamadosVencimiento: 5,
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().get()).toBe(3);
    });
  });
});

describe('FinalEligibilityPolicy.shouldTransitionToLibre()', () => {
  it('returns true when intento=3 and condicion=DESAPROBADO', () => {
    expect(
      FinalEligibilityPolicy.shouldTransitionToLibre(
        IntentoFinal.create(3),
        CondicionExamen.create('DESAPROBADO'),
      ),
    ).toBe(true);
  });

  it('returns true when intento=3 and condicion=AUSENTE', () => {
    expect(
      FinalEligibilityPolicy.shouldTransitionToLibre(
        IntentoFinal.create(3),
        CondicionExamen.create('AUSENTE'),
      ),
    ).toBe(true);
  });

  it('returns false when intento=2 and condicion=DESAPROBADO', () => {
    expect(
      FinalEligibilityPolicy.shouldTransitionToLibre(
        IntentoFinal.create(2),
        CondicionExamen.create('DESAPROBADO'),
      ),
    ).toBe(false);
  });

  it('returns false when intento=3 and condicion=APROBADO', () => {
    expect(
      FinalEligibilityPolicy.shouldTransitionToLibre(
        IntentoFinal.create(3),
        CondicionExamen.create('APROBADO'),
      ),
    ).toBe(false);
  });
});
