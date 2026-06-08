/**
 * T2.3 [RED] → T2.4 [GREEN]
 * Rewrites CompetencyValuation tests to the slim entity that carries
 * courseCycleId instead of flat period fields.
 * Specs: MVM-1 (parent with courseCycleId), MVM-3 (different cycles OK).
 */

import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { SubjectCompetency } from '../../entities/subject-competency';
import { CompetencyValuation } from '../../entities/competency-valuation';
import type { SubjectCompetencyRepository } from '../../repositories/subject-competency-repository';
import type { CompetencyValuationRepository } from '../../repositories/competency-valuation-repository';
import type { StudyPlanRepository } from '../../repositories/study-plan-repository';
import type { CourseCycleRepository } from '../../../course-cycle/repositories/course-cycle-repository';

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

describe('CompetencyValuationRepository port signatures (PR2 slim)', () => {
  it('exposes findByStudentAndStudyPlanSubject and bulkCreate; NOT findByStudentAndCompetency', () => {
    const mockRepo: CompetencyValuationRepository = {
      findById: async () => null,
      findByStudentAndStudyPlanSubject: async (_studentId: string, _studyPlanSubjectId: string) => [],
      findByCourseCycleAndStudyPlanSubject: async () => [],
      save: async () => {},
      bulkCreate: async () => {},
      delete: async () => {},
    };
    expect(typeof mockRepo.findByStudentAndStudyPlanSubject).toBe('function');
    expect(typeof mockRepo.bulkCreate).toBe('function');
    expect(typeof mockRepo.findByCourseCycleAndStudyPlanSubject).toBe('function');
    // findByStudentAndCompetency must NOT exist on the slim port
    expect((mockRepo as any).findByStudentAndCompetency).toBeUndefined();
  });
});

describe('StudyPlanRepository port signatures', () => {
  it('exposes findStudyPlanSubjectIds (per-section) and findStudyPlanSubjectIdsByPlan (per-plan)', () => {
    const check: Pick<StudyPlanRepository, 'findStudyPlanSubjectIds' | 'findStudyPlanSubjectIdsByPlan'> = {
      findStudyPlanSubjectIds: async (_courseSectionId: string, _subjectId: string) => [],
      findStudyPlanSubjectIdsByPlan: async (_planId: string) => [],
    };
    expect(typeof check.findStudyPlanSubjectIds).toBe('function');
    expect(typeof check.findStudyPlanSubjectIdsByPlan).toBe('function');
  });
});

describe('CourseCycleRepository port signatures', () => {
  it('exposes findGradingContextByUuid returning {level, modality} or null', () => {
    const check: Pick<CourseCycleRepository, 'findGradingContextByUuid'> = {
      findGradingContextByUuid: async (_uuid: string) => ({ level: 1, modality: 0 }),
    };
    expect(typeof check.findGradingContextByUuid).toBe('function');
  });
});

// ── CompetencyValuation slim entity (PR2) ────────────────

describe('CompetencyValuation slim', () => {
  it('create({competencyId, studentId, courseCycleId}) sets all three fields', () => {
    const v = CompetencyValuation.create({
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-1',
    });
    expect(v.competencyId).toBe('comp-1');
    expect(v.studentId).toBe('student-1');
    expect(v.courseCycleId).toBe('cc-uuid-1');
    expect(v.active).toBe(true);
    expect(v.deletedAt).toBeUndefined();
    expect(v.id.get()).toHaveLength(36);
  });

  it('two valuations for same student+competency but different cycles are distinct (MVM-3)', () => {
    const v1 = CompetencyValuation.create({
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-A',
    });
    const v2 = CompetencyValuation.create({
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-B',
    });
    expect(v1.courseCycleId).toBe('cc-uuid-A');
    expect(v2.courseCycleId).toBe('cc-uuid-B');
    expect(v1.id.get()).not.toBe(v2.id.get());
  });

  it('softDelete sets active=false and deletedAt', () => {
    const v = CompetencyValuation.create({
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-1',
    });
    expect(v.active).toBe(true);
    v.softDelete();
    expect(v.active).toBe(false);
    expect(v.deletedAt).toBeInstanceOf(Date);
  });

  it('reconstruct preserves all slim fields', () => {
    const deletedAt = new Date('2026-01-01');
    const v = CompetencyValuation.reconstruct({
      id: Id.create(),
      competencyId: 'comp-2',
      studentId: 'student-2',
      courseCycleId: 'cc-uuid-X',
      active: false,
      deletedAt,
    });
    expect(v.competencyId).toBe('comp-2');
    expect(v.studentId).toBe('student-2');
    expect(v.courseCycleId).toBe('cc-uuid-X');
    expect(v.active).toBe(false);
    expect(v.deletedAt).toEqual(deletedAt);
  });

  it('does NOT expose flat period fields (valuation1, modificable1, etc.)', () => {
    const v = CompetencyValuation.create({
      competencyId: 'comp-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-1',
    });
    expect((v as any).valuation1).toBeUndefined();
    expect((v as any).modificable1).toBeUndefined();
    expect((v as any).imprimible1).toBeUndefined();
    expect((v as any).periodActive).toBeUndefined();
    expect((v as any).setValuation).toBeUndefined();
    expect((v as any).setModificable).toBeUndefined();
    expect((v as any).setPeriodActive).toBeUndefined();
  });
});
