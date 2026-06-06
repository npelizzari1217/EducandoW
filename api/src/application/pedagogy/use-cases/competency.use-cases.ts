import { Injectable } from '@nestjs/common';
import { ok, err, Result, ValidationError } from '@educandow/domain';
import { SubjectCompetency, CompetencyValuation } from '@educandow/domain';
import type { SubjectCompetencyRepository, CompetencyValuationRepository } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// ── SubjectCompetency CRUD ─────────────────────────────

@Injectable()
export class CreateSubjectCompetencyUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(input: { subjectId: string; name: string; periodActive?: number }): Promise<Result<SubjectCompetency, Error>> {
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('El nombre de la competencia no puede estar vacío'));
    }

    const existing = await this.repo.findBySubjectAndName(input.subjectId, input.name);
    if (existing && (!existing.deletedAt)) {
      return err(new ValidationError(`Ya existe una competencia con el nombre "${input.name}" para esta materia`));
    }

    const competency = SubjectCompetency.create({
      subjectId: input.subjectId,
      name: input.name.trim(),
      periodActive: input.periodActive ?? 4,
    });

    await this.repo.save(competency);
    return ok(competency);
  }
}

@Injectable()
export class ListSubjectCompetenciesUC {
  constructor(private repo: SubjectCompetencyRepository) {}

  async execute(subjectId: string, active?: boolean): Promise<SubjectCompetency[]> {
    if (active === true) {
      return this.repo.findActiveBySubject(subjectId);
    }
    return this.repo.findBySubject(subjectId);
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

  async execute(id: string, input: { name?: string; periodActive?: number; active?: boolean }): Promise<Result<SubjectCompetency, Error>> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      return err(new ValidationError('Competencia no encontrada'));
    }

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        return err(new ValidationError('El nombre de la competencia no puede estar vacío'));
      }
      existing.updateName(input.name.trim());
    }

    if (input.periodActive !== undefined) {
      existing.setPeriodActive(input.periodActive);
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

  async execute(studentId: string, subjectId: string): Promise<CompetencyValuation[]> {
    return this.repo.findByStudentAndSubject(studentId, subjectId);
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
  ) {}

  /**
   * Given a course section ID and subject ID, find all enrolled students
   * and create competency valuations for each (student × active competency).
   */
  async executeForSubjectAssignment(subjectId: string, courseSectionId: string): Promise<void> {
    // Get active competencies for the subject
    const competencies = await this.competencyRepo.findActiveBySubject(subjectId);
    if (competencies.length === 0) return;

    // Find enrolled students in this course section
    const studentIds = await this.findEnrolledStudentIds(courseSectionId);
    if (studentIds.length === 0) return;

    // Build valuation records for each combination
    const valuations: CompetencyValuation[] = [];
    for (const studentId of studentIds) {
      for (const competency of competencies) {
        const existing = await this.valuationRepo.findByStudentAndCompetency(
          studentId,
          competency.id.get(),
        );
        if (!existing) {
          valuations.push(CompetencyValuation.create({
            competencyId: competency.id.get(),
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
          }));
        }
      }
    }

    if (valuations.length > 0) {
      await this.valuationRepo.bulkCreate(valuations);
    }
  }

  /**
   * Given a student ID and course section ID, create valuations for all
   * active competencies linked to the course section's subject assignments.
   */
  async executeForEnrollment(studentId: string, courseSectionId: string): Promise<void> {
    const assignments = await this.findSubjectAssignments(courseSectionId);
    if (assignments.length === 0) return;

    const valuations: CompetencyValuation[] = [];

    for (const assignment of assignments) {
      const competencies = await this.competencyRepo.findActiveBySubject(assignment.subjectId);
      for (const competency of competencies) {
        const existing = await this.valuationRepo.findByStudentAndCompetency(
          studentId,
          competency.id.get(),
        );
        if (!existing) {
          valuations.push(CompetencyValuation.create({
            competencyId: competency.id.get(),
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
          }));
        }
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
}
