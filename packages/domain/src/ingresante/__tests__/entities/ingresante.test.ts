import { describe, it, expect } from 'vitest';
import { Ingresante } from '../../entities/ingresante';
import { IngresanteStatus } from '../../value-objects/ingresante-status';
import { Id } from '../../../shared/value-objects/id';
import { Level, LevelType } from '../../../institution/value-objects/level';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('Ingresante', () => {
  const validProps = {
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    level: Level.reconstruct(LevelType.SECUNDARIO),
  };

  // ── create ───────────────────────────────────────────────

  it('create returns a valid Ingresante with INSCRIPTO status', () => {
    const result = Ingresante.create(validProps);
    expect(result.isOk()).toBe(true);
    const i = result.unwrap();
    expect(i.firstName).toBe('Juan');
    expect(i.lastName).toBe('Pérez');
    expect(i.dni).toBe('12345678');
    expect(i.status.value).toBe('INSCRIPTO');
    expect(i.level.toString()).toBe('SECUNDARIO');
  });

  it('create generates a UUID id', () => {
    const i = Ingresante.create(validProps).unwrap();
    expect(i.id.get()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('create sets createdAt to current date', () => {
    const i = Ingresante.create(validProps).unwrap();
    expect(i.createdAt).toBeInstanceOf(Date);
  });

  it('create defaults optional fields to undefined', () => {
    const i = Ingresante.create(validProps).unwrap();
    expect(i.birthDate).toBeUndefined();
    expect(i.address).toBeUndefined();
    expect(i.phone).toBeUndefined();
    expect(i.email).toBeUndefined();
    expect(i.cycleId).toBeUndefined();
    expect(i.deletedAt).toBeUndefined();
  });

  it('create accepts optional fields when provided', () => {
    const birthDate = new Date('2005-06-15');
    const cycleId = Id.create();
    const i = Ingresante.create({
      ...validProps,
      birthDate,
      address: 'Av. Siempre Viva 742',
      phone: '1122334455',
      email: 'juan@example.com',
      cycleId,
    }).unwrap();
    expect(i.birthDate).toBe(birthDate);
    expect(i.address).toBe('Av. Siempre Viva 742');
    expect(i.phone).toBe('1122334455');
    expect(i.email).toBe('juan@example.com');
    expect(i.cycleId?.get()).toBe(cycleId.get());
  });

  // ── create validation ────────────────────────────────────

  it('create rejects empty firstName', () => {
    const result = Ingresante.create({ ...validProps, firstName: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('firstName');
  });

  it('create rejects whitespace-only firstName', () => {
    const result = Ingresante.create({ ...validProps, firstName: '   ' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('firstName');
  });

  it('create rejects empty lastName', () => {
    const result = Ingresante.create({ ...validProps, lastName: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('lastName');
  });

  it('create rejects empty dni', () => {
    const result = Ingresante.create({ ...validProps, dni: '' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('dni');
  });

  // ── reconstruct ─────────────────────────────────────────

  it('reconstruct round-trips all required fields', () => {
    const id = Id.create();
    const now = new Date();
    const i = Ingresante.reconstruct({
      id,
      firstName: 'Ana',
      lastName: 'García',
      dni: '98765432',
      level: Level.reconstruct(LevelType.PRIMARIO),
      status: IngresanteStatus.reconstruct('ACEPTADO'),
      createdAt: now,
    });
    expect(i.id.get()).toBe(id.get());
    expect(i.firstName).toBe('Ana');
    expect(i.lastName).toBe('García');
    expect(i.dni).toBe('98765432');
    expect(i.status.value).toBe('ACEPTADO');
    expect(i.level.toString()).toBe('PRIMARIO');
    expect(i.createdAt).toBe(now);
  });

  it('reconstruct preserves optional fields', () => {
    const birthDate = new Date('2006-01-20');
    const deletedAt = new Date();
    const cycleId = Id.create();
    const i = Ingresante.reconstruct({
      id: Id.create(),
      firstName: 'Luis',
      lastName: 'Ramos',
      dni: '11111111',
      level: Level.reconstruct(LevelType.INICIAL),
      status: IngresanteStatus.reconstruct('INGRESO'),
      createdAt: new Date(),
      birthDate,
      address: 'Calle 1',
      phone: '555-0001',
      email: 'luis@test.com',
      cycleId,
      deletedAt,
    });
    expect(i.birthDate).toBe(birthDate);
    expect(i.address).toBe('Calle 1');
    expect(i.phone).toBe('555-0001');
    expect(i.email).toBe('luis@test.com');
    expect(i.cycleId?.get()).toBe(cycleId.get());
    expect(i.deletedAt).toBe(deletedAt);
  });

  // ── status transitions ───────────────────────────────────

  it('setStatus changes the status', () => {
    const i = Ingresante.create(validProps).unwrap();
    expect(i.status.value).toBe('INSCRIPTO');
    i.setStatus(IngresanteStatus.reconstruct('PAGO_MATRICULA'));
    expect(i.status.value).toBe('PAGO_MATRICULA');
  });

  it('markIngreso sets status to INGRESO', () => {
    const i = Ingresante.create(validProps).unwrap();
    i.markIngreso();
    expect(i.status.value).toBe('INGRESO');
  });

  it('markNoIngresara sets status to NO_INGRESARA', () => {
    const i = Ingresante.create(validProps).unwrap();
    i.markNoIngresara();
    expect(i.status.value).toBe('NO_INGRESARA');
  });

  it('setStatus can transition through all states', () => {
    const i = Ingresante.create(validProps).unwrap();
    const statuses = ['PAGO_MATRICULA', 'ACEPTADO', 'INGRESO'] as const;
    for (const s of statuses) {
      i.setStatus(IngresanteStatus.reconstruct(s));
      expect(i.status.value).toBe(s);
    }
  });
});
