/**
 * PR4-T12 [GREEN] — ListTeacherCourseCyclesUseCase.
 *
 * Resolves the authenticated user's Teacher record and returns the Primario CourseCycles
 * the teacher is authorized to view:
 *   - mode='subject'  → CCs via SubjectAssignment.courseSectionId (AD-6 "por materia" path)
 *   - mode='homeroom' → CCs via CourseCycle.homeroomTeacherId    (AD-6 "por curso" path)
 *
 * Unlinked userId (no Teacher with that userId) → empty array, never an error. (TIA-R2)
 * Primario filter: Math.floor(level / 10) === 2. (TIA-R9)
 * Specs: TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R9, AD-6
 */
import { Injectable } from '@nestjs/common';
import type {
  CourseCycle,
  CourseCycleRepository,
  SubjectAssignmentRepository,
  TeacherRepository,
} from '@educandow/domain';

const PRIMARIO_DECADE = 2; // Math.floor(level / 10) === 2

@Injectable()
export class ListTeacherCourseCyclesUseCase {
  constructor(
    private readonly teacherRepo: TeacherRepository,
    private readonly assignmentRepo: SubjectAssignmentRepository,
    private readonly courseCycleRepo: CourseCycleRepository,
  ) {}

  async execute(input: {
    userId: string;
    mode: 'subject' | 'homeroom';
  }): Promise<Array<{ cycle: CourseCycle; modality: number | null }>> {
    // 1. Resolve Teacher from JWT userId (TIA-R2: null → empty, never error)
    const teacher = await this.teacherRepo.findByUserId(input.userId);
    if (!teacher) return [];

    let courseCycles: CourseCycle[];

    if (input.mode === 'homeroom') {
      // AD-6 "por curso" path: CourseCycle.homeroomTeacherId = teacher.id
      courseCycles = await this.courseCycleRepo.findByHomeroomTeacher(teacher.id.get());
    } else {
      // AD-6 "por materia" path: SubjectAssignment → courseSectionId → CourseCycle.courseId
      const assignments = await this.assignmentRepo.findByTeacher(teacher.id.get());
      if (assignments.length === 0) return [];

      // Deduplicate courseSectionIds (a teacher can have multiple subjects per section)
      const courseSectionIds = [...new Set(assignments.map((a) => a.courseSectionId))];
      courseCycles = await this.courseCycleRepo.findByCourseSectionIds(courseSectionIds);
    }

    // TIA-R9: Primario screens only show Primario-level CCs (Math.floor(level/10) === 2)
    const primario = courseCycles.filter(
      (cc) => Math.floor(cc.level.toCode() / 10) === PRIMARIO_DECADE,
    );

    if (primario.length === 0) return [];

    // W3: resolve modality from StudyPlan (authoritative source) via a single bulk query.
    // This matches the write-side: upsert use cases call findGradingContextByUuid →
    // CourseCycle.studyPlanId → StudyPlan.modality. Using cc.level.modalityCode would
    // diverge if a StudyPlan's modality changes without cascading to CourseCycle.level.
    const uuids = primario.map((cc) => cc.uuid);
    const gradingContexts = await this.courseCycleRepo.findGradingContextsByUuids(uuids);

    return primario.map((cc) => ({
      cycle: cc,
      modality: gradingContexts.get(cc.uuid)?.modality ?? null,
    }));
  }
}
