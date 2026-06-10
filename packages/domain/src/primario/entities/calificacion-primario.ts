import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { Trimestre } from '../value-objects/trimestre';

export interface CalificacionPrimarioProps {
  id: Id;
  studentId: string;
  gradoId: string;
  subjectId: string;
  trimestre: Trimestre;
  nota: number;
  concepto: string;
  aprobado: boolean;
}

export interface CreateCalificacionPrimarioInput {
  studentId: string;
  gradoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  concepto: string;
  aprobado: boolean;
}

const NOTA_MIN = 1.0;
const NOTA_MAX = 10.0;

/**
 * @deprecated Use SubjectPeriodGrade (PR7 Primario branch) for new Primario grading.
 * This entity is retained for Secundario/Terciario boletines that still depend on it.
 * Do NOT delete until those paths are migrated.
 */
export class CalificacionPrimario {
  private constructor(private props: CalificacionPrimarioProps) {}

  static create(input: CreateCalificacionPrimarioInput): Result<CalificacionPrimario, ValidationError> {
    const trimestreResult = Trimestre.create(input.trimestre);
    if (trimestreResult.isErr()) return err(trimestreResult.unwrapErr());

    if (input.nota < NOTA_MIN || input.nota > NOTA_MAX) {
      return err(new ValidationError(
        `La nota debe estar entre ${NOTA_MIN} y ${NOTA_MAX}. Valor recibido: ${input.nota}`,
      ));
    }

    if (!input.studentId || input.studentId.trim().length === 0) {
      return err(new ValidationError('El estudiante es requerido'));
    }

    if (!input.gradoId || input.gradoId.trim().length === 0) {
      return err(new ValidationError('El grado es requerido'));
    }

    if (!input.subjectId || input.subjectId.trim().length === 0) {
      return err(new ValidationError('La materia es requerida'));
    }

    return ok(new CalificacionPrimario({
      id: Id.create(),
      studentId: input.studentId,
      gradoId: input.gradoId,
      subjectId: input.subjectId,
      trimestre: trimestreResult.unwrap(),
      nota: input.nota,
      concepto: input.concepto,
      aprobado: input.aprobado,
    }));
  }

  static reconstruct(props: CalificacionPrimarioProps): CalificacionPrimario {
    return new CalificacionPrimario(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get gradoId(): string { return this.props.gradoId; }
  get subjectId(): string { return this.props.subjectId; }
  get trimestre(): Trimestre { return this.props.trimestre; }
  get nota(): number { return this.props.nota; }
  get concepto(): string { return this.props.concepto; }
  get aprobado(): boolean { return this.props.aprobado; }

  update(fields: Partial<Pick<CreateCalificacionPrimarioInput, 'nota' | 'concepto' | 'aprobado'>>): Result<void, ValidationError> {
    if (fields.nota !== undefined) {
      if (fields.nota < NOTA_MIN || fields.nota > NOTA_MAX) {
        return err(new ValidationError(
          `La nota debe estar entre ${NOTA_MIN} y ${NOTA_MAX}. Valor recibido: ${fields.nota}`,
        ));
      }
      this.props.nota = fields.nota;
    }
    if (fields.concepto !== undefined) this.props.concepto = fields.concepto;
    if (fields.aprobado !== undefined) this.props.aprobado = fields.aprobado;
    return ok(undefined);
  }
}
