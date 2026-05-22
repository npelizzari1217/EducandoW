import { Id } from '../../shared/value-objects/id';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

export interface AttendanceProps {
  id: Id;
  studentId: string;
  courseSectionId: string;
  date: Date;
  status: AttendanceStatus;
  note?: string;
}

export class Attendance {
  private constructor(private props: AttendanceProps) {}

  static create(props: Omit<AttendanceProps, 'id'>): Attendance {
    return new Attendance({ ...props, id: Id.create() });
  }

  static reconstruct(props: AttendanceProps): Attendance {
    return new Attendance(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get courseSectionId(): string { return this.props.courseSectionId; }
  get date(): Date { return this.props.date; }
  get status(): AttendanceStatus { return this.props.status; }
  get note(): string | undefined { return this.props.note; }
}
