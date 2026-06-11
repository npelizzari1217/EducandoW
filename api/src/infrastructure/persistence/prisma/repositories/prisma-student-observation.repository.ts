import { Injectable } from '@nestjs/common';
import {
  StudentObservationRepository,
  StudentObservation,
  ObservationType,
  ObservationTypeValue,
  Id,
} from '@educandow/domain';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

interface ObservationRow {
  id: string;
  studentId: string;
  authorId: string;
  type: string;
  content: string;
  enrollmentId: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PrismaStudentObservationRepository implements StudentObservationRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  async save(observation: StudentObservation): Promise<void> {
    await this.client.studentObservation.upsert({
      where: { id: observation.id.get() },
      create: {
        id: observation.id.get(),
        studentId: observation.studentId.get(),
        authorId: observation.authorId.get(),
        type: observation.type.value,
        content: observation.content,
        enrollmentId: observation.enrollmentId?.get() ?? null,
      },
      update: {
        type: observation.type.value,
        content: observation.content,
        enrollmentId: observation.enrollmentId?.get() ?? null,
      },
    });
  }

  async findById(id: Id): Promise<StudentObservation | null> {
    const record = await this.client.studentObservation.findUnique({
      where: { id: id.get() },
    });
    if (!record) return null;
    if (record.deletedAt) return null;
    return this.toDomain(record);
  }

  async findByStudentId(studentId: Id): Promise<StudentObservation[]> {
    const records = await this.client.studentObservation.findMany({
      where: {
        studentId: studentId.get(),
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByStudentIds(studentIds: Id[]): Promise<StudentObservation[]> {
    if (studentIds.length === 0) return [];
    const ids = studentIds.map((id) => id.get());
    const records = await this.client.studentObservation.findMany({
      where: {
        studentId: { in: ids },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async delete(id: Id): Promise<void> {
    await this.client.studentObservation.update({
      where: { id: id.get() },
      data: { deletedAt: new Date(), active: false },
    });
  }

  private toDomain(record: ObservationRow): StudentObservation {
    const typeResult = ObservationType.create(record.type);
    return StudentObservation.reconstruct({
      id: Id.reconstruct(record.id),
      studentId: Id.reconstruct(record.studentId),
      authorId: Id.reconstruct(record.authorId),
      type: typeResult.isOk() ? typeResult.unwrap() : ObservationType.reconstruct(ObservationTypeValue.PEDAGOGICAL),
      content: record.content,
      enrollmentId: record.enrollmentId ? Id.reconstruct(record.enrollmentId) : undefined,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt ?? undefined,
    });
  }
}
