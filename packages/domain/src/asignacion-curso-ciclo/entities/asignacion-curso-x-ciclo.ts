import { Id } from '../../shared/value-objects/id';

/**
 * RolCurso — functional role of a DocenteXCiclo within a CursoXCiclo.
 * PRECEPTOR: daily attendance (presente diario).
 * TITULAR: homeroom teacher — replaces the dropped CourseCycle FK column (S3b-0).
 */
export enum RolCurso {
  PRECEPTOR = 'PRECEPTOR',
  TITULAR = 'TITULAR',
}

/**
 * TurnoCurso — shift for a course-cycle assignment.
 * Optional and informational — no uniqueness constraint per D2.
 * Multiple preceptors can share the same turno.
 */
export enum TurnoCurso {
  MANANA = 'MANANA',
  TARDE = 'TARDE',
  VESPERTINO = 'VESPERTINO',
  NOCHE = 'NOCHE',
}

export interface AsignacionCursoXCicloProps {
  id: string;
  courseCycleId: string;
  docenteXCicloId: string;
  rol: RolCurso;
  turno?: TurnoCurso;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAsignacionCursoXCicloInput {
  courseCycleId: string;
  docenteXCicloId: string;
  rol: RolCurso;
  turno?: TurnoCurso;
}

/**
 * AsignacionCursoXCiclo — assignment of a DocenteXCiclo to a CursoXCiclo
 * at the course level (Fase 4, ACC-R1/R2).
 *
 * This is INDEPENDENT from the group-level assignment in GrupoXCursoXMateriaXCiclo
 * (ACC-R4). It is the basis for daily attendance (presente diario) by the preceptor.
 *
 * D2: multiple DocenteXCiclo records may be assigned to the same CursoXCiclo.
 * turno is optional and informational — no uniqueness constraint on it.
 */
export class AsignacionCursoXCiclo {
  private constructor(private readonly props: AsignacionCursoXCicloProps) {}

  static create(input: CreateAsignacionCursoXCicloInput): AsignacionCursoXCiclo {
    const now = new Date();
    return new AsignacionCursoXCiclo({
      id: Id.create().get(),
      courseCycleId: input.courseCycleId,
      docenteXCicloId: input.docenteXCicloId,
      rol: input.rol,
      turno: input.turno,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: AsignacionCursoXCicloProps): AsignacionCursoXCiclo {
    return new AsignacionCursoXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get docenteXCicloId(): string { return this.props.docenteXCicloId; }
  get rol(): RolCurso { return this.props.rol; }
  get turno(): TurnoCurso | undefined { return this.props.turno; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
