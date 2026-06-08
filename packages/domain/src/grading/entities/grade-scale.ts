import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';
import { GradeInternalStatus, GradeInternalStatusValue } from '../value-objects/grade-internal-status';
import { GradeValueCode } from '../value-objects/grade-value-code';

const VALID_LEVELS = new Set([1, 2, 3, 4]);

// ─── GradeScaleValue ─────────────────────────────────────────────────────────

export interface CreateGradeScaleValueInput {
  scaleId: string;
  code: string;
  label: string;
  internalStatus: GradeInternalStatusValue | string;
  sortOrder: number;
}

export interface ReconstructGradeScaleValueProps {
  id: string;
  scaleId: string;
  code: string;
  label: string;
  internalStatus: GradeInternalStatusValue;
  sortOrder: number;
  active: boolean;
  deletedAt: Date | null;
}

interface GradeScaleValueProps {
  id: string;
  scaleId: string;
  code: GradeValueCode;
  label: string;
  internalStatus: GradeInternalStatus;
  sortOrder: number;
  active: boolean;
  deletedAt: Date | null;
}

export class GradeScaleValue {
  private constructor(private readonly props: GradeScaleValueProps) {}

  static create(input: CreateGradeScaleValueInput): GradeScaleValue {
    const codeResult = GradeValueCode.create(input.code);
    if (codeResult.isErr()) {
      throw codeResult.unwrapErr();
    }

    const statusResult = GradeInternalStatus.create(input.internalStatus as string);
    if (statusResult.isErr()) {
      throw statusResult.unwrapErr();
    }

    if (input.sortOrder < 0) {
      throw new ValidationError('sortOrder must be >= 0');
    }

    return new GradeScaleValue({
      id: Id.create().get(),
      scaleId: input.scaleId,
      code: codeResult.unwrap(),
      label: input.label,
      internalStatus: statusResult.unwrap(),
      sortOrder: input.sortOrder,
      active: true,
      deletedAt: null,
    });
  }

  static reconstruct(props: ReconstructGradeScaleValueProps): GradeScaleValue {
    return new GradeScaleValue({
      id: props.id,
      scaleId: props.scaleId,
      code: GradeValueCode.reconstruct(props.code),
      label: props.label,
      internalStatus: GradeInternalStatus.reconstruct(props.internalStatus),
      sortOrder: props.sortOrder,
      active: props.active,
      deletedAt: props.deletedAt,
    });
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }

  get id(): string { return this.props.id; }
  get scaleId(): string { return this.props.scaleId; }
  get code(): string { return this.props.code.get(); }
  get codeVO(): GradeValueCode { return this.props.code; }
  get label(): string { return this.props.label; }
  get internalStatus(): GradeInternalStatusValue { return this.props.internalStatus.get(); }
  get internalStatusVO(): GradeInternalStatus { return this.props.internalStatus; }
  get sortOrder(): number { return this.props.sortOrder; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | null { return this.props.deletedAt; }
}

// ─── GradeScale ──────────────────────────────────────────────────────────────

export interface CreateGradeScaleInput {
  name: string;
  level: number;
  modality: number;
}

export interface ReconstructGradeScaleProps {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  deletedAt: Date | null;
  values?: GradeScaleValue[];
}

interface GradeScaleProps {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  deletedAt: Date | null;
  values: GradeScaleValue[];
}

export class GradeScale {
  private constructor(private readonly props: GradeScaleProps) {}

  static create(input: CreateGradeScaleInput): GradeScale {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('GradeScale name cannot be empty');
    }
    if (!VALID_LEVELS.has(input.level)) {
      throw new ValidationError(
        `level must be one of {1, 2, 3, 4}; got ${input.level}`,
      );
    }
    return new GradeScale({
      id: Id.create().get(),
      name: input.name.trim(),
      level: input.level,
      modality: input.modality,
      active: true,
      deletedAt: null,
      values: [],
    });
  }

  static reconstruct(props: ReconstructGradeScaleProps): GradeScale {
    return new GradeScale({
      id: props.id,
      name: props.name,
      level: props.level,
      modality: props.modality,
      active: props.active,
      deletedAt: props.deletedAt,
      values: props.values ?? [],
    });
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
  get values(): GradeScaleValue[] { return this.props.values; }
}
