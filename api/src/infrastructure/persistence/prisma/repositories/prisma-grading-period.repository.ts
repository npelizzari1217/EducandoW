import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  GradingPeriodTemplate,
  GradingPeriodDate,
  GradingPeriodRepository,
  GradingPeriodTemplateFilters,
} from '@educandow/domain';
import type {
  PrismaClient as TenantPrismaClient,
  GradingPeriodTemplate as PrismaGradingPeriodTemplate,
  GradingPeriodTemplateItem as PrismaGradingPeriodTemplateItem,
  GradingPeriodDate as PrismaGradingPeriodDate,
} from '@prisma/tenant-client';
import { TenantContext } from '../../../auth/tenant.context';

// ── Row type helpers ───────────────────────────────────────

type PrismaTemplateWithItems = PrismaGradingPeriodTemplate & {
  items?: PrismaGradingPeriodTemplateItem[];
};

@Injectable()
export class PrismaGradingPeriodRepository implements GradingPeriodRepository {
  private get client(): TenantPrismaClient {
    const c = TenantContext.getClient();
    if (!c) throw new Error('TenantContext: no tenant client available for this request');
    return c;
  }

  // ─── Template operations ───────────────────────────────

  async findTemplateById(id: string): Promise<GradingPeriodTemplate | null> {
    const r = await this.client.gradingPeriodTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    return r ? this.toDomainTemplate(r) : null;
  }

  async listTemplates(filters?: GradingPeriodTemplateFilters): Promise<GradingPeriodTemplate[]> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (filters?.level !== undefined) where.level = filters.level;
    if (filters?.modality !== undefined) where.modality = filters.modality;
    if (filters?.active !== undefined) where.active = filters.active;

    const rows = await this.client.gradingPeriodTemplate.findMany({
      where,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toDomainTemplate(r));
  }

  async existsTemplateName(
    level: number,
    modality: number,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const where: Record<string, unknown> = { level, modality, name, deletedAt: null };
    if (excludeId) where.NOT = { id: excludeId };
    const count = await this.client.gradingPeriodTemplate.count({ where });
    return count > 0;
  }

  /**
   * Upserts a template and replaces all its items in a transaction.
   * Item replacement is: deleteMany existing items + createMany new items.
   */
  async saveTemplate(template: GradingPeriodTemplate): Promise<void> {
    const templateData = {
      name: template.name,
      level: template.level,
      modality: template.modality,
      active: template.active,
      deletedAt: template.deletedAt ?? null,
    };

    await this.client.$transaction(async (tx) => {
      await tx.gradingPeriodTemplate.upsert({
        where: { id: template.id },
        create: { id: template.id, ...templateData },
        update: templateData,
      });

      // Replace all items
      await tx.gradingPeriodTemplateItem.deleteMany({
        where: { templateId: template.id },
      });

      if (template.items.length > 0) {
        await tx.gradingPeriodTemplateItem.createMany({
          data: template.items.map((item) => ({
            id: item.id,
            templateId: item.templateId,
            name: item.name,
            sortOrder: item.sortOrder,
          })),
        });
      }
    });
  }

  async countDatesForTemplate(templateId: string): Promise<number> {
    return this.client.gradingPeriodDate.count({
      where: { item: { templateId } },
    });
  }

  async softDeleteTemplate(id: string): Promise<void> {
    await this.client.gradingPeriodTemplate.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  // ─── Date operations ───────────────────────────────────

  async listDates(templateId: string, cycleId: string): Promise<GradingPeriodDate[]> {
    const rows = await this.client.gradingPeriodDate.findMany({
      where: { cycleId, item: { templateId } },
      orderBy: { item: { sortOrder: 'asc' } },
    });
    return rows.map((r) => this.toDomainDate(r));
  }

  async saveDates(
    itemId: string,
    cycleId: string,
    range: { startDate: Date; endDate: Date },
  ): Promise<void> {
    await this.client.gradingPeriodDate.upsert({
      where: { itemId_cycleId: { itemId, cycleId } },
      create: {
        id: randomUUID(),
        itemId,
        cycleId,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      update: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
    });
  }

  async findDatesByCycle(templateId: string, cycleId: string): Promise<GradingPeriodDate[]> {
    const rows = await this.client.gradingPeriodDate.findMany({
      where: { cycleId, item: { templateId } },
      orderBy: { item: { sortOrder: 'asc' } },
    });
    return rows.map((r) => this.toDomainDate(r));
  }

  // ── Private helpers ────────────────────────────────────

  private toDomainTemplate(r: PrismaTemplateWithItems): GradingPeriodTemplate {
    return GradingPeriodTemplate.reconstruct({
      id: r.id,
      name: r.name,
      level: r.level,
      modality: r.modality,
      active: r.active,
      deletedAt: r.deletedAt ?? null,
      items: (r.items ?? []).map((item) => ({
        id: item.id,
        templateId: item.templateId,
        name: item.name,
        sortOrder: item.sortOrder,
      })),
    });
  }

  private toDomainDate(r: PrismaGradingPeriodDate): GradingPeriodDate {
    return GradingPeriodDate.reconstruct({
      id: r.id,
      itemId: r.itemId,
      cycleId: r.cycleId,
      startDate: r.startDate,
      endDate: r.endDate,
    });
  }
}
