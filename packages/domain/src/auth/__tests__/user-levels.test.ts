import { describe, it, expect } from 'vitest';
import { User } from '../entities/user';
import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';

describe('User educational levels', () => {
  const validProps = {
    email: Email.reconstruct('levels@test.com'),
    name: 'Levels User',
    passwordHash: 'hashed123',
    roles: ['TEACHER'],
  };

  it('create user with levels array', () => {
    const user = User.create({
      ...validProps,
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
      ],
    });

    const userLevels = user.levels;
    expect(userLevels).toHaveLength(2);
    expect(userLevels[0]).toEqual({
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });
    expect(userLevels[1]).toEqual({
      level: EducationalLevelCode.SECUNDARIO,
      modality: EducationalModalityCode.TALLERES,
    });
  });

  it('create user with empty levels', () => {
    const user = User.create({
      ...validProps,
      levels: [],
    });

    expect(user.levels).toHaveLength(0);
    expect(user.levels).toEqual([]);
  });

  it('addLevel adds a level', () => {
    const user = User.create(validProps);

    user.addLevel(EducationalLevelCode.INICIAL, EducationalModalityCode.COMUN);

    expect(user.levels).toHaveLength(1);
    expect(user.levels[0]).toEqual({
      level: EducationalLevelCode.INICIAL,
      modality: EducationalModalityCode.COMUN,
    });
  });

  it('addLevel does not add duplicate level+modality', () => {
    const user = User.create({
      ...validProps,
      levels: [{ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN }],
    });

    user.addLevel(EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN);

    expect(user.levels).toHaveLength(1);
  });

  it('hasLevel matches by level+modality', () => {
    const user = User.create({
      ...validProps,
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
      ],
    });

    expect(user.hasLevel({ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN })).toBe(true);
    expect(user.hasLevel({ level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES })).toBe(true);
    expect(user.hasLevel({ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.TALLERES })).toBe(false);
    expect(user.hasLevel({ level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN })).toBe(false);
  });

  it('hasLevel matches by level only (no modality specified)', () => {
    const user = User.create({
      ...validProps,
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
      ],
    });

    expect(user.hasLevel({ level: EducationalLevelCode.PRIMARIO })).toBe(true);
    expect(user.hasLevel({ level: EducationalLevelCode.SECUNDARIO })).toBe(true);
    expect(user.hasLevel({ level: EducationalLevelCode.INICIAL })).toBe(false);
  });

  it('hasEducationalLevel returns true for any modality of that base level', () => {
    const user = User.create({
      ...validProps,
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.TALLERES },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN },
      ],
    });

    expect(user.hasEducationalLevel(EducationalLevelCode.PRIMARIO)).toBe(true);
    expect(user.hasEducationalLevel(EducationalLevelCode.SECUNDARIO)).toBe(true);
    expect(user.hasEducationalLevel(EducationalLevelCode.INICIAL)).toBe(false);
    expect(user.hasEducationalLevel(EducationalLevelCode.TERCIARIO)).toBe(false);
  });

  it('levels getter returns a copy (immutability)', () => {
    const user = User.create({
      ...validProps,
      levels: [{ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN }],
    });

    const copy = user.levels;
    copy.push({ level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN });

    // Internal state must not be affected
    expect(user.levels).toHaveLength(1);
    expect(user.levels[0]).toEqual({
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });
  });

  it('level compat getter returns first entry level code', () => {
    const user = User.create({
      ...validProps,
      levels: [
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
      ],
    });

    expect(user.level).toBe(EducationalLevelCode.SECUNDARIO);
  });

  it('level compat getter returns undefined for empty levels', () => {
    const user = User.create({
      ...validProps,
      levels: [],
    });

    expect(user.level).toBeUndefined();
    expect(user.modality).toBeUndefined();
  });

  it('level compat getter returns undefined when no levels provided', () => {
    const user = User.create(validProps);

    expect(user.level).toBeUndefined();
    expect(user.modality).toBeUndefined();
  });

  it('reconstruct preserves levels and compat getters work', () => {
    const id = Id.create();
    const createdAt = new Date('2024-01-01');
    const updatedAt = new Date('2024-06-01');
    const user = User.reconstruct({
      ...validProps,
      id,
      levels: [
        { level: EducationalLevelCode.TERCIARIO, modality: EducationalModalityCode.BILINGÜISMO },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.COMUN },
      ],
      createdAt,
      updatedAt,
    });

    expect(user.levels).toHaveLength(2);
    expect(user.level).toBe(EducationalLevelCode.TERCIARIO);
    expect(user.modality).toBe(EducationalModalityCode.BILINGÜISMO);
    expect(user.hasLevel({ level: EducationalLevelCode.TERCIARIO, modality: EducationalModalityCode.BILINGÜISMO })).toBe(true);
    expect(user.hasEducationalLevel(EducationalLevelCode.SECUNDARIO)).toBe(true);
  });

  it('assignLevel is a no-op with backward compat (deprecated)', () => {
    const user = User.create({
      ...validProps,
      levels: [{ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN }],
    });

    user.assignLevel(EducationalLevelCode.SECUNDARIO);

    // levels should be unchanged (old behavior overridden)
    expect(user.levels).toHaveLength(1);
    expect(user.level).toBe(EducationalLevelCode.PRIMARIO);
  });

  it('assignModality is a no-op with backward compat (deprecated)', () => {
    const user = User.create({
      ...validProps,
      levels: [{ level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN }],
    });

    user.assignModality(EducationalModalityCode.TALLERES);

    // levels should be unchanged (old behavior overridden)
    expect(user.levels).toHaveLength(1);
    expect(user.modality).toBe(EducationalModalityCode.COMUN);
  });
});
