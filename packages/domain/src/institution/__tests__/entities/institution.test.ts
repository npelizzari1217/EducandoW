import { describe, it, expect } from 'vitest';
import { Institution, type InstitutionLevelEntry } from '../../entities/institution';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';

const IL = (level: EducationalLevelCode, modality: EducationalModalityCode = EducationalModalityCode.COMUN): InstitutionLevelEntry => ({ level, modality });

describe('Institution', () => {
  it('creates an institution with generated id', () => {
    const inst = Institution.create({
      name: 'Escuela 123',
      institutionLevels: [IL(EducationalLevelCode.INICIAL), IL(EducationalLevelCode.PRIMARIO)],
    });
    expect(inst.id).toBeDefined();
    expect(inst.name).toBe('Escuela 123');
    expect(inst.levels).toHaveLength(2);
    expect(inst.institutionLevels).toHaveLength(2);
  });

  it('hasLevel checks if level+modality pair exists', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [IL(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN)],
    });
    expect(inst.hasLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.COMUN)).toBe(true);
    expect(inst.hasLevel(EducationalLevelCode.INICIAL, EducationalModalityCode.COMUN)).toBe(false);
    expect(inst.hasLevel(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.TALLERES)).toBe(false);
  });

  it('hasEducationalLevel checks base level (ignores modality)', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [IL(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.TALLERES)],
    });
    expect(inst.hasEducationalLevel(EducationalLevelCode.SECUNDARIO)).toBe(true);
    expect(inst.hasEducationalLevel(EducationalLevelCode.INICIAL)).toBe(false);
  });

  it('addLevel appends a new level+modality pair', () => {
    const inst = Institution.create({ name: 'Test', institutionLevels: [] });
    inst.addLevel(EducationalLevelCode.TERCIARIO, EducationalModalityCode.COMUN);
    expect(inst.institutionLevels).toHaveLength(1);
    expect(inst.hasLevel(EducationalLevelCode.TERCIARIO, EducationalModalityCode.COMUN)).toBe(true);
  });

  it('reconstruct restores full props', () => {
    const inst = Institution.reconstruct({
      id: { get: () => 'id-1' } as any,
      name: 'Colegio',
      institutionLevels: [IL(EducationalLevelCode.INICIAL)],
      address: 'Calle 123',
      phone: '1234',
      contactEmail: 'mail@test.com',
    });
    expect(inst.name).toBe('Colegio');
    expect(inst.address).toBe('Calle 123');
    expect(inst.phone).toBe('1234');
    expect(inst.contactEmail).toBe('mail@test.com');
  });

  it('sessionTimeoutMinutes defaults to 20 when not provided', () => {
    const inst = Institution.create({
      name: 'Escuela Test',
      institutionLevels: [IL(EducationalLevelCode.PRIMARIO)],
    });
    expect(inst.sessionTimeoutMinutes).toBe(20);
  });

  it('sessionTimeoutMinutes uses the provided value', () => {
    const inst = Institution.create({
      name: 'Escuela Test',
      institutionLevels: [IL(EducationalLevelCode.PRIMARIO)],
      sessionTimeoutMinutes: 60,
    });
    expect(inst.sessionTimeoutMinutes).toBe(60);
  });

  it('reconstruct preserves sessionTimeoutMinutes', () => {
    const inst = Institution.reconstruct({
      id: { get: () => 'id-1' } as any,
      name: 'Colegio',
      institutionLevels: [IL(EducationalLevelCode.INICIAL)],
      sessionTimeoutMinutes: 45,
    });
    expect(inst.sessionTimeoutMinutes).toBe(45);
  });

  it('levels getter computes composite codes', () => {
    const inst = Institution.create({
      name: 'Test',
      institutionLevels: [
        IL(EducationalLevelCode.PRIMARIO, EducationalModalityCode.COMUN),
        IL(EducationalLevelCode.PRIMARIO, EducationalModalityCode.TALLERES),
        IL(EducationalLevelCode.SECUNDARIO, EducationalModalityCode.BILINGÜISMO),
      ],
    });
    const codes = inst.levels.map((l) => l.toCode());
    expect(codes).toEqual([20, 21, 32]);
  });
});
