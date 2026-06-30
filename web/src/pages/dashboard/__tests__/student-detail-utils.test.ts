/**
 * Fix 10 — deriveDetailStudent: read fatherEmail/motherEmail from already-loaded list row.
 *
 * Before the fix: opening a student detail fires an extra GET /students/:id to populate
 * detailStudent.fatherEmail / detailStudent.motherEmail for the guardian email pre-fill.
 * After the fix: the data is read directly from the already-loaded adminData list row.
 *
 * The pure derivation logic is extracted to student-detail.utils.ts and tested here.
 */
import { describe, it, expect } from 'vitest';
import { deriveDetailStudent } from '../student-detail.utils';

// ── Fix 10 tests ────────────────────────────────────────────────────────────────

describe('deriveDetailStudent (Fix 10)', () => {
  it('returns fatherEmail and motherEmail from the matching list row', () => {
    const data = [
      { id: 's1', firstName: 'Juan', lastName: 'Pérez', fatherEmail: 'papa@test.com', motherEmail: 'mama@test.com' },
      { id: 's2', firstName: 'Ana', lastName: 'Gómez' },
    ];
    const result = deriveDetailStudent(data, 's1');
    expect(result?.fatherEmail).toBe('papa@test.com');
    expect(result?.motherEmail).toBe('mama@test.com');
  });

  it('returns undefined for emails when the row has no email fields', () => {
    const data = [{ id: 's1', firstName: 'Juan', lastName: 'Pérez' }];
    const result = deriveDetailStudent(data, 's1');
    expect(result?.fatherEmail).toBeUndefined();
    expect(result?.motherEmail).toBeUndefined();
  });

  it('coerces null fatherEmail to undefined', () => {
    const data = [{ id: 's1', fatherEmail: null, motherEmail: null }];
    const result = deriveDetailStudent(data, 's1');
    expect(result?.fatherEmail).toBeUndefined();
    expect(result?.motherEmail).toBeUndefined();
  });

  it('returns null when studentId is not in the list', () => {
    const data = [{ id: 's1', firstName: 'Juan' }];
    expect(deriveDetailStudent(data, 'not-found')).toBeNull();
  });

  it('returns null when adminData is undefined', () => {
    expect(deriveDetailStudent(undefined, 's1')).toBeNull();
  });

  it('picks the correct row when multiple students are loaded', () => {
    const data = [
      { id: 's1', fatherEmail: 'papa1@test.com' },
      { id: 's2', fatherEmail: 'papa2@test.com' },
    ];
    expect(deriveDetailStudent(data, 's2')?.fatherEmail).toBe('papa2@test.com');
  });
});
