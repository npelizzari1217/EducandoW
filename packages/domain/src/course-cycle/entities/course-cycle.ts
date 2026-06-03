import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';
import { CourseName } from '../value-objects/course-name';
import { PassingGrade } from '../value-objects/passing-grade';
import { BimonthPeriod } from '../value-objects/bimonth-period';
import { CourseCycleClosedError } from '../errors';

export interface CourseCycleProps {
  id: Id;
  uuid: string;
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: CourseName;
  level: Level;
  active: boolean;
  passingGrade: PassingGrade;
  promotionText: string | null;
  firstBimonth: BimonthPeriod | null;
  secondBimonth: BimonthPeriod | null;
  thirdBimonth: BimonthPeriod | null;
  fourthBimonth: BimonthPeriod | null;
  createdAt: Date;
  lastModifiedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateCourseCycleInput {
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: CourseName;
  level: Level;
  passingGrade: PassingGrade;
  promotionText?: string | null;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
}

export interface UpdateCourseCycleInput {
  courseName?: CourseName;
  passingGrade?: PassingGrade;
  active?: boolean;
  promotionText?: string | null;
  firstBimonth?: BimonthPeriod | null;
  secondBimonth?: BimonthPeriod | null;
  thirdBimonth?: BimonthPeriod | null;
  fourthBimonth?: BimonthPeriod | null;
}

export class CourseCycle {
  private constructor(private props: CourseCycleProps) {}

  static create(input: CreateCourseCycleInput): CourseCycle {
    const now = new Date();
    return new CourseCycle({
      id: Id.create(),
      uuid: Id.create().get(),
      courseId: input.courseId,
      studyPlanId: input.studyPlanId,
      cycleId: input.cycleId,
      courseName: input.courseName,
      level: input.level,
      active: true,
      passingGrade: input.passingGrade,
      promotionText: input.promotionText ?? null,
      firstBimonth: input.firstBimonth ?? null,
      secondBimonth: input.secondBimonth ?? null,
      thirdBimonth: input.thirdBimonth ?? null,
      fourthBimonth: input.fourthBimonth ?? null,
      createdAt: now,
      lastModifiedAt: now,
    });
  }

  static reconstruct(props: CourseCycleProps): CourseCycle {
    return new CourseCycle(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get uuid(): string {
    return this.props.uuid;
  }

  get courseId(): string {
    return this.props.courseId;
  }

  get studyPlanId(): string {
    return this.props.studyPlanId;
  }

  get cycleId(): string {
    return this.props.cycleId;
  }

  get courseName(): CourseName {
    return this.props.courseName;
  }

  get level(): Level {
    return this.props.level;
  }

  get active(): boolean {
    return this.props.active;
  }

  get passingGrade(): PassingGrade {
    return this.props.passingGrade;
  }

  get promotionText(): string | null {
    return this.props.promotionText;
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

  get lastModifiedAt(): Date {
    return this.props.lastModifiedAt;
  }

  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }

  ensureActive(): void {
    if (!this.props.active) {
      throw new CourseCycleClosedError(this.props.uuid);
    }
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
    this.props.lastModifiedAt = new Date();
  }

  deactivate(): void {
    this.props.active = false;
    this.props.lastModifiedAt = new Date();
  }

  activate(): void {
    this.props.active = true;
    this.props.lastModifiedAt = new Date();
  }

  update(input: UpdateCourseCycleInput): void {
    if (input.courseName !== undefined) {
      this.props.courseName = input.courseName;
    }
    if (input.passingGrade !== undefined) {
      this.props.passingGrade = input.passingGrade;
    }
    if (input.active !== undefined) {
      this.props.active = input.active;
    }
    if (input.promotionText !== undefined) {
      this.props.promotionText = input.promotionText;
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
    this.props.lastModifiedAt = new Date();
  }
}
