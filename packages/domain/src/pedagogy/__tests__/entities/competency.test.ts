import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { SubjectCompetency } from '../../entities/subject-competency';
import { CompetencyValuation } from '../../entities/competency-valuation';
import type { SubjectCompetencyRepository } from '../../repositories/subject-competency-repository';
import type { CompetencyValuationRepository } from '../../repositories/competency-valuation-repository';
import type { StudyPlanRepository } from '../../repositories/study-plan-repository';

// ── SubjectCompetency ─────────────────────────────────────

describe('SubjectCompetency', () => {
  it('creates with studyPlanSubjectId and name', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Lectura comprensiva' });
    expect(c.studyPlanSubjectId).toBe('sps-1');
    expect(c.name).toBe('Lectura comprensiva');
    expect(c.active).toBe(true);
    expect(c.deletedAt).toBeUndefined();
    expect(c.id.get()).toBeDefined();
  });

  it('assigns a UUID on creation', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Escritura' });
    expect(c.id.get()).toHaveLength(36);
  });

  it('does NOT expose subjectId or periodActive', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Comp A' });
    expect((c as any).subjectId).toBeUndefined();
    expect((c as any).periodActive).toBeUndefined();
  });

  it('updateName changes the name', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Original' });
    c.updateName('Actualizado');
    expect(c.name).toBe('Actualizado');
  });

  it('setActive toggles active flag', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Comp A' });
    expect(c.active).toBe(true);
    c.setActive(false);
    expect(c.active).toBe(false);
    c.setActive(true);
    expect(c.active).toBe(true);
  });

  it('softDelete marks as inactive and sets deletedAt', () => {
    const c = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Comp B' });
    expect(c.active).toBe(true);
    c.softDelete();
    expect(c.active).toBe(false);
    expect(c.deletedAt).toBeInstanceOf(Date);
  });

  it('reconstruct preserves all fields including deletedAt', () => {
    const deletedAt = new Date('2026-01-01');
    const c = SubjectCompetency.reconstruct({
      id: Id.create(),
      studyPlanSubjectId: 'sps-2',
      name: 'Comp reconstruct',
      active: false,
      deletedAt,
    });
    expect(c.studyPlanSubjectId).toBe('sps-2');
    expect(c.name).toBe('Comp reconstruct');
    expect(c.active).toBe(false);
    expect(c.deletedAt).toEqual(deletedAt);
  });

  it('same name allowed across different studyPlanSubjectIds', () => {
    const c1 = SubjectCompetency.create({ studyPlanSubjectId: 'sps-1', name: 'Resolución de problemas' });
    const c2 = SubjectCompetency.create({ studyPlanSubjectId: 'sps-2', name: 'Resolución de problemas' });
    expect(c1.studyPlanSubjectId).toBe('sps-1');
    expect(c2.studyPlanSubjectId).toBe('sps-2');
    expect(c1.name).toBe(c2.name);
  });
});

// ── Port signature compile-guards ────────────────────────

describe('SubjectCompetencyRepository port signatures', () => {
  it('exposes findActiveByStudyPlanSubject, findByStudyPlanSubjectAndName, findByStudyPlanSubject', () => {
    const mockRepo: SubjectCompetencyRepository = {
      findById: async () => null,
      findActiveByStudyPlanSubject: async (_id: string) => [],
      findByStudyPlanSubjectAndName: async (_id: string, _name: string) => null,
      findByStudyPlanSubject: async (_id: string) => [],
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof mockRepo.findActiveByStudyPlanSubject).toBe('function');
    expect(typeof mockRepo.findByStudyPlanSubjectAndName).toBe('function');
    expect(typeof mockRepo.findByStudyPlanSubject).toBe('function');
  });
});

describe('CompetencyValuationRepository port signatures', () => {
  it('exposes findByStudentAndStudyPlanSubject', () => {
    const mockRepo: CompetencyValuationRepository = {
      findById: async () => null,
      findByStudentAndStudyPlanSubject: async (_studentId: string, _studyPlanSubjectId: string) => [],
      findByStudentAndCompetency: async () => null,
      save: async () => {},
      bulkCreate: async () => {},
      delete: async () => {},
    };
    expect(typeof mockRepo.findByStudentAndStudyPlanSubject).toBe('function');
  });
});

describe('StudyPlanRepository port signatures', () => {
  it('exposes findStudyPlanSubjectIds', () => {
    // partial check via intersection — only assert the new method
    const check: Pick<StudyPlanRepository, 'findStudyPlanSubjectIds'> = {
      findStudyPlanSubjectIds: async (_courseSectionId: string, _subjectId: string) => [],
    };
    expect(typeof check.findStudyPlanSubjectIds).toBe('function');
  });
});

// ── CompetencyValuation (regression, unchanged) ───────────

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
