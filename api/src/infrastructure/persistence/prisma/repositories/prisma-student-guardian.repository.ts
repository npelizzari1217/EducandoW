import { Injectable } from '@nestjs/common';
import {
  StudentGuardianRepository,
  StudentGuardian,
  Id,
  NotFoundError,
  Mobile,
  Email,
  ValidationError,
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
    try {
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
    } catch (e: unknown) {
      // Fix #3 (round-3): map Postgres unique-violation (P2002) on the @@unique([studentId, userId])
      // portal-link constraint to GUARDIAN_ALREADY_ASSIGNED so the controller can return 409.
      // This catches TOCTOU races that bypass the application-layer findByComposite check.
      // NOTE: the partial index on (studentId, fullName) was reverted (REQ-RYT-08-C requires
      // allowDuplicate to truly work); there is no longer a DB constraint for study-tutor names.
      if (
        e instanceof Error &&
        (e as Record<string, unknown>)['code'] === 'P2002' &&
        String((e as Record<string, unknown>)['meta']?.['target'] ?? '').includes('userId')
      ) {
        throw new ValidationError('GUARDIAN_ALREADY_ASSIGNED');
      }
      throw e;
    }
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
    // Round5-Bug1 (Security): filter active:true so deactivated portal guardians lose access.
    // A guardian set active:false must NOT appear in GetMyChildrenUseCase or PatchStudentUseCase
    // ownership checks — deactivation revokes portal access immediately.
    const records = await this.client.studentGuardian.findMany({
      where: { userId: guardianUserId, active: true },
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
    // Fix #2 (round-3): filter userId IS NULL so portal-linked guardians sharing a name
    // do not block study-tutor registration (they are different record types).
    const record = await this.client.studentGuardian.findFirst({
      where: { studentId, fullName, active: true, userId: null },
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
