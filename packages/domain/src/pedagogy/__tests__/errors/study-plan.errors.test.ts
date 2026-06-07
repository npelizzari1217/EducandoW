import { describe, it, expect } from 'vitest';
import { StudyPlanHasDependenciesError } from '../../errors/study-plan.errors';
import { DomainError } from '../../../shared/errors/domain-error';

describe('StudyPlanHasDependenciesError', () => {
  it('has code STUDY_PLAN_HAS_DEPENDENCIES', () => {
    const e = new StudyPlanHasDependenciesError(1, 0);
    expect(e.code).toBe('STUDY_PLAN_HAS_DEPENDENCIES');
  });

  it('extends DomainError', () => {
    const e = new StudyPlanHasDependenciesError(1, 0);
    expect(e).toBeInstanceOf(DomainError);
  });

  it('stores courseCount and courseCycleCount as public fields', () => {
    const e = new StudyPlanHasDependenciesError(3, 2);
    expect(e.courseCount).toBe(3);
    expect(e.courseCycleCount).toBe(2);
  });

  it('format_message(1, 0) — solo 1 curso', () => {
    const e = new StudyPlanHasDependenciesError(1, 0);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 1 curso vinculado. Eliminá los cursos vinculados antes de continuar.',
    );
  });

  it('format_message(3, 0) — 3 cursos', () => {
    const e = new StudyPlanHasDependenciesError(3, 0);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 3 cursos vinculados. Eliminá los cursos vinculados antes de continuar.',
    );
  });

  it('format_message(0, 1) — solo 1 ciclo', () => {
    const e = new StudyPlanHasDependenciesError(0, 1);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 1 ciclo lectivo activo. Eliminá los ciclos lectivos antes de continuar.',
    );
  });

  it('format_message(0, 2) — 2 ciclos', () => {
    const e = new StudyPlanHasDependenciesError(0, 2);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 2 ciclos lectivos activos. Eliminá los ciclos lectivos antes de continuar.',
    );
  });

  it('format_message(2, 1) — 2 cursos y 1 ciclo', () => {
    const e = new StudyPlanHasDependenciesError(2, 1);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 2 cursos vinculados y 1 ciclo lectivo activo. Eliminá los ciclos lectivos primero y luego los cursos vinculados.',
    );
  });

  it('format_message(1, 2) — 1 curso y 2 ciclos', () => {
    const e = new StudyPlanHasDependenciesError(1, 2);
    expect(e.message).toBe(
      'No se puede eliminar el plan de estudio porque tiene 1 curso vinculado y 2 ciclos lectivos activos. Eliminá los ciclos lectivos primero y luego los cursos vinculados.',
    );
  });
});
