import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';

export type EnrollmentStatus = 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED';

export interface EnrollmentProps {
  id: Id;
  studentId: Id;
  institutionId: Id;
  level: Level;
  academicYear: string;
  grade?: string;
  division?: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
}

export class Enrollment {
  private constructor(private props: EnrollmentProps) {}

  static create(props: Omit<EnrollmentProps, 'id' | 'status' | 'enrolledAt'>): Enrollment {
    return new Enrollment({
      ...props,
      id: Id.create(),
      status: 'ACTIVE',
      enrolledAt: new Date(),
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

  changeStatus(status: EnrollmentStatus): void {
    this.props.status = status;
  }
}
