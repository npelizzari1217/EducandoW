import { Id } from '../../shared/value-objects/id';

/** Códigos de 3 caracteres para estados de asistencia */
export type AttendanceStatusCode = 'PRE' | 'AUS' | 'TAR' | 'JUS' | 'RET';

/** Full lookup entity as a domain type (populated from DB relation) */
export interface AttendanceStatusEntity {
  id: string;
  code: AttendanceStatusCode;
  description: string;
  /** 0 = no suma inasistencia, 0.5 = media falta, 1 = ausencia completa */
  absenceValue: number;
  /** ¿Cuenta como presente? */
  isPresent: boolean;
  active: boolean;
}

export interface AttendanceProps {
  id: Id;
  studentId: string;
  courseSectionId: string;
  cycleId?: string;
  date: Date;
  /** FK code for the attendance status */
  statusId: string;
  /** Full status entity when eagerly loaded from DB */
  status?: AttendanceStatusEntity;
  note?: string;
  active?: boolean;
  deletedAt?: Date;

  // SNAPSHOT — immutable historical record
  statusCode?: string;
  statusDescription?: string;
  absenceValue?: number;
  isPresent?: boolean;
}

export class Attendance {
  private constructor(private props: AttendanceProps) {}

  static create(props: Omit<AttendanceProps, 'id' | 'active' | 'deletedAt'>): Attendance {
    return new Attendance({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: AttendanceProps): Attendance {
    return new Attendance(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get courseSectionId(): string { return this.props.courseSectionId; }
  get cycleId(): string | undefined { return this.props.cycleId; }
  get date(): Date { return this.props.date; }
  get statusId(): string { return this.props.statusId; }
  /** Full status entity when eagerly loaded — use for snapshot */
  get statusEntity(): AttendanceStatusEntity | undefined { return this.props.status; }
  /** @deprecated Use statusId for the code or access status entity for full details */
  get status(): AttendanceStatusCode { return this.props.status?.code ?? this.props.statusId as AttendanceStatusCode; }
  get note(): string | undefined { return this.props.note; }
  get active(): boolean { return this.props.active ?? true; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  // SNAPSHOT accessors
  get statusCode(): string | undefined { return this.props.statusCode; }
  get statusDescription(): string | undefined { return this.props.statusDescription; }
  get absenceValue(): number | undefined { return this.props.absenceValue; }
  get isPresent(): boolean | undefined { return this.props.isPresent; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
