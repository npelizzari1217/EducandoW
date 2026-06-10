import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError, DomainError } from '@educandow/domain';
import { SubjectCompetency, CompetencyValuation, CompetencyPeriodValuation } from '@educandow/domain';
import {
  CompetencyValuationNotFoundError,
  GradeScaleNotConfiguredError,
  PeriodItemNotInTemplateError,
  GradeScaleValueMismatchError,
} from '@educandow/domain';
import { PeriodTemplateNotFoundError, ValueNotFoundError } from '@educandow/domain';
import type {
  SubjectCompetencyRepository,
  CompetencyValuationRepository,
  StudyPlanRepository,
  CompetencyPeriodValuationRepository,
  CourseCycleRepository,
  GradeScaleRepository,
  GradingPeriodRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';
import { findEnrolledStudentsByCourseCycle } from '../../../infrastructure/persistence/prisma/queries/enrolled-students.query';

// ── SubjectCompetency CRUD ─────────────────────────────

@Injectable()
export class CreateSubjectCompetencyUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(input: { studyPlanSubjectId: string; name: string }): Promise<Result<SubjectCompetency, Error>> {
    if (!input.studyPlanSubjectId || input.studyPlanSubjectId.trim().length === 0) {
      return err(new ValidationError('El studyPlanSubjectId es requerido'));
    }

    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('El nombre de la competencia no puede estar vacío'));
    }

    const existing = await this.repo.findByStudyPlanSubjectAndName(input.studyPlanSubjectId, input.name);
    if (existing && !existing.deletedAt) {
      return err(new ValidationError(`Ya existe una competencia con el nombre "${input.name}" para este plan`));
    }

    const competency = SubjectCompetency.create({
      studyPlanSubjectId: input.studyPlanSubjectId,
      name: input.name.trim(),
    });

    await this.repo.save(competency);
    return ok(competency);
  }
}

@Injectable()
export class ListSubjectCompetenciesUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(studyPlanSubjectId: string): Promise<SubjectCompetency[]> {
    return this.repo.findActiveByStudyPlanSubject(studyPlanSubjectId);
  }
}

@Injectable()
export class GetSubjectCompetencyUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(id: string): Promise<SubjectCompetency | null> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class UpdateSubjectCompetencyUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(id: string, input: { name?: string; active?: boolean }): Promise<Result<SubjectCompetency, Error>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return err(new NotFoundError('Competencia', id));
    }

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        return err(new ValidationError('El nombre de la competencia no puede estar vacío'));
      }

      // Duplicate-name guard: reject rename if another active competency in the same
      // studyPlanSubject already has this name. Idempotent: same id → not a conflict.
      const trimmedName = input.name.trim();
      const sibling = await this.repo.findByStudyPlanSubjectAndName(existing.studyPlanSubjectId, trimmedName);
      if (sibling && !sibling.deletedAt && sibling.id.get() !== id) {
        return err(new ValidationError(`Ya existe una competencia con el nombre "${trimmedName}" para este plan`));
      }

      existing.updateName(trimmedName);
    }

    if (input.active !== undefined) {
      existing.setActive(input.active);
    }

    await this.repo.save(existing);
    return ok(existing);
  }
}

@Injectable()
export class DeleteSubjectCompetencyUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}

// ── Copy Use Case ──────────────────────────────────────

@Injectable()
export class CopySubjectCompetenciesUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(input: {
    sourceStudyPlanSubjectId: string;
    targetStudyPlanSubjectId: string;
  }): Promise<Result<{ copied: number; skipped: number }, Error>> {
    if (!input.sourceStudyPlanSubjectId || input.sourceStudyPlanSubjectId.trim().length === 0) {
      return err(new ValidationError('El sourceStudyPlanSubjectId es requerido'));
    }

    if (!input.targetStudyPlanSubjectId || input.targetStudyPlanSubjectId.trim().length === 0) {
      return err(new ValidationError('El targetStudyPlanSubjectId es requerido'));
    }

    if (input.sourceStudyPlanSubjectId === input.targetStudyPlanSubjectId) {
      return err(new ValidationError('El origen y destino no pueden ser el mismo plan de estudio de materia'));
    }

    const sources = await this.repo.findActiveByStudyPlanSubject(input.sourceStudyPlanSubjectId);

    let copied = 0;
    let skipped = 0;

    for (const source of sources) {
      const existing = await this.repo.findByStudyPlanSubjectAndName(
        input.targetStudyPlanSubjectId,
        source.name,
      );
      if (existing) {
        skipped++;
      } else {
        const newCompetency = SubjectCompetency.create({
          studyPlanSubjectId: input.targetStudyPlanSubjectId,
          name: source.name,
        });
        await this.repo.save(newCompetency);
        copied++;
      }
    }

    return ok({ copied, skipped });
  }
}

// ── CompetencyValuation Read Use Cases ─────────────────

@Injectable()
export class ListBulkCompetencyValuationsUC {
  constructor(private repo: CompetencyValuationRepository) {}

  async execute(input: {
    courseCycleId:      string;
    studyPlanSubjectId: string;
  }) {
    return this.repo.findByCourseCycleAndStudyPlanSubject(
      input.courseCycleId,
      input.studyPlanSubjectId,
    );
  }
}

@Injectable()
export class GetCompetencyValuationUC {
  constructor(private repo: CompetencyValuationRepository) {}

  async execute(uuid: string): Promise<Result<CompetencyValuation, Error>> {
    const v = await this.repo.findById(uuid);
    if (!v) return err(new ValidationError('Valoración no encontrada'));
    return ok(v);
  }
}

@Injectable()
export class ListCompetencyValuationsUC {
  constructor(private repo: CompetencyValuationRepository) {}

  async execute(studentId: string, studyPlanSubjectId: string): Promise<CompetencyValuation[]> {
    return this.repo.findByStudentAndStudyPlanSubject(studentId, studyPlanSubjectId);
  }
}

// ── Auto-Creation ──────────────────────────────────────
//
// Sole trigger: CourseCycle instantiation (GenerateCourseCyclesUseCase).
// Old executeForSubjectAssignment / executeForEnrollment / executeForNewEnrollment removed
// per Design §3 decision: cycle-blind paths can't derive courseCycleId without Fase-4 FK.

@Injectable()
export class AutoCreateCompetencyValuationsUC {
  constructor(
    private competencyRepo: SubjectCompetencyRepository,
    private valuationRepo: CompetencyValuationRepository,
    private studyPlanRepo: StudyPlanRepository,
  ) {}

  /**
   * Resolves a CourseCycle → StudyPlan subjects → active competencies, then
   * finds enrolled students for the CourseCycle's courseSection, and batch-creates
   * CompetencyValuation parent rows (studentId, competencyId, courseCycleId).
   * skipDuplicates at DB level ensures idempotency.
   */
  async execute({ courseCycleId }: { courseCycleId: string }): Promise<void> {
    // 1. Resolve CourseCycle row directly via TenantContext (avoids circular DI;
    //    consistent with enrollment-lookup pattern below).
    const cc = await this.client.courseCycle.findUnique({
      where: { uuid: courseCycleId },
      select: { courseId: true, studyPlanId: true },
    });
    if (!cc) return;

    // 2. All StudyPlanSubject IDs under this plan
    const spsIds = await this.studyPlanRepo.findStudyPlanSubjectIdsByPlan(cc.studyPlanId);
    if (spsIds.length === 0) return;

    // 3. All active competencies across those subjects
    const competencies = (
      await Promise.all(spsIds.map((id) => this.competencyRepo.findActiveByStudyPlanSubject(id)))
    ).flat();
    if (competencies.length === 0) return;

    // 4. Enrolled students via shared infra helper (avoids circular DI;
    //    helper is a plain function that takes the tenant client directly).
    const enrolled = await findEnrolledStudentsByCourseCycle(this.client, courseCycleId);
    const studentIds = enrolled.map((s) => s.studentId);
    if (studentIds.length === 0) return;

    // 5. Batch-create parent valuations — DB skipDuplicates handles re-runs
    const valuations = studentIds.flatMap((studentId) =>
      competencies.map((c) =>
        CompetencyValuation.create({ competencyId: c.id.get(), studentId, courseCycleId }),
      ),
    );

    await this.valuationRepo.bulkCreate(valuations);
  }

  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no client available');
    return c;
  }
}

// ── GradePeriodValuationUC ─────────────────────────────

/**
 * Grades (or clears the grade of) a specific period within a CompetencyValuation.
 *
 * Validates:
 *   - Parent valuation exists.
 *   - Cycle's (level, modality) resolves to an active GradingPeriodTemplate.
 *   - periodItemId belongs to that template.
 *   - gradeScaleValueId (if not null) exists and belongs to the active GradeScale for (level, modality).
 *   - Child row is not locked (modificable=false).
 *
 * On success: lazily creates the child row if absent, persists, returns ok(child).
 * Design §7 — grade PATCH pseudocode.
 */
@Injectable()
export class GradePeriodValuationUC {
  constructor(
    private valuationRepo: CompetencyValuationRepository,
    private courseCycleRepo: CourseCycleRepository,
    private gradingPeriodRepo: GradingPeriodRepository,
    private gradeScaleRepo: GradeScaleRepository,
    private periodRepo: CompetencyPeriodValuationRepository,
  ) {}

  async execute(input: {
    valuationUuid: string;
    periodItemId: string;
    gradeScaleValueId?: string | null;
    imprimible?: boolean;
  }): Promise<Result<CompetencyPeriodValuation, DomainError>> {
    // 1. Resolve parent valuation
    const parent = await this.valuationRepo.findById(input.valuationUuid);
    if (!parent) return err(new CompetencyValuationNotFoundError(input.valuationUuid));

    // 2. Resolve (level, modality) from CourseCycle via StudyPlan (Design §2)
    const ctx = await this.courseCycleRepo.findGradingContextByUuid(parent.courseCycleId);
    if (!ctx) return err(new CompetencyValuationNotFoundError(input.valuationUuid));

    // 3. Resolve active grading period template for (level, modality)
    const template = await this.gradingPeriodRepo.findActiveTemplateByLevelModality(ctx.level, ctx.modality);
    if (!template) return err(new PeriodTemplateNotFoundError(`(level=${ctx.level}, modality=${ctx.modality})`));

    // 4. Validate periodItemId belongs to the template
    if (!template.items.some((i) => i.id === input.periodItemId)) {
      return err(new PeriodItemNotInTemplateError(input.periodItemId, template.id));
    }

    // 5. Lazy-create or load existing child row
    let child =
      (await this.periodRepo.findByValuationAndPeriod(parent.id.get(), input.periodItemId)) ??
      CompetencyPeriodValuation.create({ valuationId: parent.id.get(), periodItemId: input.periodItemId });

    // 6. Apply grade or clear when gradeScaleValueId is present in input
    //    When absent (undefined), leave grade fields unchanged (imprimible-only call).
    if (input.gradeScaleValueId !== undefined) {
      if (input.gradeScaleValueId === null) {
        const r = child.clearGrade();
        if (r.isErr()) return err(r.unwrapErr());
      } else {
        // Resolve scale value (404 if missing)
        const scaleValue = await this.gradeScaleRepo.findValueById(input.gradeScaleValueId);
        if (!scaleValue) return err(new ValueNotFoundError(input.gradeScaleValueId));

        // Resolve active scale for (level, modality) (400 if not configured)
        const scale = await this.gradeScaleRepo.findActiveByLevelModality(ctx.level, ctx.modality);
        if (!scale) return err(new GradeScaleNotConfiguredError(ctx.level, ctx.modality));

        // Validate scale membership
        if (scaleValue.scaleId !== scale.id) {
          return err(new GradeScaleValueMismatchError(input.gradeScaleValueId, scale.id));
        }

        // Snapshot gradeCode + internalStatus at write time
        const r = child.assignGrade({
          gradeScaleValueId: input.gradeScaleValueId,
          gradeCode: scaleValue.code,
          internalStatus: scaleValue.internalStatus,
        });
        if (r.isErr()) return err(r.unwrapErr());
      }
    }

    // 7. Apply imprimible when present in input (no lock check — independent of modificable)
    if (input.imprimible !== undefined) {
      child.setImprimible(input.imprimible);
    }

    // 8. Persist (upsert on valuationId + periodItemId)
    await this.periodRepo.save(child);

    // 9. Return child row
    return ok(child);
  }
}
