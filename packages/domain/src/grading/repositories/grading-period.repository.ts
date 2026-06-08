import { GradingPeriodDate } from '../entities/grading-period-date';
import { GradingPeriodTemplate } from '../entities/grading-period-template';

export interface GradingPeriodTemplateFilters {
  level?: number;
  modality?: number;
  active?: boolean;
}

export interface GradingPeriodRepository {
  /** Returns a template with its items; null if not found */
  findTemplateById(id: string): Promise<GradingPeriodTemplate | null>;

  /** Returns all templates matching the optional filters (includes items) */
  listTemplates(filters?: GradingPeriodTemplateFilters): Promise<GradingPeriodTemplate[]>;

  /** Returns true if a template with the given name exists for the level/modality combination */
  existsTemplateName(level: number, modality: number, name: string, excludeId?: string): Promise<boolean>;

  /** Upserts template + all its items in a transaction */
  saveTemplate(template: GradingPeriodTemplate): Promise<void>;

  /** Counts how many GradingPeriodDate rows are associated with this template */
  countDatesForTemplate(templateId: string): Promise<number>;

  /** Soft-deletes a template (sets active=false, deletedAt=now) */
  softDeleteTemplate(id: string): Promise<void>;

  /** Lists all GradingPeriodDate entries for a specific template/cycle combination */
  listDates(templateId: string, cycleId: string): Promise<GradingPeriodDate[]>;

  /** Upserts a single GradingPeriodDate (identified by [itemId, cycleId]) */
  saveDates(itemId: string, cycleId: string, range: { startDate: Date; endDate: Date }): Promise<void>;

  /**
   * Returns existing dates for all items of a template in a given cycle.
   * Used by UpsertPeriodDatesUseCase for overlap validation before saving.
   */
  findDatesByCycle(templateId: string, cycleId: string): Promise<GradingPeriodDate[]>;
}
