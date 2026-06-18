import { describe, it, expect } from 'vitest';
import { LlamadoExamen } from '../../entities/llamado-examen';
import { InvalidLlamadoRangeError } from '../../errors/invalid-llamado-range.error';
import { Id } from '../../../shared/value-objects/id';
import { RangoFechas } from '../../value-objects/rango-fechas';

const validInput = {
  nombre: 'Julio 2025',
  anioAcademico: '2025',
  fechaInicio: new Date('2025-07-01'),
  fechaFin: new Date('2025-07-15'),
};

describe('LlamadoExamen', () => {
  describe('create()', () => {
    it('returns ok with all fields set; active=true, deletedAt undefined', () => {
      const result = LlamadoExamen.create(validInput);
      expect(result.isOk()).toBe(true);
      const entity = result.unwrap();
      expect(entity.id.get()).toBeTruthy();
      expect(entity.nombre).toBe('Julio 2025');
      expect(entity.anioAcademico).toBe('2025');
      expect(entity.fechaInicio).toEqual(new Date('2025-07-01'));
      expect(entity.fechaFin).toEqual(new Date('2025-07-15'));
      expect(entity.active).toBe(true);
      expect(entity.deletedAt).toBeUndefined();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('returns err(InvalidLlamadoRangeError) when fechaInicio > fechaFin', () => {
      const result = LlamadoExamen.create({
        ...validInput,
        fechaInicio: new Date('2025-07-15'),
        fechaFin: new Date('2025-07-01'),
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidLlamadoRangeError);
    });
  });

  describe('update()', () => {
    it('updates nombre and refreshes updatedAt', async () => {
      const entity = LlamadoExamen.create(validInput).unwrap();
      const before = entity.updatedAt;
      await new Promise((r) => setTimeout(r, 2)); // ensure time difference
      const result = entity.update({ nombre: 'Nuevo Nombre' });
      expect(result.isOk()).toBe(true);
      expect(entity.nombre).toBe('Nuevo Nombre');
      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('returns err(InvalidLlamadoRangeError) when new fechaInicio > fechaFin', () => {
      const entity = LlamadoExamen.create(validInput).unwrap();
      const result = entity.update({
        fechaInicio: new Date('2025-08-01'),
        fechaFin: new Date('2025-07-01'),
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(InvalidLlamadoRangeError);
    });

    it('updates fechaFin with valid range', () => {
      const entity = LlamadoExamen.create(validInput).unwrap();
      const result = entity.update({ fechaFin: new Date('2025-07-20') });
      expect(result.isOk()).toBe(true);
      expect(entity.fechaFin).toEqual(new Date('2025-07-20'));
    });
  });

  describe('softDelete()', () => {
    it('sets active=false and deletedAt to a Date', () => {
      const entity = LlamadoExamen.create(validInput).unwrap();
      entity.softDelete();
      expect(entity.active).toBe(false);
      expect(entity.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs entity with exact props (no validation)', () => {
      const rango = RangoFechas.create(new Date('2025-07-01'), new Date('2025-07-15')).unwrap();
      const now = new Date();
      const props = {
        id: Id.reconstruct('test-id-123'),
        nombre: 'Julio 2025',
        anioAcademico: '2025',
        rango,
        active: false,
        deletedAt: new Date('2025-08-01'),
        createdAt: now,
        updatedAt: now,
      };
      const entity = LlamadoExamen.reconstruct(props);
      expect(entity.id.get()).toBe('test-id-123');
      expect(entity.nombre).toBe('Julio 2025');
      expect(entity.active).toBe(false);
      expect(entity.deletedAt).toEqual(new Date('2025-08-01'));
    });
  });
});
