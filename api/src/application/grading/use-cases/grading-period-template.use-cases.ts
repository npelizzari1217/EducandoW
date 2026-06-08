import { Injectable } from '@nestjs/common';
import {
  ok, err, Result,
  GradingPeriodTemplate,
  GradingPeriodRepository,
  GradingPeriodTemplateFilters,
  PeriodTemplateNameDuplicateError,
  PeriodTemplateNotFoundError,
  PeriodSortOrderDuplicateError,
  PeriodTemplateHasDatesError,
  PeriodTemplateItemNameDuplicateError,
} from '@educandow/domain';

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export interface CreateGradingPeriodTemplateInput {
  name: string;
  level: number;
  modality: number;
  items: Array<{ name: string; sortOrder: number }>;
}

@Injectable()
export class CreateGradingPeriodTemplateUseCase {
  constructor(private readonly repo: GradingPeriodRepository) {}

  async execute(
    input: CreateGradingPeriodTemplateInput,
  ): Promise<
    Result<
      GradingPeriodTemplate,
      | PeriodTemplateNameDuplicateError
      | PeriodSortOrderDuplicateError
      | PeriodTemplateItemNameDuplicateError
    >
  > {
    const duplicate = await this.repo.existsTemplateName(
      input.level,
      input.modality,
      input.name,
    );
    if (duplicate) {
      return err(
        new PeriodTemplateNameDuplicateError(input.level, input.modality, input.name),
      );
    }

    let template: GradingPeriodTemplate;
    try {
      template = GradingPeriodTemplate.create({
        name: input.name,
        level: input.level,
        modality: input.modality,
        items: input.items,
      });
    } catch (e) {
      return err(e as PeriodSortOrderDuplicateError);
    }

    await this.repo.saveTemplate(template);
    return ok(template);
  }
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export interface UpdateGradingPeriodTemplateInput {
  name?: string;
  active?: boolean;
  items?: Array<{ name: string; sortOrder: number }>;
}

@Injectable()
export class UpdateGradingPeriodTemplateUseCase {
  constructor(private readonly repo: GradingPeriodRepository) {}

  async execute(
    id: string,
    input: UpdateGradingPeriodTemplateInput,
  ): Promise<
    Result<
      GradingPeriodTemplate,
      | PeriodTemplateNotFoundError
      | PeriodTemplateNameDuplicateError
      | PeriodSortOrderDuplicateError
    >
  > {
    const entity = await this.repo.findTemplateById(id);
    if (!entity) {
      return err(new PeriodTemplateNotFoundError(id));
    }

    const newName = input.name ?? entity.name;

    if (input.name && input.name !== entity.name) {
      const duplicate = await this.repo.existsTemplateName(
        entity.level,
        entity.modality,
        input.name,
        id,
      );
      if (duplicate) {
        return err(
          new PeriodTemplateNameDuplicateError(entity.level, entity.modality, input.name),
        );
      }
    }

    // Resolve items: if input.items provided use them (new items, without id yet),
    // otherwise keep existing entity items as-is.
    type ReconstructItem = { id: string; templateId: string; name: string; sortOrder: number };
    const resolvedItems: ReconstructItem[] = input.items
      ? input.items.map((i) => ({ id: '', templateId: entity.id, name: i.name, sortOrder: i.sortOrder }))
      : entity.items.map((i) => ({ id: i.id, templateId: i.templateId, name: i.name, sortOrder: i.sortOrder }));

    let updated: GradingPeriodTemplate;
    try {
      updated = GradingPeriodTemplate.reconstruct({
        id: entity.id,
        name: newName,
        level: entity.level,
        modality: entity.modality,
        active: input.active ?? entity.active,
        deletedAt: entity.deletedAt,
        items: resolvedItems,
      });
    } catch (e) {
      return err(e as PeriodSortOrderDuplicateError);
    }

    await this.repo.saveTemplate(updated);
    return ok(updated);
  }
}

// ─────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────

@Injectable()
export class DeleteGradingPeriodTemplateUseCase {
  constructor(private readonly repo: GradingPeriodRepository) {}

  async execute(
    id: string,
  ): Promise<Result<void, PeriodTemplateNotFoundError | PeriodTemplateHasDatesError>> {
    const entity = await this.repo.findTemplateById(id);
    if (!entity) {
      return err(new PeriodTemplateNotFoundError(id));
    }

    const dateCount = await this.repo.countDatesForTemplate(id);
    if (dateCount > 0) {
      return err(new PeriodTemplateHasDatesError(id));
    }

    await this.repo.softDeleteTemplate(id);
    return ok(undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────

@Injectable()
export class ListGradingPeriodTemplatesUseCase {
  constructor(private readonly repo: GradingPeriodRepository) {}

  async execute(filters?: GradingPeriodTemplateFilters): Promise<GradingPeriodTemplate[]> {
    return this.repo.listTemplates(filters);
  }
}

// ─────────────────────────────────────────────────────────────
// Get
// ─────────────────────────────────────────────────────────────

@Injectable()
export class GetGradingPeriodTemplateUseCase {
  constructor(private readonly repo: GradingPeriodRepository) {}

  async execute(
    id: string,
  ): Promise<Result<GradingPeriodTemplate, PeriodTemplateNotFoundError>> {
    const entity = await this.repo.findTemplateById(id);
    if (!entity) {
      return err(new PeriodTemplateNotFoundError(id));
    }
    return ok(entity);
  }
}
