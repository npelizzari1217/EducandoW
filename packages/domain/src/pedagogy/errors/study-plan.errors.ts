import { DomainError } from '../../shared/errors/domain-error';

function pluralizeCourses(n: number): string {
  return n === 1 ? '1 curso vinculado' : `${n} cursos vinculados`;
}

function pluralizeCycles(n: number): string {
  return n === 1 ? '1 ciclo lectivo activo' : `${n} ciclos lectivos activos`;
}

function buildMessage(courseCount: number, courseCycleCount: number): string {
  const base = 'No se puede eliminar el plan de estudio porque tiene';
  if (courseCount > 0 && courseCycleCount === 0) {
    return `${base} ${pluralizeCourses(courseCount)}. Eliminá los cursos vinculados antes de continuar.`;
  }
  if (courseCount === 0 && courseCycleCount > 0) {
    return `${base} ${pluralizeCycles(courseCycleCount)}. Eliminá los ciclos lectivos antes de continuar.`;
  }
  return `${base} ${pluralizeCourses(courseCount)} y ${pluralizeCycles(courseCycleCount)}. Eliminá los ciclos lectivos primero y luego los cursos vinculados.`;
}

export class StudyPlanHasDependenciesError extends DomainError {
  constructor(
    public readonly courseCount: number,
    public readonly courseCycleCount: number,
  ) {
    super(buildMessage(courseCount, courseCycleCount), 'STUDY_PLAN_HAS_DEPENDENCIES');
  }
}
