import { describe, it, expect } from 'vitest';
import { Titulo } from '../../entities/titulo';
import { EstadoTitulo } from '../../value-objects/estado-titulo';

describe('Titulo', () => {
  // ── Spec Scenario: Create title in process (bonus) ───────────

  describe('create()', () => {
    it('creates a titulo in EN_TRAMITE state', () => {
      const titulo = Titulo.create({
        studentId: 'student-1',
        carreraId: 'carrera-prof-mat',
        estado: EstadoTitulo.create('EN_TRAMITE'),
      });

      expect(titulo.id.get()).toBeTruthy();
      expect(titulo.studentId).toBe('student-1');
      expect(titulo.carreraId).toBe('carrera-prof-mat');
      expect(titulo.estado.get()).toBe('EN_TRAMITE');
      expect(titulo.fechaEgreso).toBeUndefined();
      expect(titulo.fechaEmision).toBeUndefined();
      expect(titulo.nroRegistro).toBeUndefined();
    });

    it('creates with optional fechaEgreso', () => {
      const fecha = new Date('2026-03-15');
      const titulo = Titulo.create({
        studentId: 'student-2',
        carreraId: 'carrera-2',
        estado: EstadoTitulo.create('EN_TRAMITE'),
        fechaEgreso: fecha,
      });
      expect(titulo.fechaEgreso).toEqual(fecha);
    });
  });

  describe('updateEstado()', () => {
    it('transitions from EN_TRAMITE to EMITIDO', () => {
      const titulo = Titulo.create({
        studentId: 'student-1',
        carreraId: 'carrera-1',
        estado: EstadoTitulo.create('EN_TRAMITE'),
      });
      titulo.updateEstado(EstadoTitulo.create('EMITIDO'));
      expect(titulo.estado.get()).toBe('EMITIDO');
    });

    it('transitions to ENTREGADO', () => {
      const titulo = Titulo.create({
        studentId: 'student-1',
        carreraId: 'carrera-1',
        estado: EstadoTitulo.create('EMITIDO'),
      });
      titulo.updateEstado(EstadoTitulo.create('ENTREGADO'));
      expect(titulo.estado.get()).toBe('ENTREGADO');
    });
  });

  describe('emitir()', () => {
    it('updates estado to EMITIDO, sets nroRegistro and fechaEmision', () => {
      const titulo = Titulo.create({
        studentId: 'student-1',
        carreraId: 'carrera-1',
        estado: EstadoTitulo.create('EN_TRAMITE'),
      });

      const beforeCall = new Date();
      titulo.emitir('REG-2026-001');

      expect(titulo.estado.get()).toBe('EMITIDO');
      expect(titulo.nroRegistro).toBe('REG-2026-001');
      expect(titulo.fechaEmision).toBeInstanceOf(Date);
      expect(titulo.fechaEmision!.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = Titulo.create({
        studentId: 'student-1',
        carreraId: 'carrera-1',
        estado: EstadoTitulo.create('EN_TRAMITE'),
        fechaEgreso: new Date('2026-06-01'),
      });
      const recon = Titulo.reconstruct({
        id: created.id,
        studentId: created.studentId,
        carreraId: created.carreraId,
        estado: created.estado,
        fechaEgreso: created.fechaEgreso,
        fechaEmision: new Date('2026-07-01'),
        nroRegistro: 'REG-001',
      });
      expect(recon.studentId).toBe('student-1');
      expect(recon.estado.get()).toBe('EN_TRAMITE');
      expect(recon.nroRegistro).toBe('REG-001');
      expect(recon.fechaEmision).toEqual(new Date('2026-07-01'));
    });
  });
});
