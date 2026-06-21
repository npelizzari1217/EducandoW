import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';

export interface PlanificacionCursoProps {
  id: string;
  asignacionCursoId: string;
  nombre: string;
  periodOrdinal?: number;
  descripcion?: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanificacionCursoInput {
  asignacionCursoId: string;
  nombre: string;
  periodOrdinal?: number;
  descripcion?: string;
}

export class PlanificacionCurso {
  private constructor(private readonly props: PlanificacionCursoProps) {}

  static create(input: CreatePlanificacionCursoInput): PlanificacionCurso {
    if (!input.nombre || input.nombre.trim().length === 0) {
      throw new ValidationError('El nombre de la planificación no puede estar vacío');
    }
    if (input.periodOrdinal !== undefined && input.periodOrdinal < 1) {
      throw new ValidationError('El período debe ser >= 1');
    }
    const now = new Date();
    return new PlanificacionCurso({
      id: Id.create().get(),
      asignacionCursoId: input.asignacionCursoId,
      nombre: input.nombre.trim(),
      periodOrdinal: input.periodOrdinal,
      descripcion: input.descripcion,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: PlanificacionCursoProps): PlanificacionCurso {
    return new PlanificacionCurso(props);
  }

  get id() { return this.props.id; }
  get asignacionCursoId() { return this.props.asignacionCursoId; }
  get nombre() { return this.props.nombre; }
  get periodOrdinal() { return this.props.periodOrdinal; }
  get descripcion() { return this.props.descripcion; }
  get active() { return this.props.active; }
  get deletedAt() { return this.props.deletedAt; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }
}
