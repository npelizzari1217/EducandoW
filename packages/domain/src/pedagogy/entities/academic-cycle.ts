import { CycleCode } from '../value-objects/cycle-code';
import { BimonthPeriod } from '../../course-cycle/value-objects/bimonth-period';

// ── Input types ──────────────────────────────────────────

export interface CreateAcademicCycleInput {
  name: string;
  level: number;
  modality?: number;
  startDate: Date;
  endDate: Date;
  code: CycleCode;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
  active?: boolean;
}

export interface UpdateAcademicCycleInput {
  name?: string;
  code?: CycleCode;
  startDate?: Date;
  endDate?: Date;
  active?: boolean;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
}

export interface AcademicCycleProps {
  numericId: number;
  uuid: string;
  code: CycleCode;
  name: string;
  level: number;
  modality: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  deletedAt: Date | null;
  firstBimonth: BimonthPeriod | null;
  secondBimonth: BimonthPeriod | null;
  thirdBimonth: BimonthPeriod | null;
  fourthBimonth: BimonthPeriod | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Entity ────────────────────────────────────────────────

export class AcademicCycle {
  private constructor(private props: AcademicCycleProps) {}

  static create(input: CreateAcademicCycleInput): AcademicCycle {
    const now = new Date();
    return new AcademicCycle({
      numericId: 0, // assigned by DB on insert
      uuid: crypto.randomUUID(),
      code: input.code,
      name: input.name,
      level: input.level,
      modality: input.modality ?? 0,
      startDate: input.startDate,
      endDate: input.endDate,
      active: input.active ?? true,
      deletedAt: null,
      firstBimonth: input.firstBimonth ?? null,
      secondBimonth: input.secondBimonth ?? null,
      thirdBimonth: input.thirdBimonth ?? null,
      fourthBimonth: input.fourthBimonth ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: AcademicCycleProps): AcademicCycle {
    return new AcademicCycle(props);
  }

  get numericId(): number {
    return this.props.numericId;
  }

  get uuid(): string {
    return this.props.uuid;
  }

  get code(): CycleCode {
    return this.props.code;
  }

  get name(): string {
    return this.props.name;
  }

  get level(): number {
    return this.props.level;
  }

  get modality(): number {
    return this.props.modality;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get active(): boolean {
    return this.props.active;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get firstBimonth(): BimonthPeriod | null {
    return this.props.firstBimonth;
  }

  get secondBimonth(): BimonthPeriod | null {
    return this.props.secondBimonth;
  }

  get thirdBimonth(): BimonthPeriod | null {
    return this.props.thirdBimonth;
  }

  get fourthBimonth(): BimonthPeriod | null {
    return this.props.fourthBimonth;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isCurrent(): boolean {
    const now = new Date();
    return this.props.active && this.props.startDate <= now && this.props.endDate >= now;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  toggleActive(): void {
    this.props.active = !this.props.active;
    this.props.updatedAt = new Date();
  }

  update(input: UpdateAcademicCycleInput): void {
    if (input.name !== undefined) {
      this.props.name = input.name;
    }
    if (input.code !== undefined) {
      this.props.code = input.code;
    }
    if (input.startDate !== undefined) {
      this.props.startDate = input.startDate;
    }
    if (input.endDate !== undefined) {
      this.props.endDate = input.endDate;
    }
    if (input.active !== undefined) {
      this.props.active = input.active;
    }
    if (input.firstBimonth !== undefined) {
      this.props.firstBimonth = input.firstBimonth;
    }
    if (input.secondBimonth !== undefined) {
      this.props.secondBimonth = input.secondBimonth;
    }
    if (input.thirdBimonth !== undefined) {
      this.props.thirdBimonth = input.thirdBimonth;
    }
    if (input.fourthBimonth !== undefined) {
      this.props.fourthBimonth = input.fourthBimonth;
    }
    this.props.updatedAt = new Date();
  }
}
