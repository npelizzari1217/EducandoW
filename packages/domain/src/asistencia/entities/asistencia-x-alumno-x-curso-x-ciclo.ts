/**
 * AsistenciaXAlumnoXCursoXCiclo — domain entity.
 *
 * One row per (CourseCycle, Student, Year, Month).
 * Days attendance stored as a DayMap VO (ADR-1 — JSON day-map).
 * Spec: R-1, R-3, R-36.
 */
import { Id } from '../../shared/value-objects/id';
import { DayMap } from '../value-objects/day-map';

export interface AsistenciaXAlumnoXCursoXCicloProps {
  id: Id;
  courseCycleId: string;
  studentId: string;
  year: number;
  month: number;
  days: DayMap;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAsistenciaXAlumnoXCursoXCicloInput = Omit<
  AsistenciaXAlumnoXCursoXCicloProps,
  'id' | 'days' | 'createdAt' | 'updatedAt'
>;

export class AsistenciaXAlumnoXCursoXCiclo {
  private constructor(private readonly props: AsistenciaXAlumnoXCursoXCicloProps) {}

  static create(input: CreateAsistenciaXAlumnoXCursoXCicloInput): AsistenciaXAlumnoXCursoXCiclo {
    return new AsistenciaXAlumnoXCursoXCiclo({
      ...input,
      id: Id.create(),
      days: DayMap.empty(),
    });
  }

  static reconstruct(props: AsistenciaXAlumnoXCursoXCicloProps): AsistenciaXAlumnoXCursoXCiclo {
    return new AsistenciaXAlumnoXCursoXCiclo(props);
  }

  get id(): Id { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get studentId(): string { return this.props.studentId; }
  get year(): number { return this.props.year; }
  get month(): number { return this.props.month; }
  get days(): DayMap { return this.props.days; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }
}
