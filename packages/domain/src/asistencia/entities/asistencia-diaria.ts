/**
 * AsistenciaDiaria — domain entity (Fase 6, F6-D2).
 *
 * Represents daily attendance per CourseCycle + date, recorded by a preceptor.
 * Uses AttendanceType codes (e.g. "P" = present, "A" = absent) for statusCode.
 * Independent from AusenciaXGrupo (asistencia delta spec).
 */
import { Id } from '../../shared/value-objects/id';

export interface AsistenciaDiariaProps {
  id: Id;
  courseCycleId: string;
  studentId: string;
  date: Date;
  statusCode: string;
  observaciones?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAsistenciaDiariaInput = Omit<AsistenciaDiariaProps, 'id' | 'createdAt' | 'updatedAt'>;

export class AsistenciaDiaria {
  private constructor(private readonly props: AsistenciaDiariaProps) {}

  static create(input: CreateAsistenciaDiariaInput): AsistenciaDiaria {
    return new AsistenciaDiaria({ ...input, id: Id.create() });
  }

  static reconstruct(props: AsistenciaDiariaProps): AsistenciaDiaria {
    return new AsistenciaDiaria(props);
  }

  get id(): Id { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get studentId(): string { return this.props.studentId; }
  get date(): Date { return this.props.date; }
  get statusCode(): string { return this.props.statusCode; }
  get observaciones(): string | undefined { return this.props.observaciones; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }
}
