import { Injectable } from '@nestjs/common';
import { StudyPlanRepository, StudyPlanCourseDto, StudyPlan, Id, EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaStudyPlanRepository implements StudyPlanRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available');
    return c;
  }

  async findById(id: string): Promise<StudyPlan | null> {
    const r = await this.client.studyPlan.findUnique({
      where: { id },
      include: { courses: { include: { subjects: true } } },
    });
    return r ? this.toDomain(r) : null;
  }

  async findAll(level?: number): Promise<StudyPlan[]> {
    const where: any = { active: true, deletedAt: null };
    if (level != null) where.level = level;
    const records = await this.client.studyPlan.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { courses: { include: { subjects: true } } },
    });
    return records.map((r: any) => this.toDomain(r));
  }

  async save(plan: StudyPlan): Promise<void> {
    await this.client.studyPlan.upsert({
      where: { id: plan.id.get() },
      update: { name: plan.name, level: plan.level, modality: plan.modality, academicYear: plan.academicYear, active: plan.active, deletedAt: plan.deletedAt ?? null },
      create: { id: plan.id.get(), name: plan.name, level: plan.level, modality: plan.modality, academicYear: plan.academicYear },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.client.studyPlan.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
  }

  // ── Course management ──
  async addCourse(planId: string, courseSectionId: string): Promise<void> {
    await this.client.studyPlanCourse.upsert({
      where: { studyPlanId_courseSectionId: { studyPlanId: planId, courseSectionId } },
      create: { studyPlanId: planId, courseSectionId },
      update: {},
    });
  }

  async removeCourse(planId: string, courseSectionId: string): Promise<void> {
    await this.client.studyPlanCourse.deleteMany({
      where: { studyPlanId: planId, courseSectionId },
    });
  }

  // ── Subject management ──
  async addSubject(planCourseId: string, subjectId: string, hoursPerWeek?: number): Promise<void> {
    await this.client.studyPlanSubject.upsert({
      where: { studyPlanCourseId_subjectId: { studyPlanCourseId: planCourseId, subjectId } },
      create: { studyPlanCourseId: planCourseId, subjectId, hoursPerWeek },
      update: { hoursPerWeek },
    });
  }

  async removeSubject(planCourseId: string, subjectId: string): Promise<void> {
    await this.client.studyPlanSubject.deleteMany({
      where: { studyPlanCourseId: planCourseId, subjectId },
    });
  }

  // ── PlanCourse queries ──
  async findPlanCourseById(id: string): Promise<StudyPlanCourseDto | null> {
    const r = await this.client.studyPlanCourse.findUnique({
      where: { id },
      include: { subjects: { include: { subject: true } }, studyPlan: true, courseSection: true },
    });
    if (!r) return null;
    const cs = (r as any).courseSection;
    return {
      id: r.id,
      studyPlanId: r.studyPlanId,
      courseSectionId: r.courseSectionId,
      courseSectionName: cs?.name ?? undefined,
      courseGrade: cs?.grade ?? undefined,
      courseDivision: cs?.division ?? undefined,
      subjects: (r as any).subjects?.map((s: any) => ({
        id: s.id,
        subjectId: s.subjectId || s.subject?.id,
        subjectName: s.subject?.name ?? undefined,
        hoursPerWeek: s.hoursPerWeek ?? undefined,
      })) ?? [],
    };
  }

  async findPlanCoursesByPlan(planId: string): Promise<StudyPlanCourseDto[]> {
    const records = await this.client.studyPlanCourse.findMany({
      where: { studyPlanId: planId },
      include: { subjects: { include: { subject: true } }, courseSection: true },
    });
    return records.map((r) => {
      const cs = (r as any).courseSection;
      return {
        id: r.id,
        studyPlanId: r.studyPlanId,
        courseSectionId: r.courseSectionId,
        courseSectionName: cs?.name ?? undefined,
        courseGrade: cs?.grade ?? undefined,
        courseDivision: cs?.division ?? undefined,
        subjects: (r as any).subjects?.map((s: any) => ({
          id: s.id,
          subjectId: s.subjectId || s.subject?.id,
          subjectName: s.subject?.name ?? undefined,
          hoursPerWeek: s.hoursPerWeek ?? undefined,
        })) ?? [],
      };
    });
  }

  private toDomain(r: any): StudyPlan {
    return StudyPlan.reconstruct({
      id: Id.reconstruct(r.id),
      name: r.name,
      level: r.level as EducationalLevelCode,
      modality: r.modality as EducationalModalityCode,
      academicYear: r.academicYear,
      active: r.active,
      deletedAt: r.deletedAt ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
