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
    cycleId: Id.create(),
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

  // ── transitionTo ─────────────────────────────────────────

  it('transitionTo returns ok(void) on valid transition and mutates state', () => {
    const i = Ingresante.create(validProps).unwrap();
    expect(i.status.value).toBe('INSCRIPTO');
    const result = i.transitionTo(IngresanteStatus.reconstruct('PAGO_MATRICULA'));
    expect(result.isOk()).toBe(true);
    expect(i.status.value).toBe('PAGO_MATRICULA');
  });

  it('transitionTo returns err(ValidationError) on skip and does not mutate state', () => {
    const i = Ingresante.create(validProps).unwrap();
    const result = i.transitionTo(IngresanteStatus.reconstruct('ACEPTADO')); // skip
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('INSCRIPTO');
    expect(result.unwrapErr().message).toContain('ACEPTADO');
    expect(i.status.value).toBe('INSCRIPTO'); // unchanged
  });

  it('transitionTo returns err(ValidationError) on backward transition and does not mutate state', () => {
    const i = Ingresante.reconstruct({
      id: Id.create(),
      firstName: 'A',
      lastName: 'B',
      dni: '12345678',
      level: Level.reconstruct(LevelType.PRIMARIO),
      status: IngresanteStatus.reconstruct('PAGO_MATRICULA'),
      createdAt: new Date(),
    });
    const result = i.transitionTo(IngresanteStatus.reconstruct('INSCRIPTO'));
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(i.status.value).toBe('PAGO_MATRICULA'); // unchanged
  });

  it('transitionTo returns err(ValidationError) from terminal state', () => {
    const terminal = Ingresante.reconstruct({
      id: Id.create(),
      firstName: 'A',
      lastName: 'B',
      dni: '12345678',
      level: Level.reconstruct(LevelType.PRIMARIO),
      status: IngresanteStatus.reconstruct('INGRESO'),
      createdAt: new Date(),
    });
    const result = terminal.transitionTo(IngresanteStatus.reconstruct('INSCRIPTO'));
    expect(result.isErr()).toBe(true);
    expect(terminal.status.value).toBe('INGRESO'); // unchanged
  });

  // ── markIngreso ──────────────────────────────────────────

  it('markIngreso returns ok(void) when status is ACEPTADO and transitions to INGRESO', () => {
    const i = Ingresante.reconstruct({
      id: Id.create(),
      firstName: 'A',
      lastName: 'B',
      dni: '12345678',
      level: Level.reconstruct(LevelType.PRIMARIO),
      status: IngresanteStatus.reconstruct('ACEPTADO'),
      createdAt: new Date(),
    });
    const result = i.markIngreso();
    expect(result.isOk()).toBe(true);
    expect(i.status.value).toBe('INGRESO');
  });

  it.each(['INSCRIPTO', 'PAGO_MATRICULA', 'INGRESO', 'NO_INGRESARA'] as const)(
    'markIngreso returns err(ValidationError) when status is %s',
    (status) => {
      const i = Ingresante.reconstruct({
        id: Id.create(),
        firstName: 'A',
        lastName: 'B',
        dni: '12345678',
        level: Level.reconstruct(LevelType.PRIMARIO),
        status: IngresanteStatus.reconstruct(status),
        createdAt: new Date(),
      });
      const result = i.markIngreso();
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(i.status.value).toBe(status); // unchanged
    },
  );

  // ── reconstruct: non-retroactive (D2) ───────────────────

  it('reconstruct accepts any status without validating (SC-SM-10 / D2)', () => {
    // A legacy record could be ACEPTADO without having gone through PAGO_MATRICULA.
    // reconstruct() must not validate the state machine history.
    const legacy = Ingresante.reconstruct({
      id: Id.create(),
      firstName: 'Legacy',
      lastName: 'Record',
      dni: '99999999',
      level: Level.reconstruct(LevelType.PRIMARIO),
      status: IngresanteStatus.reconstruct('ACEPTADO'),
      createdAt: new Date(),
    });
    expect(legacy.status.value).toBe('ACEPTADO');
    // And future transitions from this reconstructed state follow the rules
    const transition = legacy.transitionTo(IngresanteStatus.reconstruct('NO_INGRESARA'));
    expect(transition.isOk()).toBe(true);
    expect(legacy.status.value).toBe('NO_INGRESARA');
  });
});
