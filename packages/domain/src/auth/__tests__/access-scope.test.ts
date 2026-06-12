import { describe, it, expect } from 'vitest';
import { resolveAccessScope } from '../access-scope';

describe('resolveAccessScope', () => {
  it('ROOT: isAdministrative=true, allLevels=true', () => {
    const scope = resolveAccessScope({ roles: ['ROOT'] });
    expect(scope.isAdministrative).toBe(true);
    expect(scope.allLevels).toBe(true);
  });

  it('ROOT with levels: compositeLevels reflects user.levels', () => {
    const scope = resolveAccessScope({ roles: ['ROOT'], levels: [10, 20] });
    expect(scope.allLevels).toBe(true);
    expect(scope.compositeLevels).toEqual([10, 20]);
  });

  it('ROOT without levels: compositeLevels=[]', () => {
    const scope = resolveAccessScope({ roles: ['ROOT'] });
    expect(scope.compositeLevels).toEqual([]);
  });

  it('ADMIN: isAdministrative=true, allLevels=true', () => {
    const scope = resolveAccessScope({ roles: ['ADMIN'], levels: [] });
    expect(scope.isAdministrative).toBe(true);
    expect(scope.allLevels).toBe(true);
  });

  it('DIRECTOR with levels=[50]: isAdministrative=true, allLevels=false, compositeLevels=[50]', () => {
    const scope = resolveAccessScope({ roles: ['DIRECTOR'], levels: [50] });
    expect(scope.isAdministrative).toBe(true);
    expect(scope.allLevels).toBe(false);
    expect(scope.compositeLevels).toEqual([50]);
  });

  it('SECRETARIO with levels=[20,30]: isAdministrative=true, allLevels=false, compositeLevels=[20,30]', () => {
    const scope = resolveAccessScope({ roles: ['SECRETARIO'], levels: [20, 30] });
    expect(scope.isAdministrative).toBe(true);
    expect(scope.allLevels).toBe(false);
    expect(scope.compositeLevels).toEqual([20, 30]);
  });

  it('PRECEPTOR: isAdministrative=false, allLevels=false', () => {
    const scope = resolveAccessScope({ roles: ['PRECEPTOR'], levels: [20] });
    expect(scope.isAdministrative).toBe(false);
    expect(scope.allLevels).toBe(false);
  });

  it('TEACHER: isAdministrative=false, allLevels=false', () => {
    const scope = resolveAccessScope({ roles: ['TEACHER'], levels: [20] });
    expect(scope.isAdministrative).toBe(false);
    expect(scope.allLevels).toBe(false);
  });

  it('TUTOR: isAdministrative=false, allLevels=false', () => {
    const scope = resolveAccessScope({ roles: ['TUTOR'], levels: [10] });
    expect(scope.isAdministrative).toBe(false);
    expect(scope.allLevels).toBe(false);
  });

  it('STUDENT: isAdministrative=false, allLevels=false', () => {
    const scope = resolveAccessScope({ roles: ['STUDENT'] });
    expect(scope.isAdministrative).toBe(false);
    expect(scope.allLevels).toBe(false);
  });

  it('empty roles []: isAdministrative=false, allLevels=false, compositeLevels=[]', () => {
    const scope = resolveAccessScope({ roles: [] });
    expect(scope.isAdministrative).toBe(false);
    expect(scope.allLevels).toBe(false);
    expect(scope.compositeLevels).toEqual([]);
  });

  it('levels undefined: compositeLevels defaults to []', () => {
    const scope = resolveAccessScope({ roles: ['DIRECTOR'] });
    expect(scope.compositeLevels).toEqual([]);
  });
});
