import { Id } from '../../shared/value-objects/id';

/**
 * MateriasXAlumnoXCursoXCiclo — authoritative universe of students for a subject
 * within a CursoXCiclo (Fase 3, MGC-R2).
 *
 * Students must be added one by one from the enrolled registry (not from ingresantes).
 * The @@unique([materiaXCursoXCicloId, studentId]) at the DB level prevents duplicates.
 *
 * This record is the FK target for AlumnosXGrupoXCursoXMateriaXCiclo, which enforces
 * grupo ⊆ materia at the database level (MGC-R4).
 */

export interface MateriasXAlumnoXCursoXCicloProps {
  id: string;
  materiaXCursoXCicloId: string;
  /** Reference to Student.id in the tenant DB. */
  studentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMateriasXAlumnoXCursoXCicloInput {
  materiaXCursoXCicloId: string;
  studentId: string;
}

export class MateriasXAlumnoXCursoXCiclo {
  private constructor(private readonly props: MateriasXAlumnoXCursoXCicloProps) {}

  static create(input: CreateMateriasXAlumnoXCursoXCicloInput): MateriasXAlumnoXCursoXCiclo {
    if (!input.materiaXCursoXCicloId) {
      throw new Error('MateriasXAlumnoXCursoXCiclo: materiaXCursoXCicloId is required');
    }
    if (!input.studentId) {
      throw new Error('MateriasXAlumnoXCursoXCiclo: studentId is required');
    }
    const now = new Date();
    return new MateriasXAlumnoXCursoXCiclo({
      id: Id.create().get(),
      materiaXCursoXCicloId: input.materiaXCursoXCicloId,
      studentId: input.studentId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: MateriasXAlumnoXCursoXCicloProps): MateriasXAlumnoXCursoXCiclo {
    return new MateriasXAlumnoXCursoXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get materiaXCursoXCicloId(): string { return this.props.materiaXCursoXCicloId; }
  get studentId(): string { return this.props.studentId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
