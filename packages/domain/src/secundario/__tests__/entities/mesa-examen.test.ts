import { describe, it, expect } from 'vitest';
import { MesaExamen } from '../../entities/mesa-examen';
import { TurnoExamen } from '../../value-objects/turno-examen';

describe('MesaExamen', () => {
  const validInput = {
    subjectId: 'subject-math',
    fecha: new Date('2026-12-15'),
    turno: TurnoExamen.reconstruct('DICIEMBRE'),
    presidenteId: 'teacher-1',
  };

  // ── Spec Scenario: Create exam board ─────────────────────────

  describe('create()', () => {
    it('creates a mesa de examen with valid data', () => {
      const mesa = MesaExamen.create(validInput);

      expect(mesa.id.get()).toBeTruthy();
      expect(mesa.subjectId).toBe('subject-math');
      expect(mesa.fecha).toEqual(new Date('2026-12-15'));
      expect(mesa.turno.get()).toBe('DICIEMBRE');
      expect(mesa.presidenteId).toBe('teacher-1');
      expect(mesa.active).toBe(true);
      expect(mesa.inscripciones).toEqual([]);
    });

    it('creates with turno FEBRERO', () => {
      const mesa = MesaExamen.create({
        ...validInput,
        turno: TurnoExamen.reconstruct('FEBRERO'),
      });
      expect(mesa.turno.get()).toBe('FEBRERO');
    });

    it('starts with empty inscripciones', () => {
      const mesa = MesaExamen.create(validInput);
      expect(mesa.inscripciones).toHaveLength(0);
    });
  });

  // ── Spec Scenario: Inscribir alumno en mesa ──────────────────

  describe('inscribirAlumno()', () => {
    it('inscribes a student', () => {
      const mesa = MesaExamen.create(validInput);
      mesa.inscribirAlumno('student-1');
      expect(mesa.inscripciones).toHaveLength(1);
      expect(mesa.inscripciones[0].studentId).toBe('student-1');
      expect(mesa.inscripciones[0].mesaId).toBe(mesa.id.get());
    });

    it('does not duplicate an already inscribed student', () => {
      const mesa = MesaExamen.create(validInput);
      mesa.inscribirAlumno('student-1');
      mesa.inscribirAlumno('student-1');
      expect(mesa.inscripciones).toHaveLength(1);
    });

    it('can inscribe multiple students', () => {
      const mesa = MesaExamen.create(validInput);
      mesa.inscribirAlumno('student-1');
      mesa.inscribirAlumno('student-2');
      mesa.inscribirAlumno('student-3');
      expect(mesa.inscripciones).toHaveLength(3);
      expect(mesa.inscripciones.map((i) => i.studentId)).toEqual([
        'student-1',
        'student-2',
        'student-3',
      ]);
    });

    it('inscripciones returns a copy to protect immutability', () => {
      const mesa = MesaExamen.create(validInput);
      mesa.inscribirAlumno('student-1');
      const insc = mesa.inscripciones;
      insc.push({
        id: {} as any,
        mesaId: 'x',
        studentId: 'hacker',
      });
      expect(mesa.inscripciones).toHaveLength(1);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with all fields', () => {
      const created = MesaExamen.create(validInput);
      const recon = MesaExamen.reconstruct({
        id: created.id,
        subjectId: created.subjectId,
        fecha: created.fecha,
        turno: created.turno,
        presidenteId: created.presidenteId,
        active: false,
        deletedAt: new Date('2026-10-01'),
        inscripciones: [],
      });
      expect(recon.subjectId).toBe('subject-math');
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });

    it('reconstructs with inscripciones', () => {
      const created = MesaExamen.create(validInput);
      created.inscribirAlumno('student-1');
      const recon = MesaExamen.reconstruct({
        id: created.id,
        subjectId: created.subjectId,
        fecha: created.fecha,
        turno: created.turno,
        presidenteId: created.presidenteId,
        active: true,
        inscripciones: created.inscripciones,
      });
      expect(recon.inscripciones).toHaveLength(1);
    });
  });

  describe('softDelete()', () => {
    it('marks mesa as inactive', () => {
      const mesa = MesaExamen.create(validInput);
      mesa.softDelete();
      expect(mesa.active).toBe(false);
      expect(mesa.deletedAt).toBeInstanceOf(Date);
    });
  });
});
