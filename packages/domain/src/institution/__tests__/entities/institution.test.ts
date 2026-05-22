import { describe, it, expect } from 'vitest';
import { Institution } from '../../entities/institution';
import { Level, LevelType } from '../../value-objects/level';

describe('Institution', () => {
  it('creates an institution with generated id', () => {
    const inst = Institution.create({
      name: 'Escuela 123',
      levels: [Level.reconstruct(LevelType.INICIAL), Level.reconstruct(LevelType.PRIMARIO)],
    });
    expect(inst.id).toBeDefined();
    expect(inst.name).toBe('Escuela 123');
    expect(inst.levels).toHaveLength(2);
  });

  it('hasLevel checks if level exists', () => {
    const inst = Institution.create({ name: 'Test', levels: [Level.reconstruct(LevelType.SECUNDARIO)] });
    expect(inst.hasLevel(LevelType.SECUNDARIO)).toBe(true);
    expect(inst.hasLevel(LevelType.INICIAL)).toBe(false);
  });

  it('addLevel appends a new level', () => {
    const inst = Institution.create({ name: 'Test', levels: [] });
    inst.addLevel(Level.reconstruct(LevelType.TERCIARIO));
    expect(inst.levels).toHaveLength(1);
    expect(inst.hasLevel(LevelType.TERCIARIO)).toBe(true);
  });

  it('reconstruct restores full props', () => {
    const inst = Institution.reconstruct({
      id: { get: () => 'id-1' } as any,
      name: 'Colegio',
      levels: [Level.reconstruct(LevelType.INICIAL)],
      address: 'Calle 123',
      phone: '1234',
      contactEmail: 'mail@test.com',
    });
    expect(inst.name).toBe('Colegio');
    expect(inst.address).toBe('Calle 123');
    expect(inst.phone).toBe('1234');
    expect(inst.contactEmail).toBe('mail@test.com');
  });
});
