import { describe, it, expect } from 'vitest';
import { Level, LevelType } from '../../value-objects/level';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';

describe('Level (new composite scheme)', () => {
  describe('create() — backward compatible string names', () => {
    it.each([
      ['INICIAL', LevelType.INICIAL],
      ['inicial', LevelType.INICIAL],
      ['  inicial  ', LevelType.INICIAL],
      ['PRIMARIO', LevelType.PRIMARIO],
      ['primario', LevelType.PRIMARIO],
      ['SECUNDARIO', LevelType.SECUNDARIO],
      ['secundario', LevelType.SECUNDARIO],
      ['TERCIARIO', LevelType.TERCIARIO],
      ['terciario', LevelType.TERCIARIO],
    ])('creates Level from "%s"', (input, expected) => {
      const r = Level.create(input);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(expected);
    });

    it.each([
      ['TALLERES_INICIAL', LevelType.TALLERES_INICIAL],
      ['TALLERES_PRIMARIO', LevelType.TALLERES_PRIMARIO],
      ['TALLERES_SECUNDARIO', LevelType.TALLERES_SECUNDARIO],
      ['BILINGÜISMO_INICIAL', LevelType.BILINGÜISMO_INICIAL],
      ['BILINGÜISMO_PRIMARIO', LevelType.BILINGÜISMO_PRIMARIO],
      ['BILINGÜISMO_SECUNDARIO', LevelType.BILINGÜISMO_SECUNDARIO],
      ['ADMINISTRACION', LevelType.ADMINISTRACION],
      ['TODOS', LevelType.TODOS],
    ])('creates Level from "%s" (new names)', (input, expected) => {
      const r = Level.create(input);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(expected);
    });

    it('rejects invalid level name', () => {
      const r = Level.create('UNIVERSITARIO');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid pedagogical level');
    });

    it('rejects empty string', () => {
      const r = Level.create('');
      expect(r.isErr()).toBe(true);
    });

    it('lists valid options in error message', () => {
      const r = Level.create('INVALIDO');
      const msg = r.unwrapErr().message;
      expect(msg).toContain('INICIAL');
      expect(msg).toContain('PRIMARIO');
      expect(msg).toContain('SECUNDARIO');
    });
  });

  describe('create() — numeric codes', () => {
    it.each([
      [10, LevelType.INICIAL],
      [11, LevelType.TALLERES_INICIAL],
      [12, LevelType.BILINGÜISMO_INICIAL],
      [20, LevelType.PRIMARIO],
      [21, LevelType.TALLERES_PRIMARIO],
      [22, LevelType.BILINGÜISMO_PRIMARIO],
      [30, LevelType.SECUNDARIO],
      [31, LevelType.TALLERES_SECUNDARIO],
      [32, LevelType.BILINGÜISMO_SECUNDARIO],
      [40, LevelType.TERCIARIO],
      [90, LevelType.ADMINISTRACION],
      [99, LevelType.TODOS],
    ])('creates Level from numeric %d', (input, expected) => {
      const r = Level.create(input);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(expected);
    });

    it.each([
      ['10', LevelType.INICIAL],
      ['21', LevelType.TALLERES_PRIMARIO],
      ['32', LevelType.BILINGÜISMO_SECUNDARIO],
    ])('creates Level from string number "%s"', (input, expected) => {
      const r = Level.create(input);
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(expected);
    });

    it('rejects invalid numeric code (e.g. 50)', () => {
      const r = Level.create(50);
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Invalid level code');
    });
  });

  describe('equals()', () => {
    it('equals same level', () => {
      const a = Level.reconstruct(LevelType.PRIMARIO);
      const b = Level.reconstruct(LevelType.PRIMARIO);
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different level', () => {
      const a = Level.reconstruct(LevelType.INICIAL);
      const b = Level.reconstruct(LevelType.SECUNDARIO);
      expect(a.equals(b)).toBe(false);
    });

    it('does not equal different modality of same level', () => {
      const a = Level.reconstruct(LevelType.PRIMARIO);
      const b = Level.reconstruct(LevelType.TALLERES_PRIMARIO);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString()', () => {
    it.each([
      [LevelType.INICIAL, 'INICIAL'],
      [LevelType.TALLERES_INICIAL, 'TALLERES_INICIAL'],
      [LevelType.PRIMARIO, 'PRIMARIO'],
      [LevelType.SECUNDARIO, 'SECUNDARIO'],
      [LevelType.TERCIARIO, 'TERCIARIO'],
      [LevelType.ADMINISTRACION, 'ADMINISTRACION'],
    ])('returns the enum key name for %d', (type, expected) => {
      const l = Level.reconstruct(type);
      expect(l.toString()).toBe(expected);
    });
  });

  describe('toLabel() — human readable', () => {
    it.each([
      [LevelType.INICIAL, 'Inicial'],
      [LevelType.TALLERES_INICIAL, 'Talleres de Inicial'],
      [LevelType.BILINGÜISMO_PRIMARIO, 'Bilingüismo Primario'],
      [LevelType.SECUNDARIO, 'Secundario'],
      [LevelType.TERCIARIO, 'Terciario'],
    ])('label for %d is "%s"', (type, expected) => {
      const l = Level.reconstruct(type);
      expect(l.toLabel()).toBe(expected);
    });
  });

  describe('decomposition — educationalLevel', () => {
    it('extracts base level for INICIAL (10)', () => {
      const l = Level.reconstruct(LevelType.INICIAL);
      expect(l.educationalLevel.code).toBe(EducationalLevelCode.INICIAL);
    });

    it('extracts base level for TALLERES_PRIMARIO (21)', () => {
      const l = Level.reconstruct(LevelType.TALLERES_PRIMARIO);
      expect(l.educationalLevel.code).toBe(EducationalLevelCode.PRIMARIO);
    });

    it('extracts base level for BILINGÜISMO_SECUNDARIO (32)', () => {
      const l = Level.reconstruct(LevelType.BILINGÜISMO_SECUNDARIO);
      expect(l.educationalLevel.code).toBe(EducationalLevelCode.SECUNDARIO);
    });

    it('belongsToLevel works across modalities', () => {
      const comun = Level.reconstruct(LevelType.PRIMARIO);
      const talleres = Level.reconstruct(LevelType.TALLERES_PRIMARIO);
      const bilingue = Level.reconstruct(LevelType.BILINGÜISMO_PRIMARIO);

      expect(comun.belongsToLevel(EducationalLevelCode.PRIMARIO)).toBe(true);
      expect(talleres.belongsToLevel(EducationalLevelCode.PRIMARIO)).toBe(true);
      expect(bilingue.belongsToLevel(EducationalLevelCode.PRIMARIO)).toBe(true);
      expect(comun.belongsToLevel(EducationalLevelCode.INICIAL)).toBe(false);
    });
  });

  describe('decomposition — modality', () => {
    it('extracts modality for INICIAL (10)', () => {
      const l = Level.reconstruct(LevelType.INICIAL);
      expect(l.modality.code).toBe(EducationalModalityCode.COMUN);
    });

    it('extracts modality for TALLERES_PRIMARIO (21)', () => {
      const l = Level.reconstruct(LevelType.TALLERES_PRIMARIO);
      expect(l.modality.code).toBe(EducationalModalityCode.TALLERES);
    });

    it('extracts modality for BILINGÜISMO_SECUNDARIO (32)', () => {
      const l = Level.reconstruct(LevelType.BILINGÜISMO_SECUNDARIO);
      expect(l.modality.code).toBe(EducationalModalityCode.BILINGÜISMO);
    });

    it('hasModality works', () => {
      const l = Level.reconstruct(LevelType.TALLERES_INICIAL);
      expect(l.hasModality(EducationalModalityCode.TALLERES)).toBe(true);
      expect(l.hasModality(EducationalModalityCode.COMUN)).toBe(false);
    });
  });

  describe('factory methods', () => {
    it('fromParts creates correct composite', () => {
      const l = Level.fromParts(EducationalLevelCode.PRIMARIO, EducationalModalityCode.TALLERES);
      expect(l.get()).toBe(LevelType.TALLERES_PRIMARIO);
      expect(l.toCode()).toBe(21);
    });

    it('allPedagogical returns 10 levels', () => {
      const all = Level.allPedagogical();
      expect(all).toHaveLength(10);
    });

    it('forLevel returns all modalities for a given level', () => {
      const primario = Level.forLevel(EducationalLevelCode.PRIMARIO);
      expect(primario).toHaveLength(3);
      const codes = primario.map((l) => l.toCode());
      expect(codes).toContain(20);
      expect(codes).toContain(21);
      expect(codes).toContain(22);
    });
  });

  describe('isPedagogical', () => {
    it('real levels are pedagogical', () => {
      expect(Level.reconstruct(LevelType.INICIAL).isPedagogical).toBe(true);
      expect(Level.reconstruct(LevelType.TALLERES_PRIMARIO).isPedagogical).toBe(true);
    });

    it('ADMINISTRACION and TODOS are not pedagogical', () => {
      expect(Level.reconstruct(LevelType.ADMINISTRACION).isPedagogical).toBe(false);
      expect(Level.reconstruct(LevelType.TODOS).isPedagogical).toBe(false);
    });
  });
});
