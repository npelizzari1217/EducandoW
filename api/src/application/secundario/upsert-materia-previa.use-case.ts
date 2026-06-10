/**
 * PR4-T8 [GREEN] — UpsertMateriaPreviaUseCase.
 *
 * Creates or updates a MateriaPrevia record for a student:
 *   - Validates studentId exists in tenant → 404 if not
 *   - Validates subjectId exists in tenant → 404 if not
 *   - Delegates condicion=REGULAR rejection to MateriaPrevia.create() → ValidationError 400
 *   - Calls MateriaPreviaRepository.saveMany([item]) for upsert semantics
 *
 * Tenant isolation: TenantContext scopes the Prisma client — cross-tenant
 * student/subject lookups return null (→ NotFoundError).
 *
 * Specs: MP-R1..MP-R7, D2
 */
import { Injectable, Inject } from '@nestjs/common';
import {
  MateriaPrevia,
  MATERIA_PREVIA_REPOSITORY,
  MateriaPreviaRepository,
  SubjectFinalGradeCondicion,
  Result,
  ok,
  err,
  NotFoundError,
  ValidationError,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

// ── Input ──────────────────────────────────────────────────────────────────────

export interface UpsertMateriaPreviaInput {
  studentId:           string;
  subjectId:           string;
  originAcademicYear:  string;
  condicion:           SubjectFinalGradeCondicion;
  originCourseCycleId?: string;
}

// ── Symbol token ──────────────────────────────────────────────────────────────

export const UPSERT_MATERIA_PREVIA = Symbol('UPSERT_MATERIA_PREVIA');

// ── Use case ──────────────────────────────────────────────────────────────────

@Injectable()
export class UpsertMateriaPreviaUseCase {
  constructor(
    @Inject(MATERIA_PREVIA_REPOSITORY)
    private readonly repo: MateriaPreviaRepository,
  ) {}

  async execute(
    input: UpsertMateriaPreviaInput,
  ): Promise<Result<MateriaPrevia, NotFoundError | ValidationError>> {
    const client = TenantContext.getClient();

    // ── 1. Validate studentId exists in tenant ──────────────────────────────
    const student = await client?.student.findUnique({
      where: { id: input.studentId },
      select: { id: true },
    });
    if (!student) {
      return err(new NotFoundError('Student', input.studentId));
    }

    // ── 2. Validate subjectId exists in tenant ──────────────────────────────
    const subject = await client?.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) {
      return err(new NotFoundError('Subject', input.subjectId));
    }

    // ── 3. Create domain entity (validates condicion ≠ REGULAR) ────────────
    const createResult = MateriaPrevia.create({
      studentId:           input.studentId,
      subjectId:           input.subjectId,
      originAcademicYear:  input.originAcademicYear,
      condicion:           input.condicion,
      originCourseCycleId: input.originCourseCycleId,
    });

    if (createResult.isErr()) {
      return err(createResult.unwrapErr());
    }

    const item = createResult.unwrap();

    // ── 4. Persist (upsert on unique key via repo) ────────────────────────
    await this.repo.saveMany([item]);

    return ok(item);
  }
}
