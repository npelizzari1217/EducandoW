/**
 * PR4-T12 [GREEN] — ListTeacherCourseCyclesUseCase.
 *
 * Resolves the authenticated user's Teacher record and returns the CourseCycles
 * the teacher is authorized to view:
 *   - mode='subject'  → CCs via SubjectAssignment.courseSectionId (AD-6 "por materia" path)
 *     Includes Primario (decade=2) AND Secundario (decade=3). Terciario (4) and Inicial (1) excluded.
 *   - mode='homeroom' → CCs via CourseCycle.homeroomTeacherId    (AD-6 "por curso" path)
 *     Primario only (decade=2). Homeroom mode is Primario-specific; not extended to Secundario.
 *
 * Unlinked userId (no Teacher with that userId) → empty array, never an error. (TIA-R2)
 * Specs: TIA-R2, TIA-R3, TIA-R5, TIA-R6, TIA-R9, ESS-R1, ESS-R2, AD-6, D3
 */
import { Injectable } from '@nestjs/common';
import type {
  CourseCycle,
  CourseCycleRepository,
  SubjectAssignmentRepository,
  TeacherRepository,
} from '@educandow/domain';

/** Decades allowed for subject-mode entry screens: Primario (2x) + Secundario (3x). */
const SUBJECT_ALLOWED_DECADES = [2, 3];
/** Homeroom mode remains Primario-only — not extended to Secundario in this PR. */
const HOMEROOM_DECADE = 2;

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

    // Filter by allowed decades per mode:
    //   subject  → Primario (2x) + Secundario (3x)  [ESS-R1, D3 predicate expansion]
    //   homeroom → Primario (2x) only               [homeroom unchanged, TIA-R9]
    const allowedDecades =
      input.mode === 'subject' ? SUBJECT_ALLOWED_DECADES : [HOMEROOM_DECADE];

    const filtered = courseCycles.filter((cc) =>
      allowedDecades.includes(Math.floor(cc.level.toCode() / 10)),
    );

    if (filtered.length === 0) return [];

    // W3: resolve modality from StudyPlan (authoritative source) via a single bulk query.
    // This matches the write-side: upsert use cases call findGradingContextByUuid →
    // CourseCycle.studyPlanId → StudyPlan.modality. Using cc.level.modalityCode would
    // diverge if a StudyPlan's modality changes without cascading to CourseCycle.level.
    const uuids = filtered.map((cc) => cc.uuid);
    const gradingContexts = await this.courseCycleRepo.findGradingContextsByUuids(uuids);

    return filtered.map((cc) => ({
      cycle: cc,
      modality: gradingContexts.get(cc.uuid)?.modality ?? null,
    }));
  }
}
