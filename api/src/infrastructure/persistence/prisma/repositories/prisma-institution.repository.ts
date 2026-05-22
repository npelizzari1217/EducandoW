import { Injectable } from '@nestjs/common';
import { InstitutionRepository, Institution, Id, Level, LevelType } from '@educandow/domain';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PrismaInstitutionRepository implements InstitutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Institution | null> {
    const record = await this.prisma.institution.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(): Promise<Institution[]> {
    const records = await this.prisma.institution.findMany({ orderBy: { name: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async save(institution: Institution): Promise<void> {
    await this.prisma.institution.upsert({
      where: { id: institution.id.get() },
      create: {
        id: institution.id.get(),
        name: institution.name,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
        levels: institution.levels.map((l) => l.toString()),
      },
      update: {
        name: institution.name,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
        levels: institution.levels.map((l) => l.toString()),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.institution.delete({ where: { id } }).catch(() => {});
  }

  async existsByName(name: string): Promise<boolean> {
    const found = await this.prisma.institution.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    return !!found;
  }

  private toDomain(record: Record<string, unknown>): Institution {
    return Institution.reconstruct({
      id: Id.reconstruct(record.id as string),
      name: record.name as string,
      levels: ((record.levels as string[]) ?? []).map((l) => Level.reconstruct(l as LevelType)),
      address: record.address as string | undefined,
      phone: record.phone as string | undefined,
      email: record.email as string | undefined,
    });
  }
}
