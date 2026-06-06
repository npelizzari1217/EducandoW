import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';
import { EnrollmentStatus } from '../value-objects/enrollment-status';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export interface EnrollmentProps {
  id: Id;
  studentId: Id;
  institutionId: Id;
  cycleId?: Id;
  level: Level;
  academicYear: string;
  grade?: string;
  division?: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  printable?: boolean;
  promoted?: boolean;
  active?: boolean;
  deletedAt?: Date;
  activeGradingPeriod?: number | null;
}

export class Enrollment {
  private constructor(private props: EnrollmentProps) {}

  static create(props: Omit<EnrollmentProps, 'id' | 'status' | 'enrolledAt' | 'active' | 'deletedAt'>): Result<Enrollment, ValidationError> {
    // Runtime validation: printable and promoted must be boolean when provided
    // Note: typeof null === 'object', so null is caught by this check
    if (props.printable !== undefined && typeof props.printable !== 'boolean') {
      return err(new ValidationError(`printable must be a boolean, got ${props.printable === null ? 'null' : typeof props.printable}`));
    }
    if (props.promoted !== undefined && typeof props.promoted !== 'boolean') {
      return err(new ValidationError(`promoted must be a boolean, got ${props.promoted === null ? 'null' : typeof props.promoted}`));
    }

    return ok(new Enrollment({
      ...props,
      id: Id.create(),
      status: EnrollmentStatus.reconstruct('ACTIVE'),
      enrolledAt: new Date(),
      active: true,
      activeGradingPeriod: props.activeGradingPeriod ?? null,
    }));
  }

  static reconstruct(props: EnrollmentProps): Enrollment {
    return new Enrollment(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get studentId(): Id {
    return this.props.studentId;
  }

  get institutionId(): Id {
    return this.props.institutionId;
  }

  get cycleId(): Id | undefined {
    return this.props.cycleId;
  }

  get level(): Level {
    return this.props.level;
  }

  get academicYear(): string {
    return this.props.academicYear;
  }

  get grade(): string | undefined {
    return this.props.grade;
  }

  get division(): string | undefined {
    return this.props.division;
  }

  get status(): EnrollmentStatus {
    return this.props.status;
  }

  get enrolledAt(): Date {
    return this.props.enrolledAt;
  }

  get active(): boolean {
    return this.props.active ?? true;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get printable(): boolean {
    return this.props.printable ?? true;
  }

  get promoted(): boolean {
    return this.props.promoted ?? false;
  }

  get activeGradingPeriod(): number | null {
    return this.props.activeGradingPeriod ?? null;
  }

  changeStatus(status: EnrollmentStatus): void {
    this.props.status = status;
  }

  setPrintable(value: boolean): void {
    this.props.printable = value;
  }

  setPromoted(value: boolean): void {
    this.props.promoted = value;
  }

  togglePrintable(): void {
    this.props.printable = !this.printable;
  }

  togglePromoted(): void {
    this.props.promoted = !this.promoted;
  }

  setActiveGradingPeriod(value: number | null): void {
    this.props.activeGradingPeriod = value;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
