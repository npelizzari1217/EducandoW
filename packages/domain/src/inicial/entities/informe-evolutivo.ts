import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { Periodo } from '../value-objects/periodo';

export interface AreaDesarrolloProps {
  id: string;
  informeId: string;
  area: string;
  observacion: string;
  valoracion: string;
}

export interface InformeEvolutivoProps {
  id: Id;
  studentId: string;
  salaId: string;
  periodo: Periodo;
  fecha: Date;
  observacionesGenerales?: string;
  areas: AreaDesarrolloProps[];
}

export interface CreateInformeEvolutivoProps {
  studentId: string;
  salaId: string;
  periodo: string;
  fecha: Date;
  observacionesGenerales?: string;
  areas?: AreaDesarrolloProps[];
}

export class InformeEvolutivo {
  private constructor(private readonly props: InformeEvolutivoProps) {}

  static create(input: CreateInformeEvolutivoProps): Result<InformeEvolutivo, ValidationError> {
    if (!input.studentId) {
      return err(new ValidationError('Student ID is required'));
    }
    if (!input.salaId) {
      return err(new ValidationError('Sala ID is required'));
    }

    const periodoResult = Periodo.create(input.periodo);
    if (periodoResult.isErr()) return err(periodoResult.unwrapErr());

    return ok(
      new InformeEvolutivo({
        id: Id.create(),
        studentId: input.studentId,
        salaId: input.salaId,
        periodo: periodoResult.unwrap(),
        fecha: input.fecha,
        observacionesGenerales: input.observacionesGenerales,
        areas: input.areas ?? [],
      }),
    );
  }

  static reconstruct(props: InformeEvolutivoProps): InformeEvolutivo {
    return new InformeEvolutivo(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get salaId(): string { return this.props.salaId; }
  get periodo(): Periodo { return this.props.periodo; }
  get fecha(): Date { return this.props.fecha; }
  get observacionesGenerales(): string | undefined { return this.props.observacionesGenerales; }
  get areas(): AreaDesarrolloProps[] { return [...this.props.areas]; }
}
