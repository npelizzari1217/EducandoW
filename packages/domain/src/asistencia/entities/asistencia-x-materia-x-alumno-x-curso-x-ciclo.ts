/**
 * AsistenciaXMateriaXAlumnoXCursoXCiclo — domain entity.
 *
 * One row per (MateriaXCursoXCiclo, Student, Year, Month).
 * Days attendance stored as a DayMap VO (ADR-1 — JSON day-map).
 * Group (GrupoXCursoXMateriaXCiclo) is NOT stored here — it is a filter at the
 * presentation/authorization layer only (ADR-2).
 * Spec: R-3, R-35, R-36.
 */
import { Id } from '../../shared/value-objects/id';
import { DayMap } from '../value-objects/day-map';

export interface AsistenciaXMateriaXAlumnoXCursoXCicloProps {
  id: Id;
  materiaXCursoXCicloId: string;
  studentId: string;
  year: number;
  month: number;
  days: DayMap;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAsistenciaXMateriaXAlumnoXCursoXCicloInput = Omit<
  AsistenciaXMateriaXAlumnoXCursoXCicloProps,
  'id' | 'days' | 'createdAt' | 'updatedAt'
>;

export class AsistenciaXMateriaXAlumnoXCursoXCiclo {
  private constructor(private readonly props: AsistenciaXMateriaXAlumnoXCursoXCicloProps) {}

  static create(input: CreateAsistenciaXMateriaXAlumnoXCursoXCicloInput): AsistenciaXMateriaXAlumnoXCursoXCiclo {
    return new AsistenciaXMateriaXAlumnoXCursoXCiclo({
      ...input,
      id: Id.create(),
      days: DayMap.empty(),
    });
  }

  static reconstruct(props: AsistenciaXMateriaXAlumnoXCursoXCicloProps): AsistenciaXMateriaXAlumnoXCursoXCiclo {
    return new AsistenciaXMateriaXAlumnoXCursoXCiclo(props);
  }

  get id(): Id { return this.props.id; }
  get materiaXCursoXCicloId(): string { return this.props.materiaXCursoXCicloId; }
  get studentId(): string { return this.props.studentId; }
  get year(): number { return this.props.year; }
  get month(): number { return this.props.month; }
  get days(): DayMap { return this.props.days; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }
}
