/**
 * Unit tests for the backfill-user-persona script logic.
 * Tests the buildPersonaUpdate function that enforces idempotency (UP-S5).
 *
 * Integration tests (UP-S3, UP-S4, UP-S6) require a real DB and are outside
 * the scope of unit tests. They will be validated via the migration + script run.
 */
import { describe, it, expect } from 'vitest';
import { buildPersonaUpdate } from '../../../../scripts/backfill-user-persona';

describe('buildPersonaUpdate (UP-S5 — backfill idempotency)', () => {
  const teacherFull = {
    firstName: 'Luis',
    lastName: 'Pérez',
    dni: '30000001',
    title: 'Prof.',
    phone: '351-100',
  };

  // F1-T3: segunda ejecución no sobreescribe campos ya poblados
  it('returns all fields when User has no persona data', () => {
    const user = {
      firstName: null,
      lastName: null,
      dni: null,
      title: null,
      phone: null,
    };
    const update = buildPersonaUpdate(user, teacherFull);
    expect(update.firstName).toBe('Luis');
    expect(update.lastName).toBe('Pérez');
    expect(update.dni).toBe('30000001');
    expect(update.title).toBe('Prof.');
    expect(update.phone).toBe('351-100');
  });

  // UP-S5: campos ya poblados no se sobreescriben
  it('does NOT overwrite fields already populated in User', () => {
    const user = {
      firstName: 'Ana',    // already set — should not be overwritten
      lastName: null,
      dni: '99999999',     // already set — different value from Teacher
      title: null,
      phone: null,
    };
    const update = buildPersonaUpdate(user, teacherFull);
    expect(update.firstName).toBeUndefined(); // not overwritten
    expect(update.lastName).toBe('Pérez');    // filled from teacher
    expect(update.dni).toBeUndefined();        // not overwritten (User value wins — UP-S6)
    expect(update.title).toBe('Prof.');
    expect(update.phone).toBe('351-100');
  });

  // UP-S5: segunda corrida → todos ya poblados → update vacío
  it('returns empty update when all User persona fields are already set (idempotency)', () => {
    const user = {
      firstName: 'Luis',
      lastName: 'Pérez',
      dni: '30000001',
      title: 'Prof.',
      phone: '351-100',
    };
    const update = buildPersonaUpdate(user, teacherFull);
    expect(Object.keys(update)).toHaveLength(0);
  });

  // UP-S5: Teacher con campos opcionales null → no se copian
  it('does not set fields that are null/undefined in Teacher', () => {
    const teacher = {
      firstName: 'Luis',
      lastName: 'Pérez',
      dni: '30000001',
      title: null,   // not set
      phone: null,   // not set
    };
    const user = {
      firstName: null,
      lastName: null,
      dni: null,
      title: null,
      phone: null,
    };
    const update = buildPersonaUpdate(user, teacher);
    expect(update.firstName).toBe('Luis');
    expect(update.lastName).toBe('Pérez');
    expect(update.dni).toBe('30000001');
    expect(update.title).toBeUndefined(); // Teacher had null → not copied
    expect(update.phone).toBeUndefined(); // Teacher had null → not copied
  });

  // UP-S6 via idempotency: User value with different title than Teacher → User wins
  it('User title wins over Teacher title when User already has a value (UP-S6)', () => {
    const user = {
      firstName: 'Luis',
      lastName: 'Pérez',
      dni: '30000001',
      title: 'Mg.',  // updated post-migration — takes precedence
      phone: null,
    };
    const teacher = {
      firstName: 'Luis',
      lastName: 'Pérez',
      dni: '30000001',
      title: 'Lic.',  // stale value — must NOT overwrite User
      phone: '351-100',
    };
    const update = buildPersonaUpdate(user, teacher);
    expect(update.title).toBeUndefined(); // Mg. (User) wins over Lic. (Teacher)
    expect(update.phone).toBe('351-100'); // phone was null → filled from teacher
  });
});
