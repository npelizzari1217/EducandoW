import { describe, it, expect } from 'vitest';
import { CalificacionPrimario } from '../../entities/calificacion-primario';

describe('CalificacionPrimario', () => {
  const validInput = {
    studentId: 'student-1',
    gradoId: 'grado-3a',
    subjectId: 'subject-math',
    trimestre: '1T',
    nota: 8.5,
    concepto: 'Muy buen desempeño',
    aprobado: true,
  };

  // ── Spec Scenario: Teacher registers grade ───────────────────

  describe('create()', () => {
    it('creates a calificacion with valid data', () => {
      const r = CalificacionPrimario.create(validInput);
      expect(r.isOk()).toBe(true);

      const cal = r.unwrap();
      expect(cal.id.get()).toBeTruthy();
      expect(cal.studentId).toBe('student-1');
      expect(cal.gradoId).toBe('grado-3a');
      expect(cal.subjectId).toBe('subject-math');
      expect(cal.trimestre.value).toBe('1T');
      expect(cal.nota).toBe(8.5);
      expect(cal.concepto).toBe('Muy buen desempeño');
      expect(cal.aprobado).toBe(true);
    });

    it('creates with each trimestre', () => {
      for (const t of ['1T', '2T', '3T']) {
        const r = CalificacionPrimario.create({ ...validInput, trimestre: t });
        expect(r.isOk()).toBe(true);
        expect(r.unwrap().trimestre.value).toBe(t);
      }
    });

    it('creates with minimum nota (1.0)', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 1.0 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().nota).toBe(1.0);
    });

    it('creates with maximum nota (10.0)', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 10.0 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().nota).toBe(10.0);
    });

    it('creates with aprobado false', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 4, aprobado: false });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().aprobado).toBe(false);
    });
  });

  // ── Spec Scenario: Grade out of range rejected ───────────────

  describe('nota range validation', () => {
    it('rejects nota 0', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 0 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('La nota debe estar entre 1 y 10');
    });

    it('rejects nota 11', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 11 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('La nota debe estar entre 1 y 10');
    });

    it('rejects negative nota', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: -1 });
      expect(r.isErr()).toBe(true);
    });

    it('rejects nota 0.5', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 0.5 });
      expect(r.isErr()).toBe(true);
    });

    it('rejects nota 10.1', () => {
      const r = CalificacionPrimario.create({ ...validInput, nota: 10.1 });
      expect(r.isErr()).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects missing studentId', () => {
      const r = CalificacionPrimario.create({ ...validInput, studentId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('estudiante es requerido');
    });

    it('rejects missing gradoId', () => {
      const r = CalificacionPrimario.create({ ...validInput, gradoId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('grado es requerido');
    });

    it('rejects missing subjectId', () => {
      const r = CalificacionPrimario.create({ ...validInput, subjectId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('materia es requerida');
    });

    it('rejects invalid trimestre', () => {
      const r = CalificacionPrimario.create({ ...validInput, trimestre: '4T' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Trimestre inválido');
    });
  });

  describe('update()', () => {
    it('updates nota within range', () => {
      const cal = CalificacionPrimario.create(validInput).unwrap();
      const result = cal.update({ nota: 9.0, concepto: 'Excelente', aprobado: true });
      expect(result.isOk()).toBe(true);
      expect(cal.nota).toBe(9.0);
      expect(cal.concepto).toBe('Excelente');
      expect(cal.aprobado).toBe(true);
    });

    it('rejects invalid nota on update', () => {
      const cal = CalificacionPrimario.create(validInput).unwrap();
      const result = cal.update({ nota: 11 });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('nota debe estar entre 1 y 10');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = CalificacionPrimario.create(validInput).unwrap();
      const recon = CalificacionPrimario.reconstruct({
        id: created.id,
        studentId: created.studentId,
        gradoId: created.gradoId,
        subjectId: created.subjectId,
        trimestre: created.trimestre,
        nota: created.nota,
        concepto: created.concepto,
        aprobado: created.aprobado,
      });
      expect(recon.nota).toBe(8.5);
      expect(recon.trimestre.value).toBe('1T');
    });
  });
});
