import { Injectable } from '@nestjs/common';
import {
  StudentGuardianRepository,
  StudentGuardian,
  Id,
  NotFoundError,
  Mobile,
  Email,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

@Injectable()
export class PrismaStudentGuardianRepository implements StudentGuardianRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async save(guardian: StudentGuardian): Promise<void> {
    await this.client.studentGuardian.upsert({
      where: { id: guardian.id.get() },
      create: {
        id: guardian.id.get(),
        studentId: guardian.studentId,
        userId: guardian.userId ?? null,
        relationship: guardian.relationship,
        fullName: guardian.fullName ?? null,
        mobile: guardian.mobile?.get() ?? null,
        email: guardian.email?.get() ?? null,
        isFinancialResponsible: guardian.isFinancialResponsible,
        isAuthorizedToPickUp: guardian.isAuthorizedToPickUp,
        active: guardian.active,
        createdAt: guardian.createdAt,
        updatedAt: guardian.updatedAt,
      },
      update: {
        relationship: guardian.relationship,
        fullName: guardian.fullName ?? null,
        mobile: guardian.mobile?.get() ?? null,
        email: guardian.email?.get() ?? null,
        isFinancialResponsible: guardian.isFinancialResponsible,
        isAuthorizedToPickUp: guardian.isAuthorizedToPickUp,
        active: guardian.active,
        updatedAt: guardian.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<StudentGuardian | null> {
    const record = await this.client.studentGuardian.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByStudentId(studentId: string): Promise<StudentGuardian[]> {
    const records = await this.client.studentGuardian.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByGuardianUserId(guardianUserId: string): Promise<StudentGuardian[]> {
    const records = await this.client.studentGuardian.findMany({
      where: { userId: guardianUserId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByComposite(studentId: string, userId: string): Promise<StudentGuardian | null> {
    const record = await this.client.studentGuardian.findFirst({
      where: { studentId, userId },
    });
    return record ? this.toDomain(record) : null;
  }

  async findStudyTutor(studentId: string, fullName: string): Promise<StudentGuardian | null> {
    // Bug 8 fix: only consider active tutors as duplicates.
    // A deactivated tutor with the same name must not block re-registration.
    const record = await this.client.studentGuardian.findFirst({
      where: { studentId, fullName, active: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.client.studentGuardian.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('StudentGuardian', id);
    }
    await this.client.studentGuardian.delete({ where: { id } });
  }

  private toDomain(record: Record<string, unknown>): StudentGuardian {
    return StudentGuardian.reconstruct({
      id: Id.reconstruct(record.id as string),
      studentId: record.studentId as string,
      userId: (record.userId as string | null) ?? undefined,
      relationship: record.relationship as string,
      fullName: (record.fullName as string | null) ?? undefined,
      mobile: record.mobile ? Mobile.reconstruct(record.mobile as string) : undefined,
      email: record.email ? Email.reconstruct(record.email as string) : undefined,
      isFinancialResponsible: (record.isFinancialResponsible as boolean) ?? false,
      isAuthorizedToPickUp: (record.isAuthorizedToPickUp as boolean) ?? false,
      active: (record.active as boolean) ?? true,
      createdAt: new Date(record.createdAt as string),
      updatedAt: new Date(record.updatedAt as string),
    });
  }
}
