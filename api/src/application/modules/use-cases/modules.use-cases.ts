import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class ListModulesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{ id: string; code: string; name: string; active: boolean; createdAt: Date; updatedAt: Date; actions: string[] }[]> {
    const client = this.prisma.getMasterClient();

    const [records, actionRecords] = await Promise.all([
      client.module.findMany({
        where: { active: true, deletedAt: null },
        orderBy: { code: 'asc' },
      }),
      client.moduleAction.findMany({
        where: { active: true, deletedAt: null },
        select: { code: true },
      }),
    ]);

    const actions = actionRecords.map((a) => a.code);

    return records.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      actions,
    }));
  }
}

@Injectable()
export class CreateModuleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: { code: string; name: string }): Promise<{ id: string; code: string; name: string }> {
    const record = await this.prisma.getMasterClient().module.create({
      data: {
        code: input.code.toUpperCase().trim(),
        name: input.name.trim(),
      },
    });
    return { id: record.id, code: record.code, name: record.name };
  }
}

@Injectable()
export class UpdateModuleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, input: { code?: string; name?: string; active?: boolean }): Promise<{ id: string; code: string; name: string; active: boolean } | null> {
    const existing = await this.prisma.getMasterClient().module.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code.toUpperCase().trim();
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.active !== undefined) data.active = input.active;

    const record = await this.prisma.getMasterClient().module.update({
      where: { id },
      data,
    });
    return { id: record.id, code: record.code, name: record.name, active: record.active };
  }
}

@Injectable()
export class DeleteModuleUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string): Promise<boolean> {
    const existing = await this.prisma.getMasterClient().module.findUnique({ where: { id } });
    if (!existing) return false;

    await this.prisma.getMasterClient().module.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
    return true;
  }
}
