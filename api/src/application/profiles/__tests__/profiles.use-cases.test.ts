import { describe, it, expect } from 'vitest';
import { profileToModuleAccess, type ProfilePermissionRow } from '../use-cases/profiles.use-cases';

// ── profileToModuleAccess ─────────────────────────────────

describe('profileToModuleAccess', () => {
  const basePerm = (overrides: Partial<ProfilePermissionRow> = {}): ProfilePermissionRow => ({
    module: { code: 'STUDENTS' },
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canPrint: false,
    ...overrides,
  });

  it('converts READ boolean to READ action', () => {
    const result = profileToModuleAccess([basePerm({ canRead: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['READ'] }]);
  });

  it('converts CREATE boolean to CREATE action', () => {
    const result = profileToModuleAccess([basePerm({ canCreate: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['CREATE'] }]);
  });

  it('converts canEdit boolean to UPDATE action', () => {
    const result = profileToModuleAccess([basePerm({ canEdit: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['UPDATE'] }]);
  });

  it('converts canDelete boolean to DELETE action', () => {
    const result = profileToModuleAccess([basePerm({ canDelete: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['DELETE'] }]);
  });

  it('converts canPrint boolean to PRINT action', () => {
    const result = profileToModuleAccess([basePerm({ canPrint: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['PRINT'] }]);
  });

  it('converts multiple booleans to multiple actions', () => {
    const result = profileToModuleAccess([basePerm({ canRead: true, canCreate: true, canEdit: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE'] }]);
  });

  it('converts all 5 booleans to all 5 actions', () => {
    const result = profileToModuleAccess([basePerm({ canRead: true, canCreate: true, canEdit: true, canDelete: true, canPrint: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] }]);
  });

  it('excludes rows where ALL booleans are false', () => {
    const result = profileToModuleAccess([basePerm()]);
    expect(result).toEqual([]);
  });

  it('handles multiple modules mix of true and false rows', () => {
    const result = profileToModuleAccess([
      basePerm({ module: { code: 'STUDENTS' }, canRead: true }),
      basePerm({ module: { code: 'GRADES' }, canRead: true, canCreate: true }),
      basePerm({ module: { code: 'ATTENDANCE' } }),
    ]);
    expect(result).toEqual([
      { moduleCode: 'STUDENTS', actions: ['READ'] },
      { moduleCode: 'GRADES', actions: ['READ', 'CREATE'] },
    ]);
  });

  it('returns empty array for empty input', () => {
    const result = profileToModuleAccess([]);
    expect(result).toEqual([]);
  });

  it('handles a single module with READ and PRINT', () => {
    const result = profileToModuleAccess([basePerm({ canRead: true, canPrint: true })]);
    expect(result).toEqual([{ moduleCode: 'STUDENTS', actions: ['READ', 'PRINT'] }]);
  });
});
