import { Id } from '../../shared/value-objects/id';
import {
  PeriodSortOrderDuplicateError,
  PeriodTemplateItemNameDuplicateError,
} from '../errors/grading-period.errors';

// ─── GradingPeriodTemplateItem ────────────────────────────────────────────────

export interface CreateGradingPeriodTemplateItemInput {
  name: string;
  sortOrder: number;
}

export interface ReconstructGradingPeriodTemplateItemProps {
  id: string;
  templateId: string;
  name: string;
  sortOrder: number;
}

interface GradingPeriodTemplateItemProps {
  id: string;
  templateId: string;
  name: string;
  sortOrder: number;
}

export class GradingPeriodTemplateItem {
  private constructor(private readonly props: GradingPeriodTemplateItemProps) {}

  static create(input: CreateGradingPeriodTemplateItemInput, templateId: string): GradingPeriodTemplateItem {
    return new GradingPeriodTemplateItem({
      id: Id.create().get(),
      templateId,
      name: input.name,
      sortOrder: input.sortOrder,
    });
  }

  static reconstruct(props: ReconstructGradingPeriodTemplateItemProps): GradingPeriodTemplateItem {
    return new GradingPeriodTemplateItem(props);
  }

  get id(): string { return this.props.id; }
  get templateId(): string { return this.props.templateId; }
  get name(): string { return this.props.name; }
  get sortOrder(): number { return this.props.sortOrder; }
}

// ─── GradingPeriodTemplate ────────────────────────────────────────────────────

export interface CreateGradingPeriodTemplateInput {
  name: string;
  level: number;
  modality: number;
  items: CreateGradingPeriodTemplateItemInput[];
}

export interface ReconstructGradingPeriodTemplateProps {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  deletedAt: Date | null;
  items: ReconstructGradingPeriodTemplateItemProps[];
}

interface GradingPeriodTemplateProps {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  deletedAt: Date | null;
  items: GradingPeriodTemplateItem[];
}

export class GradingPeriodTemplate {
  private constructor(private readonly props: GradingPeriodTemplateProps) {}

  static create(input: CreateGradingPeriodTemplateInput): GradingPeriodTemplate {
    const id = Id.create().get();
    const items = input.items.map((i) => GradingPeriodTemplateItem.create(i, id));
    GradingPeriodTemplate.assertItemsValid(items);

    return new GradingPeriodTemplate({
      id,
      name: input.name,
      level: input.level,
      modality: input.modality,
      active: true,
      deletedAt: null,
      items,
    });
  }

  static reconstruct(props: ReconstructGradingPeriodTemplateProps): GradingPeriodTemplate {
    return new GradingPeriodTemplate({
      id: props.id,
      name: props.name,
      level: props.level,
      modality: props.modality,
      active: props.active,
      deletedAt: props.deletedAt,
      items: props.items.map(GradingPeriodTemplateItem.reconstruct),
    });
  }

  private static assertItemsValid(items: GradingPeriodTemplateItem[]): void {
    // Check sortOrder uniqueness
    const sortOrders = items.map((i) => i.sortOrder);
    const duplicateSortOrders = sortOrders.filter(
      (order, idx) => sortOrders.indexOf(order) !== idx,
    );
    if (duplicateSortOrders.length > 0) {
      throw new PeriodSortOrderDuplicateError([...new Set(duplicateSortOrders)]);
    }

    // Check name uniqueness
    const names = items.map((i) => i.name);
    const duplicateNames = names.filter((name, idx) => names.indexOf(name) !== idx);
    if (duplicateNames.length > 0) {
      throw new PeriodTemplateItemNameDuplicateError([...new Set(duplicateNames)]);
    }
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get level(): number { return this.props.level; }
  get modality(): number { return this.props.modality; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | null { return this.props.deletedAt; }
  get items(): GradingPeriodTemplateItem[] { return this.props.items; }
}
