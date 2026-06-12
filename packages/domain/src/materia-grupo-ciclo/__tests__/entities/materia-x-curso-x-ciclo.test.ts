/**
 * MateriaXCursoXCiclo — Domain entity tests (Fase 3b)
 * Specs: MGC-R1, MGC-S1, MGC-S2, MGC-S3
 * Tasks: F3-D1, F3-T2
 */
import { describe, it, expect } from 'vitest';
import { MateriaXCursoXCiclo } from '../../entities/materia-x-curso-x-ciclo';

describe('MateriaXCursoXCiclo entity', () => {
  const validInput = {
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subject-1',
  };

  // create() generates a unique id
  it('create generates an id', () => {
    const m = MateriaXCursoXCiclo.create(validInput);
    expect(m.id).toBeTruthy();
    expect(typeof m.id).toBe('string');
  });

  it('two create() calls produce different ids (MGC-S3: independence)', () => {
    const a = MateriaXCursoXCiclo.create(validInput);
    const b = MateriaXCursoXCiclo.create(validInput);
    expect(a.id).not.toBe(b.id);
  });

  // MGC-S3: two CCs from same plan produce INDEPENDENT subject sets
  it('create for CC1 and CC2 from same plan → independent entities', () => {
    const m1 = MateriaXCursoXCiclo.create({ courseCycleId: 'cc-1', subjectId: 'sub-math' });
    const m2 = MateriaXCursoXCiclo.create({ courseCycleId: 'cc-2', subjectId: 'sub-math' });
    expect(m1.courseCycleId).toBe('cc-1');
    expect(m2.courseCycleId).toBe('cc-2');
    expect(m1.id).not.toBe(m2.id);
  });

  // reconstruct preserves all props
  it('reconstruct preserves id and all fields', () => {
    const now = new Date('2026-01-01');
    const m = MateriaXCursoXCiclo.reconstruct({
      id: 'fixed-id',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subject-1',
      studyPlanSubjectId: 'sps-1',
      createdAt: now,
      updatedAt: now,
    });
    expect(m.id).toBe('fixed-id');
    expect(m.courseCycleId).toBe('cc-uuid-1');
    expect(m.subjectId).toBe('subject-1');
    expect(m.studyPlanSubjectId).toBe('sps-1');
    expect(m.createdAt).toBe(now);
    expect(m.updatedAt).toBe(now);
  });

  // studyPlanSubjectId is optional (provenance)
  it('create without studyPlanSubjectId → undefined', () => {
    const m = MateriaXCursoXCiclo.create(validInput);
    expect(m.studyPlanSubjectId).toBeUndefined();
  });

  it('create with studyPlanSubjectId preserves it', () => {
    const m = MateriaXCursoXCiclo.create({ ...validInput, studyPlanSubjectId: 'sps-42' });
    expect(m.studyPlanSubjectId).toBe('sps-42');
  });

  // courseCycleId and subjectId are required — guard
  it('create throws if courseCycleId is empty', () => {
    expect(() => MateriaXCursoXCiclo.create({ courseCycleId: '', subjectId: 'sub-1' })).toThrow();
  });

  it('create throws if subjectId is empty', () => {
    expect(() => MateriaXCursoXCiclo.create({ courseCycleId: 'cc-1', subjectId: '' })).toThrow();
  });
});
