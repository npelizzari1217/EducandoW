import { Id } from '../../shared/value-objects/id';
import { ok, err, Result } from '../../shared/result';
import { EstadoInscripcion } from '../value-objects/estado-inscripcion';
import { ValidationError } from '../../shared/errors/validation-error';

export interface CorrelativaRequerida {
  id: string;
  materiaId: string;
  correlativaId: string;
  tipo: string; // 'CURSADA' | 'FINAL'
}

export interface InscripcionMateriaProps {
  id: Id;
  studentId: string;
  materiaCarreraId: string;
  cuatrimestre: string;
  anioAcademico: string;
  estado: EstadoInscripcion;
  notaCursada?: number;
  notaFinal?: number;
}

export class InscripcionMateria {
  private constructor(private props: InscripcionMateriaProps) {}

  static create(props: Omit<InscripcionMateriaProps, 'id'>): InscripcionMateria {
    return new InscripcionMateria({ ...props, id: Id.create() });
  }

  static reconstruct(props: InscripcionMateriaProps): InscripcionMateria {
    return new InscripcionMateria(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get materiaCarreraId(): string { return this.props.materiaCarreraId; }
  get cuatrimestre(): string { return this.props.cuatrimestre; }
  get anioAcademico(): string { return this.props.anioAcademico; }
  get estado(): EstadoInscripcion { return this.props.estado; }
  get notaCursada(): number | undefined { return this.props.notaCursada; }
  get notaFinal(): number | undefined { return this.props.notaFinal; }

  updateEstado(estado: EstadoInscripcion): void {
    this.props.estado = estado;
  }

  updateNotas(notaCursada?: number, notaFinal?: number): void {
    if (notaCursada !== undefined) this.props.notaCursada = notaCursada;
    if (notaFinal !== undefined) this.props.notaFinal = notaFinal;
  }

  /**
   * Validates that correlative requirements are satisfied before enrolling.
   * @param correlativas - list of required correlatives for this materia
   * @param materiasAprobadas - set of materiaCarreraIds that the student already passed (APROBADO)
   * @param materiasRegulares - set of materiaCarreraIds the student regularized (REGULAR or APROBADO)
   */
  validarCorrelativas(
    correlativas: CorrelativaRequerida[],
    materiasAprobadas: Set<string>,
    materiasRegulares: Set<string>,
  ): Result<boolean, ValidationError> {
    for (const corr of correlativas) {
      if (corr.tipo === 'FINAL') {
        if (!materiasAprobadas.has(corr.correlativaId)) {
          return err(new ValidationError(
            `Correlativa FINAL no cumplida: se requiere tener aprobada la materia ${corr.correlativaId}`,
          ));
        }
      } else if (corr.tipo === 'CURSADA') {
        if (!materiasRegulares.has(corr.correlativaId)) {
          return err(new ValidationError(
            `Correlativa CURSADA no cumplida: se requiere tener regularizada la materia ${corr.correlativaId}`,
          ));
        }
      }
    }
    return ok(true);
  }
}
