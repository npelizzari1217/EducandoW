import { describe, it, expect } from 'vitest';
import { ActaExamen } from '../../entities/acta-examen';
import { CondicionExamen } from '../../value-objects/condicion-examen';
import { IntentoFinal } from '../../value-objects/intento-final';

describe('ActaExamen', () => {
  const validProps = {
    materiaCarreraId: 'materia-analisis1',
    fecha: new Date('2026-07-20'),
    presidenteId: 'teacher-1',
    vocales: ['teacher-2', 'teacher-3'],
    libro: 'LIBRO-5',
    folio: 'FOLIO-42',
  };

  describe('create()', () => {
    it('creates an acta with valid data', () => {
      const acta = ActaExamen.create(validProps);

      expect(acta.id.get()).toBeTruthy();
      expect(acta.materiaCarreraId).toBe('materia-analisis1');
      expect(acta.fecha).toEqual(new Date('2026-07-20'));
      expect(acta.presidenteId).toBe('teacher-1');
      expect(acta.vocales).toEqual(['teacher-2', 'teacher-3']);
      expect(acta.libro).toBe('LIBRO-5');
      expect(acta.folio).toBe('FOLIO-42');
      expect(acta.active).toBe(true);
      expect(acta.notas).toEqual([]);
    });

    it('creates without optional libro/folio', () => {
      const acta = ActaExamen.create({
        materiaCarreraId: 'm-1',
        fecha: new Date(),
        presidenteId: 't-1',
        vocales: [],
      });
      expect(acta.libro).toBeUndefined();
      expect(acta.folio).toBeUndefined();
    });
  });

  // ── Spec Scenario: Register exam grade in acta ───────────────

  describe('registrarNota()', () => {
    it('registers a grade for a student', () => {
      const acta = ActaExamen.create(validProps);
      const condicion = CondicionExamen.create('APROBADO');

      acta.registrarNota('student-1', 8, condicion);

      expect(acta.notas).toHaveLength(1);
      expect(acta.notas[0].studentId).toBe('student-1');
      expect(acta.notas[0].nota).toBe(8);
      expect(acta.notas[0].condicion.get()).toBe('APROBADO');
      expect(acta.notas[0].actaId).toBe(acta.id.get());
    });

    it('overwrites existing grade for same student (re-register)', () => {
      const acta = ActaExamen.create(validProps);
      acta.registrarNota('student-1', 4, CondicionExamen.create('DESAPROBADO'));
      // Student retakes, now approved
      acta.registrarNota('student-1', 7, CondicionExamen.create('APROBADO'));

      expect(acta.notas).toHaveLength(1);
      expect(acta.notas[0].nota).toBe(7);
      expect(acta.notas[0].condicion.get()).toBe('APROBADO');
    });

    it('can register multiple grades for different students', () => {
      const acta = ActaExamen.create(validProps);
      acta.registrarNota('s1', 9, CondicionExamen.create('APROBADO'));
      acta.registrarNota('s2', 3, CondicionExamen.create('DESAPROBADO'));
      acta.registrarNota('s3', 0, CondicionExamen.create('AUSENTE'));

      expect(acta.notas).toHaveLength(3);
      expect(acta.notas.map((n) => n.studentId)).toEqual(['s1', 's2', 's3']);
      expect(acta.notas.map((n) => n.condicion.get())).toEqual(['APROBADO', 'DESAPROBADO', 'AUSENTE']);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = ActaExamen.create(validProps);
      const recon = ActaExamen.reconstruct({
        id: created.id,
        materiaCarreraId: created.materiaCarreraId,
        fecha: created.fecha,
        presidenteId: created.presidenteId,
        vocales: created.vocales,
        libro: created.libro,
        folio: created.folio,
        active: false,
        deletedAt: new Date('2026-08-01'),
        notas: [],
      });
      expect(recon.materiaCarreraId).toBe('materia-analisis1');
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete()', () => {
    it('marks acta as inactive', () => {
      const acta = ActaExamen.create(validProps);
      acta.softDelete();
      expect(acta.active).toBe(false);
      expect(acta.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ── T12: intento field in ActaExamenNota ─────────────────────────────────

  describe('registrarNota() with intento', () => {
    it('includes intento field in ActaExamenNota', () => {
      const acta = ActaExamen.create(validProps);
      const condicion = CondicionExamen.create('DESAPROBADO');
      const intento = IntentoFinal.create(1);

      acta.registrarNota('student-1', 4, condicion, intento);

      expect(acta.notas[0].intento).toBeDefined();
      expect(acta.notas[0].intento.get()).toBe(1);
    });

    it('includes intento=2 in second attempt', () => {
      const acta = ActaExamen.create(validProps);
      const intento = IntentoFinal.create(2);

      acta.registrarNota('student-1', 3, CondicionExamen.create('DESAPROBADO'), intento);

      expect(acta.notas[0].intento.get()).toBe(2);
    });
  });

  describe('reconstruct() with intento', () => {
    it('reconstructs correctly when notas have intento', () => {
      const created = ActaExamen.create(validProps);
      const intento = IntentoFinal.create(3);

      const recon = ActaExamen.reconstruct({
        id: created.id,
        materiaCarreraId: created.materiaCarreraId,
        fecha: created.fecha,
        presidenteId: created.presidenteId,
        vocales: created.vocales,
        active: true,
        notas: [
          {
            id: 'nota-1',
            actaId: created.id.get(),
            studentId: 'student-1',
            nota: 4,
            condicion: CondicionExamen.create('DESAPROBADO'),
            intento,
          },
        ],
      });

      expect(recon.notas[0].intento.get()).toBe(3);
    });
  });
});
