import { describe, it, expect } from 'vitest';
import { InscripcionMateria } from '../../entities/inscripcion-materia';
import { EstadoInscripcion } from '../../value-objects/estado-inscripcion';

describe('InscripcionMateria', () => {
  const estadoInscripto = EstadoInscripcion.create('INSCRIPTO');

  const validProps = {
    studentId: 'student-1',
    materiaCarreraId: 'materia-analisis2',
    cuatrimestre: '1C',
    anioAcademico: '2026',
    estado: estadoInscripto,
  };

  describe('create()', () => {
    it('creates an inscripcion with valid data', () => {
      const insc = InscripcionMateria.create(validProps);

      expect(insc.id.get()).toBeTruthy();
      expect(insc.studentId).toBe('student-1');
      expect(insc.materiaCarreraId).toBe('materia-analisis2');
      expect(insc.cuatrimestre).toBe('1C');
      expect(insc.anioAcademico).toBe('2026');
      expect(insc.estado.get()).toBe('INSCRIPTO');
    });

    it('defaults notaCursada and notaFinal to undefined', () => {
      const insc = InscripcionMateria.create(validProps);
      expect(insc.notaCursada).toBeUndefined();
      expect(insc.notaFinal).toBeUndefined();
    });
  });

  // ── Spec Scenario: Enroll with prerequisites met ─────────────

  describe('validarCorrelativas() — prerequisites met', () => {
    it('succeeds when all FINAL correlativas are approved', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'materia-analisis2', correlativaId: 'materia-analisis1', tipo: 'FINAL' },
        ],
        new Set(['materia-analisis1']),   // aprobadas
        new Set(['materia-analisis1']),   // regulares (incluye aprobadas)
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(true);
    });

    it('succeeds when all CURSADA correlativas are regularized', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'materia-2', correlativaId: 'materia-1', tipo: 'CURSADA' },
        ],
        new Set<string>(),                        // aprobadas
        new Set(['materia-1']),                   // regulares
      );
      expect(result.isOk()).toBe(true);
    });

    it('succeeds with no correlativas required', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas([], new Set(), new Set());
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(true);
    });

    it('succeeds with mixed CORRADA and FINAL met', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'm3', correlativaId: 'm1', tipo: 'FINAL' },
          { id: 'corr-2', materiaId: 'm3', correlativaId: 'm2', tipo: 'CURSADA' },
        ],
        new Set(['m1']),                   // aprobadas
        new Set(['m1', 'm2']),             // regulares (m2 regularizada, m1 aprobada)
      );
      expect(result.isOk()).toBe(true);
    });
  });

  // ── Spec Scenario: Enroll with unmet prerequisites rejected ──

  describe('validarCorrelativas() — unmet prerequisites', () => {
    it('fails when a FINAL correlativa is not approved', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'materia-analisis2', correlativaId: 'materia-analisis1', tipo: 'FINAL' },
        ],
        new Set<string>(),   // nada aprobada
        new Set<string>(),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Correlativa FINAL no cumplida');
      expect(result.unwrapErr().message).toContain('materia-analisis1');
    });

    it('fails when a CURSADA correlativa is not regularized', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'm2', correlativaId: 'm1', tipo: 'CURSADA' },
        ],
        new Set<string>(),
        new Set<string>(),  // nada regularizada
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Correlativa CURSADA no cumplida');
    });

    it('fails when only one of multiple correlativas is met', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'm3', correlativaId: 'm1', tipo: 'FINAL' },
          { id: 'corr-2', materiaId: 'm3', correlativaId: 'm2', tipo: 'FINAL' },
        ],
        new Set(['m1']),        // solo una aprobada
        new Set(['m1', 'm2']),
      );
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Correlativa FINAL no cumplida');
    });

    it('fails when tipo is FINAL and only CURSADA is met', () => {
      const insc = InscripcionMateria.create(validProps);
      const result = insc.validarCorrelativas(
        [
          { id: 'corr-1', materiaId: 'm2', correlativaId: 'm1', tipo: 'FINAL' },
        ],
        new Set<string>(),         // no aprobada
        new Set(['m1']),           // pero sí regularizada
      );
      // La correlativa FINAL pide que esté en materiasAprobadas, no en regulares
      expect(result.isErr()).toBe(true);
    });
  });

  describe('updateEstado()', () => {
    it('updates estado to CURSANDO', () => {
      const insc = InscripcionMateria.create(validProps);
      insc.updateEstado(EstadoInscripcion.create('CURSANDO'));
      expect(insc.estado.get()).toBe('CURSANDO');
    });

    it('updates estado to APROBADO', () => {
      const insc = InscripcionMateria.create(validProps);
      insc.updateEstado(EstadoInscripcion.create('APROBADO'));
      expect(insc.estado.get()).toBe('APROBADO');
    });
  });

  describe('updateNotas()', () => {
    it('updates notas', () => {
      const insc = InscripcionMateria.create(validProps);
      insc.updateNotas(7, 8);
      expect(insc.notaCursada).toBe(7);
      expect(insc.notaFinal).toBe(8);
    });

    it('updates only notaCursada', () => {
      const insc = InscripcionMateria.create(validProps);
      insc.updateNotas(6);
      expect(insc.notaCursada).toBe(6);
      expect(insc.notaFinal).toBeUndefined();
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = InscripcionMateria.create(validProps);
      const recon = InscripcionMateria.reconstruct({
        id: created.id,
        studentId: created.studentId,
        materiaCarreraId: created.materiaCarreraId,
        cuatrimestre: created.cuatrimestre,
        anioAcademico: created.anioAcademico,
        estado: created.estado,
        notaCursada: 7,
        notaFinal: 9,
      });
      expect(recon.studentId).toBe('student-1');
      expect(recon.notaCursada).toBe(7);
      expect(recon.notaFinal).toBe(9);
    });
  });
});
