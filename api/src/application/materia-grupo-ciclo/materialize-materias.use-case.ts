import { Injectable } from '@nestjs/common';
import type { MateriaXCursoXCicloRepository } from '@educandow/domain';

export interface PlanSubjectInput {
  subjectId: string;
  studyPlanSubjectId?: string;
  esOptativa?: boolean;
}

export interface MaterializeMateriasInput {
  courseCycleId: string;
  planSubjects: PlanSubjectInput[];
}

/**
 * MaterializeMateriasUseCase — Fase 3c (F3-A1, D1).
 *
 * Given a CourseCycle and its plan subjects, ensures that one MateriaXCursoXCiclo
 * row exists per subject. On re-generation (D1):
 *   - Creates any missing rows (additive — skipDuplicates).
 *   - Re-syncs studyPlanSubjectId for existing rows so that plan provenance stays current.
 *   - NEVER touches grades, groups, or AlumnosXGrupo.
 *
 * Called by GenerateCourseCyclesUseCase as a fire-and-forget side-effect.
 */
@Injectable()
export class MaterializeMateriasUseCase {
  constructor(private readonly materiaRepo: MateriaXCursoXCicloRepository) {}

  async execute(input: MaterializeMateriasInput): Promise<void> {
    if (input.planSubjects.length === 0) return;

    // Step 1: upsert (skipDuplicates) — creates rows that are missing
    await this.materiaRepo.upsertMany(
      input.planSubjects.map((s) => ({
        courseCycleId: input.courseCycleId,
        subjectId: s.subjectId,
        studyPlanSubjectId: s.studyPlanSubjectId,
        esOptativa: s.esOptativa,
      })),
    );

    // Step 2: D1 re-sync — update studyPlanSubjectId on rows that already existed
    // D2 LOCK: do NOT add esOptativa here.
    // Step-2 only re-syncs studyPlanSubjectId. Adding esOptativa would overwrite
    // per-CC PATCH overrides (MGC-R10) on re-generation. Additive semantics (MGC-R15)
    // are enforced by upsertMany skipDuplicates in Step-1.
    // Fetch all rows (includes both newly created and already-existing ones)
    const existing = await this.materiaRepo.findByCourseCycleId(input.courseCycleId);
    if (existing.length === 0) return;

    // Build lookup: subjectId → desired studyPlanSubjectId from the plan
    const planMap = new Map<string, string | undefined>(
      input.planSubjects.map((s) => [s.subjectId, s.studyPlanSubjectId]),
    );

    // Update only rows where the studyPlanSubjectId has changed
    await Promise.all(
      existing
        .filter((m) => {
          const desired = planMap.get(m.subjectId);
          return desired !== undefined && desired !== m.studyPlanSubjectId;
        })
        .map((m) =>
          this.materiaRepo.updateDescription(m.id, {
            studyPlanSubjectId: planMap.get(m.subjectId),
          }),
        ),
    );
  }
}
