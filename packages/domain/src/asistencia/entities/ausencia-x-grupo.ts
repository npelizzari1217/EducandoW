/**
 * AusenciaXGrupo — domain entity (Fase 6, F6-D1).
 *
 * Represents a subject-level absence scoped to a GrupoXCursoXMateriaXCiclo.
 * Recorded by the DocenteXCiclo assigned to the group.
 * Independent from AsistenciaDiaria (asistencia delta spec).
 */
import { Id } from '../../shared/value-objects/id';

export interface AusenciaXGrupoProps {
  id: Id;
  grupoId: string;
  studentId: string;
  date: Date;
  observaciones?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAusenciaXGrupoInput = Omit<AusenciaXGrupoProps, 'id' | 'createdAt' | 'updatedAt'>;

export class AusenciaXGrupo {
  private constructor(private readonly props: AusenciaXGrupoProps) {}

  static create(input: CreateAusenciaXGrupoInput): AusenciaXGrupo {
    return new AusenciaXGrupo({ ...input, id: Id.create() });
  }

  static reconstruct(props: AusenciaXGrupoProps): AusenciaXGrupo {
    return new AusenciaXGrupo(props);
  }

  get id(): Id { return this.props.id; }
  get grupoId(): string { return this.props.grupoId; }
  get studentId(): string { return this.props.studentId; }
  get date(): Date { return this.props.date; }
  get observaciones(): string | undefined { return this.props.observaciones; }
  get createdAt(): Date | undefined { return this.props.createdAt; }
  get updatedAt(): Date | undefined { return this.props.updatedAt; }
}
