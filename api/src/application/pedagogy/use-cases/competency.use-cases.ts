import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError, NotFoundError } from '@educandow/domain';
import { SubjectCompetency, CompetencyValuation } from '@educandow/domain';
import type {
  SubjectCompetencyRepository,
  CompetencyValuationRepository,
  StudyPlanRepository,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

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

// ── CompetencyValuation Use Cases ──────────────────────

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

@Injectable()
export class UpdateCompetencyValuationUC {
  constructor(private repo: CompetencyValuationRepository) {}

  async execute(uuid: string, input: Record<string, unknown>): Promise<Result<CompetencyValuation, Error>> {
    const v = await this.repo.findById(uuid);
    if (!v) return err(new ValidationError('Valoración no encontrada'));

    for (let period = 1; period <= 4; period++) {
      const valKey = `valuation${period}`;
      const modKey = `modificable${period}`;
      const impKey = `imprimible${period}`;

      if (impKey in input) {
        v.setImprimible(period as 1 | 2 | 3 | 4, input[impKey] as boolean);
      }

      if (valKey in input) {
        if (!v.isModificable(period as 1 | 2 | 3 | 4)) {
          return err(new ValidationError(`El período ${period} no es modificable`));
        }
        v.setValuation(period as 1 | 2 | 3 | 4, input[valKey] as string | null);
      }

      if (modKey in input) {
        v.setModificable(period as 1 | 2 | 3 | 4, input[modKey] as boolean);
      }
    }

    if ('periodActive' in input) {
      v.setPeriodActive(input.periodActive as number);
    }

    await this.repo.save(v);
    return ok(v);
  }
}

// ── Auto-Creation ──────────────────────────────────────

@Injectable()
export class AutoCreateCompetencyValuationsUC {
  constructor(
    private competencyRepo: SubjectCompetencyRepository,
    private valuationRepo: CompetencyValuationRepository,
    private studyPlanRepo: StudyPlanRepository,
  ) {}

  /**
   * Given a subject ID and course section ID, navigate through the StudyPlan
   * hierarchy to find active competencies, then create valuations for each
   * enrolled student × active competency pair.
   */
  async executeForSubjectAssignment(subjectId: string, courseSectionId: string): Promise<void> {
    // Navigate hierarchy: courseSection + subjectId → StudyPlanSubject IDs
    const spsIds = await this.studyPlanRepo.findStudyPlanSubjectIds(courseSectionId, subjectId);
    if (spsIds.length === 0) return;

    // Flatten competencies from all matching StudyPlanSubjects
    const competencies = (
      await Promise.all(spsIds.map((id) => this.competencyRepo.findActiveByStudyPlanSubject(id)))
    ).flat();
    if (competencies.length === 0) return;

    // Find enrolled students in this course section
    const studentIds = await this.findEnrolledStudentIds(courseSectionId);
    if (studentIds.length === 0) return;

    // Build valuation records for each (student × competency) pair — skip existing
    const valuations: CompetencyValuation[] = [];
    for (const studentId of studentIds) {
      for (const competency of competencies) {
        const existing = await this.valuationRepo.findByStudentAndCompetency(
          studentId,
          competency.id.get(),
        );
        if (!existing) {
          valuations.push(this.buildValuation(competency.id.get(), studentId));
        }
      }
    }

    if (valuations.length > 0) {
      await this.valuationRepo.bulkCreate(valuations);
    }
  }

  /**
   * Given a student ID and course section ID, create valuations for all
   * active competencies linked to the course section's subject assignments,
   * navigating through the StudyPlan hierarchy.
   */
  async executeForEnrollment(studentId: string, courseSectionId: string): Promise<void> {
    const assignments = await this.findSubjectAssignments(courseSectionId);
    if (assignments.length === 0) return;

    // Resolve all StudyPlanSubject IDs for each assignment's subjectId
    const spsIdArrays = await Promise.all(
      assignments.map((a) => this.studyPlanRepo.findStudyPlanSubjectIds(courseSectionId, a.subjectId)),
    );
    const allSpsIds = spsIdArrays.flat();
    if (allSpsIds.length === 0) return;

    // Flatten competencies from all matching StudyPlanSubjects
    const competencyArrays = await Promise.all(
      allSpsIds.map((id) => this.competencyRepo.findActiveByStudyPlanSubject(id)),
    );
    const competencies = competencyArrays.flat();
    if (competencies.length === 0) return;

    const valuations: CompetencyValuation[] = [];
    for (const competency of competencies) {
      const existing = await this.valuationRepo.findByStudentAndCompetency(
        studentId,
        competency.id.get(),
      );
      if (!existing) {
        valuations.push(this.buildValuation(competency.id.get(), studentId));
      }
    }

    if (valuations.length > 0) {
      await this.valuationRepo.bulkCreate(valuations);
    }
  }

  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no client available');
    return c;
  }

  private async findEnrolledStudentIds(courseSectionId: string): Promise<string[]> {
    const section = await this.client.courseSection.findUnique({
      where: { id: courseSectionId },
      select: { level: true, grade: true, division: true, academicYear: true },
    });
    if (!section) return [];

    const enrollments = await this.client.enrollment.findMany({
      where: {
        level: section.level,
        grade: section.grade,
        division: section.division,
        academicYear: section.academicYear,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { studentId: true },
    });

    return enrollments.map((e) => e.studentId);
  }

  /**
   * Given an enrollment's level/grade/division/academicYear, find all matching
   * course sections and create valuations for the student across all active
   * competencies of each section's subject assignments.
   */
  async executeForNewEnrollment(
    studentId: string,
    enrollmentData: { level: number; grade?: string; division?: string; academicYear: string },
  ): Promise<void> {
    const sections = await this.client.courseSection.findMany({
      where: {
        level: enrollmentData.level,
        grade: enrollmentData.grade ?? null,
        division: enrollmentData.division ?? null,
        academicYear: enrollmentData.academicYear,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (sections.length === 0) return;

    for (const section of sections) {
      await this.executeForEnrollment(studentId, section.id);
    }
  }

  private async findSubjectAssignments(courseSectionId: string): Promise<{ subjectId: string }[]> {
    const assignments = await this.client.subjectAssignment.findMany({
      where: { courseSectionId, deletedAt: null },
      select: { subjectId: true },
    });
    return assignments;
  }

  private buildValuation(competencyId: string, studentId: string): CompetencyValuation {
    return CompetencyValuation.create({
      competencyId,
      studentId,
      valuation1: null,
      valuation2: null,
      valuation3: null,
      valuation4: null,
      modificable1: true,
      modificable2: true,
      modificable3: true,
      modificable4: true,
      imprimible1: false,
      imprimible2: false,
      imprimible3: false,
      imprimible4: false,
      periodActive: 1,
    });
  }
}
