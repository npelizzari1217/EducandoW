import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';

export interface SecuenciaDidacticaProps {
  id: string;
  planificacionId: string;
  nombre: string;
  area: string;
  actividades: string[];
  recursos: string[];
}

export interface PlanificacionProps {
  id: Id;
  salaId: string;
  semana: number;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
  secuencias: SecuenciaDidacticaProps[];
}

export interface CreatePlanificacionProps {
  salaId: string;
  semana: number;
  academicYear: string;
  secuencias?: SecuenciaDidacticaProps[];
}

export class Planificacion {
  private constructor(private readonly props: PlanificacionProps) {}

  static create(input: CreatePlanificacionProps): Result<Planificacion, ValidationError> {
    if (!input.salaId) {
      return err(new ValidationError('Sala ID is required'));
    }
    if (input.semana < 1 || input.semana > 40) {
      return err(new ValidationError('Semana must be between 1 and 40'));
    }
    if (!/^\d{4}$/.test(input.academicYear)) {
      return err(new ValidationError('Academic year must be in YYYY format'));
    }

    return ok(
      new Planificacion({
        id: Id.create(),
        salaId: input.salaId,
        semana: input.semana,
        academicYear: input.academicYear,
        active: true,
        secuencias: input.secuencias ?? [],
      }),
    );
  }

  static reconstruct(props: PlanificacionProps): Planificacion {
    return new Planificacion(props);
  }

  get id(): Id { return this.props.id; }
  get salaId(): string { return this.props.salaId; }
  get semana(): number { return this.props.semana; }
  get academicYear(): string { return this.props.academicYear; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get secuencias(): SecuenciaDidacticaProps[] { return [...this.props.secuencias]; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
