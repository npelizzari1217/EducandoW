import { describe, it, expect } from 'vitest';
import { NotaCursadaTerciario } from '../../entities/nota-cursada-terciario';
import { SlotCursadaTerciario } from '../../value-objects/slot-cursada-terciario';
import { CondicionCursada } from '../../value-objects/condicion-cursada';
import { Id } from '../../../shared/value-objects/id';

describe('NotaCursadaTerciario', () => {
  const slot = SlotCursadaTerciario.create('PARCIAL_1');
  const condicion = CondicionCursada.create('APROBADO');

  describe('create()', () => {
    it('creates entity with required props', () => {
      const entity = NotaCursadaTerciario.create({
        inscripcionMateriaId: 'insc-1',
        slot,
        condicion,
      });

      expect(entity.id.get()).toBeTruthy();
      expect(entity.inscripcionMateriaId).toBe('insc-1');
      expect(entity.slot.get()).toBe('PARCIAL_1');
      expect(entity.condicion.get()).toBe('APROBADO');
      expect(entity.nota).toBeUndefined();
      expect(entity.fecha).toBeUndefined();
      expect(entity.creadoAt).toBeInstanceOf(Date);
      expect(entity.actualizadoAt).toBeInstanceOf(Date);
    });

    it('creates entity with nota and fecha (optional fields)', () => {
      const entity = NotaCursadaTerciario.create({
        inscripcionMateriaId: 'insc-1',
        slot,
        condicion,
        nota: 8.5,
        fecha: '2026-06-10',
      });

      expect(entity.nota).toBe(8.5);
      expect(entity.fecha).toBe('2026-06-10');
    });

    it('creates with nota: undefined and fecha: undefined (optional)', () => {
      const entity = NotaCursadaTerciario.create({
        inscripcionMateriaId: 'insc-1',
        slot,
        condicion,
        nota: undefined,
        fecha: undefined,
      });

      expect(entity.nota).toBeUndefined();
      expect(entity.fecha).toBeUndefined();
    });
  });

  describe('reconstruct()', () => {
    it('restores entity without side effects', () => {
      const id = Id.create();
      const now = new Date();

      const entity = NotaCursadaTerciario.reconstruct({
        id,
        inscripcionMateriaId: 'insc-42',
        slot,
        condicion,
        nota: 7,
        fecha: '2026-07-01',
        creadoAt: now,
        actualizadoAt: now,
      });

      expect(entity.id.get()).toBe(id.get());
      expect(entity.inscripcionMateriaId).toBe('insc-42');
      expect(entity.nota).toBe(7);
      expect(entity.fecha).toBe('2026-07-01');
      expect(entity.creadoAt).toBe(now);
      expect(entity.actualizadoAt).toBe(now);
    });
  });

  describe('getters', () => {
    it('returns all props correctly', () => {
      const entity = NotaCursadaTerciario.create({
        inscripcionMateriaId: 'insc-99',
        slot: SlotCursadaTerciario.create('TP'),
        condicion: CondicionCursada.create('DESAPROBADO'),
        nota: 3,
        fecha: '2026-05-15',
      });

      expect(entity.slot.get()).toBe('TP');
      expect(entity.condicion.get()).toBe('DESAPROBADO');
    });
  });
});
