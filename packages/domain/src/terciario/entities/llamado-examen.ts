import { ok, err, Result } from '../../shared/result';
import { Id } from '../../shared/value-objects/id';
import { RangoFechas } from '../value-objects/rango-fechas';
import { InvalidLlamadoRangeError } from '../errors/invalid-llamado-range.error';

export interface LlamadoExamenProps {
  id: Id;
  nombre: string;
  anioAcademico: string;
  rango: RangoFechas;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLlamadoExamenInput {
  nombre: string;
  anioAcademico: string;
  fechaInicio: Date;
  fechaFin: Date;
}

export class LlamadoExamen {
  private constructor(private props: LlamadoExamenProps) {}

  static create(input: CreateLlamadoExamenInput): Result<LlamadoExamen, InvalidLlamadoRangeError> {
    const rangoResult = RangoFechas.create(input.fechaInicio, input.fechaFin);
    if (rangoResult.isErr()) return err(rangoResult.unwrapErr());
    const now = new Date();
    return ok(
      new LlamadoExamen({
        id: Id.create(),
        nombre: input.nombre,
        anioAcademico: input.anioAcademico,
        rango: rangoResult.unwrap(),
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static reconstruct(props: LlamadoExamenProps): LlamadoExamen {
    return new LlamadoExamen(props);
  }

  update(input: {
    nombre?: string;
    fechaInicio?: Date;
    fechaFin?: Date;
  }): Result<void, InvalidLlamadoRangeError> {
    if (input.fechaInicio !== undefined || input.fechaFin !== undefined) {
      const rangoResult = RangoFechas.create(
        input.fechaInicio ?? this.props.rango.inicio,
        input.fechaFin ?? this.props.rango.fin,
      );
      if (rangoResult.isErr()) return err(rangoResult.unwrapErr());
      this.props.rango = rangoResult.unwrap();
    }
    if (input.nombre !== undefined) this.props.nombre = input.nombre;
    this.props.updatedAt = new Date();
    return ok(undefined);
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }

  get id(): Id { return this.props.id; }
  get nombre(): string { return this.props.nombre; }
  get anioAcademico(): string { return this.props.anioAcademico; }
  get fechaInicio(): Date { return this.props.rango.inicio; }
  get fechaFin(): Date { return this.props.rango.fin; }
  get rango(): RangoFechas { return this.props.rango; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
