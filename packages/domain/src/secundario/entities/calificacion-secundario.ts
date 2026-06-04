import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { Trimestre } from '../../primario/value-objects/trimestre';
import { CondicionAlumno } from '../value-objects/condicion-alumno';
import type { TurnoExamenCode } from '../value-objects/turno-examen';

export interface CalificacionSecundarioProps {
  id: Id;
  studentId: string;
  cursoId: string;
  subjectId: string;
  trimestre: Trimestre;
  nota: number;
  condicion: CondicionAlumno;
  notaDiciembre: number | null;
  notaFebrero: number | null;
}

export interface CreateCalificacionSecundarioInput {
  studentId: string;
  cursoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  condicion: string;
}

const NOTA_MIN = 1.0;
const NOTA_MAX = 10.0;

export class CalificacionSecundario {
  private constructor(private props: CalificacionSecundarioProps) {}

  static create(
    input: CreateCalificacionSecundarioInput,
  ): Result<CalificacionSecundario, ValidationError> {
    const trimestreResult = Trimestre.create(input.trimestre);
    if (trimestreResult.isErr()) return err(trimestreResult.unwrapErr());

    const condicion = CondicionAlumno.create(input.condicion);
    if (!condicion) {
      return err(
        new ValidationError(
          `Condición inválida: "${input.condicion}". Valores válidos: APROBADO, PREVIA, LIBRE`,
        ),
      );
    }

    if (input.nota < NOTA_MIN || input.nota > NOTA_MAX) {
      return err(
        new ValidationError(
          `La nota debe estar entre ${NOTA_MIN} y ${NOTA_MAX}. Valor recibido: ${input.nota}`,
        ),
      );
    }

    if (!input.studentId || input.studentId.trim().length === 0) {
      return err(new ValidationError('El estudiante es requerido'));
    }

    if (!input.cursoId || input.cursoId.trim().length === 0) {
      return err(new ValidationError('El curso es requerido'));
    }

    if (!input.subjectId || input.subjectId.trim().length === 0) {
      return err(new ValidationError('La materia es requerida'));
    }

    return ok(
      new CalificacionSecundario({
        id: Id.create(),
        studentId: input.studentId,
        cursoId: input.cursoId,
        subjectId: input.subjectId,
        trimestre: trimestreResult.unwrap(),
        nota: input.nota,
        condicion,
        notaDiciembre: null,
        notaFebrero: null,
      }),
    );
  }

  static reconstruct(props: CalificacionSecundarioProps): CalificacionSecundario {
    return new CalificacionSecundario(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get cursoId(): string {
    return this.props.cursoId;
  }

  get subjectId(): string {
    return this.props.subjectId;
  }

  get trimestre(): Trimestre {
    return this.props.trimestre;
  }

  get nota(): number {
    return this.props.nota;
  }

  get condicion(): CondicionAlumno {
    return this.props.condicion;
  }

  get notaDiciembre(): number | null {
    return this.props.notaDiciembre;
  }

  get notaFebrero(): number | null {
    return this.props.notaFebrero;
  }

  /**
   * Calcula la definitiva como max(nota, notaDiciembre, notaFebrero)
   * ignorando valores null. Si todos son null, retorna null.
   * Si hay empate, se toma la ultima no-nula en el orden: notaFebrero > notaDiciembre > nota.
   */
  calcularDefinitiva(): number | null {
    const values: number[] = [];
    if (this.props.nota != null) values.push(this.props.nota);
    if (this.props.notaDiciembre != null) values.push(this.props.notaDiciembre);
    if (this.props.notaFebrero != null) values.push(this.props.notaFebrero);

    if (values.length === 0) return null;

    const maxVal = Math.max(...values);

    // Last non-null fallback: prioridad notaFebrero > notaDiciembre > nota
    if (this.props.notaFebrero != null && this.props.notaFebrero === maxVal) {
      return this.props.notaFebrero;
    }
    if (this.props.notaDiciembre != null && this.props.notaDiciembre === maxVal) {
      return this.props.notaDiciembre;
    }
    return this.props.nota;
  }

  puedeRendirSuplementario(): boolean {
    const code = this.props.condicion.get();
    return code === 'PREVIA' || code === 'LIBRE';
  }

  registrarNotaSuplementaria(
    turno: TurnoExamenCode,
    nota: number,
  ): Result<void, ValidationError> {
    if (!this.puedeRendirSuplementario()) {
      return err(
        new ValidationError('Condición no habilita examen suplementario'),
      );
    }

    if (nota < NOTA_MIN || nota > NOTA_MAX) {
      return err(
        new ValidationError(
          `La nota debe estar entre ${NOTA_MIN} y ${NOTA_MAX}. Valor recibido: ${nota}`,
        ),
      );
    }

    if (turno === 'DICIEMBRE') {
      this.props.notaDiciembre = nota;
    } else if (turno === 'FEBRERO') {
      if (this.props.notaDiciembre == null) {
        return err(
          new ValidationError(
            'Debe registrarse la nota de Diciembre antes de Febrero',
          ),
        );
      }
      this.props.notaFebrero = nota;
    }

    return ok(undefined);
  }
}
