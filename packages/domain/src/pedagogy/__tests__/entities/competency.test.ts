import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { SubjectCompetency } from '../../entities/subject-competency';
import { CompetencyValuation } from '../../entities/competency-valuation';

// ── SubjectCompetency ─────────────────────────────────────

describe('SubjectCompetency', () => {
  it('creates with subjectId, name and periodActive', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Lectura comprensiva', periodActive: 4 });
    expect(c.subjectId).toBe('subj-1');
    expect(c.name).toBe('Lectura comprensiva');
    expect(c.periodActive).toBe(4);
    expect(c.active).toBe(true);
    expect(c.deletedAt).toBeUndefined();
    expect(c.id.get()).toBeDefined();
  });

  it('assigns a UUID on creation', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Escritura', periodActive: 2 });
    expect(c.id.get()).toHaveLength(36);
  });

  it('updateName changes the name', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Original', periodActive: 4 });
    c.updateName('Actualizado');
    expect(c.name).toBe('Actualizado');
  });

  it('setActive toggles active flag', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Comp A', periodActive: 4 });
    expect(c.active).toBe(true);
    c.setActive(false);
    expect(c.active).toBe(false);
    c.setActive(true);
    expect(c.active).toBe(true);
  });

  it('setPeriodActive updates periodActive', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Comp A', periodActive: 4 });
    c.setPeriodActive(2);
    expect(c.periodActive).toBe(2);
  });

  it('softDelete marks as inactive and sets deletedAt', () => {
    const c = SubjectCompetency.create({ subjectId: 'subj-1', name: 'Comp B', periodActive: 4 });
    expect(c.active).toBe(true);
    c.softDelete();
    expect(c.active).toBe(false);
    expect(c.deletedAt).toBeInstanceOf(Date);
  });

  it('reconstruct preserves all fields including deletedAt', () => {
    const deletedAt = new Date('2026-01-01');
    const c = SubjectCompetency.reconstruct({
      id: Id.create(),
      subjectId: 'subj-2',
      name: 'Comp reconstruct',
      periodActive: 3,
      active: false,
      deletedAt,
    });
    expect(c.name).toBe('Comp reconstruct');
    expect(c.active).toBe(false);
    expect(c.deletedAt).toEqual(deletedAt);
  });
});

// ── CompetencyValuation ───────────────────────────────────

describe('CompetencyValuation', () => {
  const defaults = {
    competencyId: 'comp-1',
    studentId: 'student-1',
    valuation1: null as string | null,
    valuation2: null as string | null,
    valuation3: null as string | null,
    valuation4: null as string | null,
    modificable1: true,
    modificable2: true,
    modificable3: true,
    modificable4: true,
    imprimible1: false,
    imprimible2: false,
    imprimible3: false,
    imprimible4: false,
    periodActive: 1,
  };

  it('creates with correct defaults', () => {
    const v = CompetencyValuation.create(defaults);
    expect(v.competencyId).toBe('comp-1');
    expect(v.studentId).toBe('student-1');
    expect(v.valuation1).toBeNull();
    expect(v.valuation2).toBeNull();
    expect(v.valuation3).toBeNull();
    expect(v.valuation4).toBeNull();
    expect(v.modificable1).toBe(true);
    expect(v.modificable2).toBe(true);
    expect(v.modificable3).toBe(true);
    expect(v.modificable4).toBe(true);
    expect(v.imprimible1).toBe(false);
    expect(v.imprimible2).toBe(false);
    expect(v.imprimible3).toBe(false);
    expect(v.imprimible4).toBe(false);
    expect(v.periodActive).toBe(1);
    expect(v.active).toBe(true);
  });

  it('assigns a UUID on creation', () => {
    const v = CompetencyValuation.create(defaults);
    expect(v.id.get()).toHaveLength(36);
  });

  it('isModificable returns correct flag per period', () => {
    const v = CompetencyValuation.create({ ...defaults, modificable2: false });
    expect(v.isModificable(1)).toBe(true);
    expect(v.isModificable(2)).toBe(false);
    expect(v.isModificable(3)).toBe(true);
    expect(v.isModificable(4)).toBe(true);
  });

  it('setValuation updates the correct period', () => {
    const v = CompetencyValuation.create(defaults);
    v.setValuation(1, 'Logrado');
    v.setValuation(3, 'En proceso');
    expect(v.valuation1).toBe('Logrado');
    expect(v.valuation2).toBeNull();
    expect(v.valuation3).toBe('En proceso');
    expect(v.valuation4).toBeNull();
  });

  it('setValuation can set back to null', () => {
    const v = CompetencyValuation.create(defaults);
    v.setValuation(1, 'Logrado');
    v.setValuation(1, null);
    expect(v.valuation1).toBeNull();
  });

  it('setModificable updates the correct period flag', () => {
    const v = CompetencyValuation.create(defaults);
    v.setModificable(2, false);
    expect(v.modificable2).toBe(false);
    expect(v.isModificable(2)).toBe(false);
  });

  it('setImprimible updates the correct period flag', () => {
    const v = CompetencyValuation.create(defaults);
    v.setImprimible(1, true);
    v.setImprimible(4, true);
    expect(v.imprimible1).toBe(true);
    expect(v.imprimible2).toBe(false);
    expect(v.imprimible4).toBe(true);
  });

  it('setPeriodActive updates periodActive', () => {
    const v = CompetencyValuation.create(defaults);
    v.setPeriodActive(3);
    expect(v.periodActive).toBe(3);
  });

  it('softDelete marks inactive and sets deletedAt', () => {
    const v = CompetencyValuation.create(defaults);
    expect(v.active).toBe(true);
    v.softDelete();
    expect(v.active).toBe(false);
    expect(v.deletedAt).toBeInstanceOf(Date);
  });
});
