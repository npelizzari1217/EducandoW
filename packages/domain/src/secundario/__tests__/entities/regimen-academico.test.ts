import { describe, it, expect } from 'vitest';
import { RegimenAcademico } from '../../entities/regimen-academico';

describe('RegimenAcademico', () => {
  const validInput = {
    cursoId: 'curso-5a',
    subjectId: 'subject-math',
    promocionDirecta: true,
    requiereExamenFinal: false,
    notaMinimaAprobacion: 6.0,
  };

  // ── Spec Scenario: Create regimen academico ──────────────────

  describe('create()', () => {
    it('creates a regimen academico with valid data', () => {
      const regimen = RegimenAcademico.create(validInput);

      expect(regimen.id.get()).toBeTruthy();
      expect(regimen.cursoId).toBe('curso-5a');
      expect(regimen.subjectId).toBe('subject-math');
      expect(regimen.promocionDirecta).toBe(true);
      expect(regimen.requiereExamenFinal).toBe(false);
      expect(regimen.notaMinimaAprobacion).toBe(6.0);
    });

    it('creates with different nota minima', () => {
      const regimen = RegimenAcademico.create({
        ...validInput,
        notaMinimaAprobacion: 7.0,
      });
      expect(regimen.notaMinimaAprobacion).toBe(7.0);
    });

    it('creates with promocionDirecta false', () => {
      const regimen = RegimenAcademico.create({
        ...validInput,
        promocionDirecta: false,
        requiereExamenFinal: true,
      });
      expect(regimen.promocionDirecta).toBe(false);
      expect(regimen.requiereExamenFinal).toBe(true);
    });
  });

  describe('update()', () => {
    it('updates promocionDirecta', () => {
      const regimen = RegimenAcademico.create(validInput);
      regimen.update({ promocionDirecta: false });
      expect(regimen.promocionDirecta).toBe(false);
    });

    it('updates requiereExamenFinal', () => {
      const regimen = RegimenAcademico.create(validInput);
      regimen.update({ requiereExamenFinal: true });
      expect(regimen.requiereExamenFinal).toBe(true);
    });

    it('updates notaMinimaAprobacion', () => {
      const regimen = RegimenAcademico.create(validInput);
      regimen.update({ notaMinimaAprobacion: 8.0 });
      expect(regimen.notaMinimaAprobacion).toBe(8.0);
    });

    it('partial update does not affect omitted fields', () => {
      const regimen = RegimenAcademico.create(validInput);
      regimen.update({ notaMinimaAprobacion: 7.5 });
      expect(regimen.promocionDirecta).toBe(true);
      expect(regimen.requiereExamenFinal).toBe(false);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = RegimenAcademico.create(validInput);
      const recon = RegimenAcademico.reconstruct({
        id: created.id,
        cursoId: created.cursoId,
        subjectId: created.subjectId,
        promocionDirecta: created.promocionDirecta,
        requiereExamenFinal: created.requiereExamenFinal,
        notaMinimaAprobacion: created.notaMinimaAprobacion,
      });
      expect(recon.cursoId).toBe('curso-5a');
      expect(recon.notaMinimaAprobacion).toBe(6.0);
    });
  });
});
