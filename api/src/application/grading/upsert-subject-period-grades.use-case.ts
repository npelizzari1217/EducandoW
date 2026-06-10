/**
 * PR4-T8 [GREEN] — UpsertSubjectPeriodGradesUseCase.
 *
 * One write path for both period grades AND pa/ppi/pp flags (AD-3).
 * Batch upsert via saveMany. Validations:
 *   - courseCycleId must exist in tenant → 404
 *   - subjectId must have a snapshotted period structure → 404
 *   - periodOrdinal must be within snapshot range → 400
 *   - gradeScaleValueId (if provided) must belong to the active scale for CC level/modality → 400
 *   - studentId must exist in tenant → 404
 * Specs: SPG-R3..R9, PPF-R4, AD-3
 */
import { Injectable } from '@nestjs/common';
import { Result, ok, err, NotFoundError, ValidationError, SubjectPeriodGrade } from '@educandow/domain';
import type {
  SubjectPeriodGradeRepository,
  SubjectGradingPeriodRepository,
  CourseCycleRepository,
  GradeScaleRepository,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Input types ───────────────────────────────────────────────────────────────

export interface UpsertPeriodGradeItem {
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  periodOrdinal: number;
  /** When present, assigns the grade. When undefined, grade fields are unchanged. */
  gradeScaleValueId?: string | null;
  /** Optional pa/ppi/pp flags — omitted fields retain prior value (AD-3, PPF-R4). */
  pa?: boolean;
  ppi?: boolean;
  pp?: boolean;
}

export interface UpsertSubjectPeriodGradesInput {
  items: UpsertPeriodGradeItem[];
}

// ── Use case ──────────────────────────────────────────────────────────────────

@Injectable()
export class UpsertSubjectPeriodGradesUseCase {
  constructor(
    private readonly periodGradeRepo: SubjectPeriodGradeRepository,
    private readonly sgpRepo: SubjectGradingPeriodRepository,
    private readonly ccRepo: CourseCycleRepository,
    private readonly gradeScaleRepo: GradeScaleRepository,
  ) {}

  async execute(
    input: UpsertSubjectPeriodGradesInput,
  ): Promise<Result<void, NotFoundError | ValidationError>> {
    if (input.items.length === 0) return ok(undefined);

    // ── 1. Group items by (courseCycleId, subjectId) for bulk validation ──────
    const groupMap = new Map<string, UpsertPeriodGradeItem[]>();
    for (const item of input.items) {
      const key = `${item.courseCycleId}::${item.subjectId}`;
      const bucket = groupMap.get(key) ?? [];
      bucket.push(item);
      groupMap.set(key, bucket);
    }

    // ── 2. Per-group validation ───────────────────────────────────────────────
    const validOrdinalSets = new Map<string, Set<number>>();

    for (const [groupKey, items] of groupMap) {
      const { courseCycleId, subjectId } = items[0];

      // Validate CC exists in this tenant
      const ctx = await this.ccRepo.findGradingContextByUuid(courseCycleId);
      if (!ctx) {
        return err(new NotFoundError('CourseCycle', courseCycleId));
      }

      // Validate subject has a snapshot (subject must exist in this CC)
      const periods = await this.sgpRepo.findByCourseCycleAndSubject(courseCycleId, subjectId);
      if (periods.length === 0) {
        return err(new NotFoundError('Subject', subjectId));
      }

      const validOrdinals = new Set(periods.map((p) => p.periodOrdinal));
      validOrdinalSets.set(groupKey, validOrdinals);

      // Validate each item's periodOrdinal + gradeScaleValueId
      for (const item of items) {
        // periodOrdinal range check
        if (!validOrdinals.has(item.periodOrdinal)) {
          return err(
            new ValidationError(
              `periodOrdinal ${item.periodOrdinal} is outside the snapshotted range for subject "${subjectId}"`,
            ),
          );
        }

        // gradeScaleValueId validity for this CC's level/modality
        if (item.gradeScaleValueId != null) {
          const scaleResult = await this.validateGradeScaleValue(
            item.gradeScaleValueId,
            ctx.level,
            ctx.modality,
          );
          if (scaleResult.isErr()) return err(scaleResult.unwrapErr());
        }

        // studentId existence in tenant
        const studentValid = await this.checkStudentExists(item.studentId);
        if (!studentValid) {
          return err(new NotFoundError('Student', item.studentId));
        }
      }
    }

    // ── 3. Fetch existing grades + build upsert list ──────────────────────────
    const allToSave: SubjectPeriodGrade[] = [];

    for (const [, items] of groupMap) {
      const { courseCycleId, subjectId } = items[0];

      const existingGrades = await this.periodGradeRepo.findByCourseCycleAndSubject(
        courseCycleId,
        subjectId,
      );

      const gradeMap = new Map<string, SubjectPeriodGrade>();
      for (const g of existingGrades) {
        gradeMap.set(`${g.studentId}::${g.periodOrdinal}`, g);
      }

      for (const item of items) {
        const mapKey = `${item.studentId}::${item.periodOrdinal}`;
        let grade = gradeMap.get(mapKey);

        if (!grade) {
          grade = SubjectPeriodGrade.create({
            studentId: item.studentId,
            courseCycleId: item.courseCycleId,
            subjectId: item.subjectId,
            periodOrdinal: item.periodOrdinal,
          });
        }

        // Apply grade change if gradeScaleValueId is explicitly provided
        if (item.gradeScaleValueId !== undefined) {
          if (item.gradeScaleValueId === null) {
            grade.clearGrade();
          } else {
            // Look up the value for denormalized code + internalStatus
            const value = await this.gradeScaleRepo.findValueById(item.gradeScaleValueId);
            // Already validated above — safe to assert non-null
            const assignResult = grade.assignGrade({
              gradeScaleValueId: item.gradeScaleValueId,
              gradeCode: value!.code,
              internalStatus: value!.internalStatus,
            });
            if (assignResult.isErr()) {
              return err(assignResult.unwrapErr() as ValidationError);
            }
          }
        }

        // Apply flags (only fields that are explicitly provided)
        const hasFlags =
          item.pa !== undefined || item.ppi !== undefined || item.pp !== undefined;
        if (hasFlags) {
          grade.setFlags({ pa: item.pa, ppi: item.ppi, pp: item.pp });
        }

        allToSave.push(grade);
      }
    }

    // ── 4. Batch upsert ───────────────────────────────────────────────────────
    await this.periodGradeRepo.saveMany(allToSave);
    return ok(undefined);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async validateGradeScaleValue(
    gradeScaleValueId: string,
    level: number,
    modality: number,
  ): Promise<Result<void, ValidationError>> {
    const scale = await this.gradeScaleRepo.findActiveByLevelModality(level, modality);
    if (!scale) {
      return err(
        new ValidationError(
          `No active grade scale configured for level ${level}, modality ${modality}`,
        ),
      );
    }

    const value = await this.gradeScaleRepo.findValueById(gradeScaleValueId);
    if (!value) {
      return err(
        new ValidationError(
          `GradeScaleValue "${gradeScaleValueId}" not found`,
        ),
      );
    }

    if (value.scaleId !== scale.id) {
      return err(
        new ValidationError(
          `GradeScaleValue "${gradeScaleValueId}" does not belong to the active scale for this course cycle's level/modality`,
        ),
      );
    }

    return ok(undefined);
  }

  private async checkStudentExists(studentId: string): Promise<boolean> {
    const client = TenantContext.getClient();
    if (!client) return false;
    const student = await client.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    return student !== null;
  }
}
