import { Id } from '../../shared/value-objects/id';
import { TurnoExamen } from '../value-objects/turno-examen';

export interface MesaExamenInscripcionProps {
  id: Id;
  mesaId: string;
  studentId: string;
  notaFinal?: number;
  condicionFinal?: string;
}

export interface MesaExamenProps {
  id: Id;
  subjectId: string;
  fecha: Date;
  turno: TurnoExamen;
  presidenteId: string;
  inscripciones: MesaExamenInscripcionProps[];
  active: boolean;
  deletedAt?: Date;
}

export type CreateMesaExamenInput = Omit<MesaExamenProps, 'id' | 'inscripciones' | 'active' | 'deletedAt'>;

export class MesaExamen {
  private constructor(private props: MesaExamenProps) {}

  static create(input: CreateMesaExamenInput): MesaExamen {
    return new MesaExamen({
      ...input,
      id: Id.create(),
      inscripciones: [],
      active: true,
    });
  }

  static reconstruct(props: MesaExamenProps): MesaExamen {
    return new MesaExamen(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get subjectId(): string {
    return this.props.subjectId;
  }

  get fecha(): Date {
    return this.props.fecha;
  }

  get turno(): TurnoExamen {
    return this.props.turno;
  }

  get presidenteId(): string {
    return this.props.presidenteId;
  }

  get inscripciones(): MesaExamenInscripcionProps[] {
    return [...this.props.inscripciones];
  }

  get active(): boolean {
    return this.props.active;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  inscribirAlumno(studentId: string): void {
    const alreadyExists = this.props.inscripciones.some(
      (i) => i.studentId === studentId,
    );
    if (alreadyExists) return;

    const inscripcion: MesaExamenInscripcionProps = {
      id: Id.create(),
      mesaId: this.props.id.get(),
      studentId,
    };
    this.props.inscripciones.push(inscripcion);
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
