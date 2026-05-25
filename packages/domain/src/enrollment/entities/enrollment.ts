import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';

export type EnrollmentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED';

export interface EnrollmentProps {
  id: Id;
  studentId: Id;
  institutionId: Id;
  cycleId?: string;
  level: Level;
  academicYear: string;
  grade?: string;
  division?: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  active?: boolean;
  deletedAt?: Date;
}

export class Enrollment {
  private constructor(private props: EnrollmentProps) {}

  static create(props: Omit<EnrollmentProps, 'id' | 'status' | 'enrolledAt' | 'active' | 'deletedAt'>): Enrollment {
    return new Enrollment({
      ...props,
      id: Id.create(),
      status: 'ACTIVE',
      enrolledAt: new Date(),
      active: true,
    });
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

  get cycleId(): string | undefined {
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

  changeStatus(status: EnrollmentStatus): void {
    this.props.status = status;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
