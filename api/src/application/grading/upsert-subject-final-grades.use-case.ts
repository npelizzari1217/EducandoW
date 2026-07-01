/**
 * PR4-T10 [GREEN] — UpsertSubjectFinalGradesUseCase.
 * Fase 5 [GREEN] — F5-A4: authorization via AssignmentAuthorizer.
 *
 * Conditional lifecycle enforced HERE, not in the entity (AD-2):
 *   - DICIEMBRE blocked when FINAL.passed=true → 400
 *   - MARZO blocked when DICIEMBRE.passed=true → 400
 *   - DEFINITIVA has no lifecycle block
 *   - passed field accepted on all types
 * Validations:
 *   - Auth: userId must be authorized to write for each (courseCycleId, subjectId) → 403 (F5-A4)
 *   - courseCycleId must exist in tenant → 404
 *   - studentId must exist in tenant → 404
 *   - gradeScaleValueId (if provided) must belong to active scale for CC level/modality → 400
 * Specs: SFG-R3..R9, AD-2
 */
import { Injectable } from '@nestjs/common';
import { Result, ok, err, NotFoundError, ValidationError, ForbiddenError, SubjectFinalGrade, SubjectFinalGradeType, SubjectFinalGradeCondicion, GradingPhaseViolationError } from '@educandow/domain';
import type {
  SubjectFinalGradeRepository,
  CourseCycleRepository,
  GradeScaleRepository,
  AssignmentAuthorizerPort,
  GradingPhaseAuthorizerPort,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Input types ───────────────────────────────────────────────────────────────

export interface UpsertFinalGradeItem {
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  type: SubjectFinalGradeType;
  /** When present, assigns the grade snapshot. When undefined, grade fields are unchanged. */
  gradeScaleValueId?: string;
  /** Teacher-supplied promotion verdict (SFG-R4). */
  passed?: boolean;
  /** Year-end condicion for Secundario (REGULAR | PREVIA | LIBRE). Optional — undefined leaves existing condicion unchanged. */
  condicion?: SubjectFinalGradeCondicion;
}

export interface UpsertSubjectFinalGradesInput {
  /**
   * Authenticated user performing the write.
   * When provided, the assignment authorizer checks group membership before writing (F5-A4).
   */
  userId?: string;
  userRoles?: string[];
  items: UpsertFinalGradeItem[];
}

// ── Use case ──────────────────────────────────────────────────────────────────

@Injectable()
export class UpsertSubjectFinalGradesUseCase {
  constructor(
    private readonly finalGradeRepo: SubjectFinalGradeRepository,
    private readonly ccRepo: CourseCycleRepository,
    private readonly gradeScaleRepo: GradeScaleRepository,
    private readonly authorizer: AssignmentAuthorizerPort,
    private readonly phaseAuthorizer: GradingPhaseAuthorizerPort,
  ) {}

  async execute(
    input: UpsertSubjectFinalGradesInput,
  ): Promise<Result<void, NotFoundError | ValidationError | ForbiddenError | GradingPhaseViolationError>> {
    if (input.items.length === 0) return ok(undefined);

    // ── 0. Authorization check (F5-A4) — one check per unique (cc, subject) ──
    if (input.userId !== undefined) {
      const authGroups = new Set(input.items.map((i) => `${i.courseCycleId}::${i.subjectId}`));
      for (const key of authGroups) {
        const [courseCycleId, subjectId] = key.split('::');
        const allowed = await this.authorizer.canWriteGrades(
          input.userId,
          input.userRoles ?? [],
          courseCycleId,
          subjectId,
        );
        if (!allowed) {
          return err(new ForbiddenError(
            `User "${input.userId}" is not authorized to write final grades for subject "${subjectId}" in course-cycle "${courseCycleId}"`,
          ));
        }
      }
    }

    // ── 1. Group items by (courseCycleId, subjectId, studentId) for lifecycle checks
    // We need to load existing finals per (studentId, courseCycleId, subjectId) combo.
    //
    // First pass: validate CC existence and collect grading contexts.
    const ccContexts = new Map<string, { level: number; modality: number }>();

    for (const item of input.items) {
      if (!ccContexts.has(item.courseCycleId)) {
        const ctx = await this.ccRepo.findGradingContextByUuid(item.courseCycleId);
        if (!ctx) {
          return err(new NotFoundError('CourseCycle', item.courseCycleId));
        }
        ccContexts.set(item.courseCycleId, ctx);
      }
    }

    // ── 1b. Grading-phase gate (PR-1b) — once per unique courseCycleId ────────
    // Special grades (SubjectFinalGrade) are only writable during CIERRE.
    for (const courseCycleId of ccContexts.keys()) {
      const decision = await this.phaseAuthorizer.canGradeFinal(courseCycleId);
      if (!decision.allowed) {
        return err(
          new GradingPhaseViolationError(
            courseCycleId,
            'special grades (SubjectFinalGrade) can only be written during CIERRE',
          ),
        );
      }
    }

    // ── 2. Validate studentId existence ──────────────────────────────────────
    const checkedStudents = new Set<string>();
    for (const item of input.items) {
      const studentKey = `${item.courseCycleId}::${item.studentId}`;
      if (!checkedStudents.has(studentKey)) {
        const exists = await this.checkStudentExists(item.studentId);
        if (!exists) {
          return err(new NotFoundError('Student', item.studentId));
        }
        checkedStudents.add(studentKey);
      }
    }

    // ── 3. Validate gradeScaleValueId if provided ─────────────────────────────
    for (const item of input.items) {
      if (item.gradeScaleValueId != null) {
        const ctx = ccContexts.get(item.courseCycleId)!;
        const scaleResult = await this.validateGradeScaleValue(
          item.gradeScaleValueId,
          ctx.level,
          ctx.modality,
        );
        if (scaleResult.isErr()) return err(scaleResult.unwrapErr());
      }
    }

    // ── 4. Group items by (courseCycleId, subjectId) to load existing finals ──
    const groupKey = (item: UpsertFinalGradeItem) =>
      `${item.courseCycleId}::${item.subjectId}`;

    const groupsToLoad = new Set(input.items.map(groupKey));
    // Map: `ccId::subjId` → Map<`studentId::type`, SubjectFinalGrade>
    const existingFinalsByGroup = new Map<string, Map<string, SubjectFinalGrade>>();

    for (const gk of groupsToLoad) {
      const [courseCycleId, subjectId] = gk.split('::');
      const finals = await this.finalGradeRepo.findByCourseCycleAndSubject(
        courseCycleId,
        subjectId,
      );
      const map = new Map<string, SubjectFinalGrade>();
      for (const f of finals) {
        map.set(`${f.studentId}::${f.type}`, f);
      }
      existingFinalsByGroup.set(gk, map);
    }

    // ── 5. Lifecycle checks and build upsert list ─────────────────────────────
    const allToSave: SubjectFinalGrade[] = [];

    for (const item of input.items) {
      const gk = groupKey(item);
      const existingMap = existingFinalsByGroup.get(gk)!;

      // Lifecycle block (AD-2)
      if (item.type === SubjectFinalGradeType.DICIEMBRE) {
        const finalRow = existingMap.get(`${item.studentId}::${SubjectFinalGradeType.FINAL}`);
        if (finalRow?.passed === true) {
          return err(
            new ValidationError(
              `Cannot write DICIEMBRE grade: FINAL grade is already passed for student "${item.studentId}"`,
            ),
          );
        }
      }

      if (item.type === SubjectFinalGradeType.MARZO) {
        const diciembreRow = existingMap.get(
          `${item.studentId}::${SubjectFinalGradeType.DICIEMBRE}`,
        );
        if (diciembreRow?.passed === true) {
          return err(
            new ValidationError(
              `Cannot write MARZO grade: DICIEMBRE grade is already passed for student "${item.studentId}"`,
            ),
          );
        }
      }

      // Find or create the grade row
      const existingKey = `${item.studentId}::${item.type}`;
      let grade = existingMap.get(existingKey);

      if (!grade) {
        grade = SubjectFinalGrade.create({
          studentId: item.studentId,
          courseCycleId: item.courseCycleId,
          subjectId: item.subjectId,
          type: item.type,
        });
      }

      // Apply grade if gradeScaleValueId is explicitly provided
      if (item.gradeScaleValueId !== undefined) {
        const value = await this.gradeScaleRepo.findValueById(item.gradeScaleValueId);
        const assignResult = grade.assignGrade({
          gradeScaleValueId: item.gradeScaleValueId,
          gradeCode: value!.code,
          internalStatus: value!.internalStatus,
        });
        if (assignResult.isErr()) {
          return err(assignResult.unwrapErr() as ValidationError);
        }
      }

      // Apply passed flag if provided
      if (item.passed !== undefined) {
        grade.setPassed(item.passed);
      }

      // Apply condicion if provided (undefined = no-op, preserves existing — COND-R2/COND-S5)
      if (item.condicion !== undefined) {
        grade.setCondicion(item.condicion);
      }

      // Cross-field condicion validation (D1): check combined state after both fields are applied.
      // These rules live HERE (use case), never in the entity — mirrors the AD-2/AD-7 precedent.
      // C-1: LIBRE excludes promotion — a student absent beyond threshold cannot be marked passed.
      if (grade.condicion === SubjectFinalGradeCondicion.LIBRE && grade.passed === true) {
        return err(
          new ValidationError(
            `Cannot set condicion=LIBRE with passed=true for student "${item.studentId}": LIBRE excludes promotion.`,
          ),
        );
      }
      // C-2: PREVIA excludes promotion — a subject carried as previa is not closed as passed.
      if (grade.condicion === SubjectFinalGradeCondicion.PREVIA && grade.passed === true) {
        return err(
          new ValidationError(
            `Cannot set condicion=PREVIA with passed=true for student "${item.studentId}": PREVIA excludes promotion.`,
          ),
        );
      }

      allToSave.push(grade);
    }

    // ── 6. Batch upsert ───────────────────────────────────────────────────────
    await this.finalGradeRepo.saveMany(allToSave);
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
