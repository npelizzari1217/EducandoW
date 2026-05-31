import { Id } from '../../shared/value-objects/id';
import { CondicionExamen } from '../value-objects/condicion-examen';

export interface ActaExamenNota {
  id: string;
  actaId: string;
  studentId: string;
  nota: number;
  condicion: CondicionExamen;
}

export interface ActaExamenProps {
  id: Id;
  materiaCarreraId: string;
  fecha: Date;
  presidenteId: string;
  vocales: string[];
  libro?: string;
  folio?: string;
  active: boolean;
  deletedAt?: Date;
  notas: ActaExamenNota[];
}

export class ActaExamen {
  private constructor(private props: ActaExamenProps) {}

  static create(props: Omit<ActaExamenProps, 'id' | 'active' | 'deletedAt' | 'notas'>): ActaExamen {
    return new ActaExamen({ ...props, id: Id.create(), active: true, notas: [] });
  }

  static reconstruct(props: ActaExamenProps): ActaExamen {
    return new ActaExamen(props);
  }

  get id(): Id { return this.props.id; }
  get materiaCarreraId(): string { return this.props.materiaCarreraId; }
  get fecha(): Date { return this.props.fecha; }
  get presidenteId(): string { return this.props.presidenteId; }
  get vocales(): string[] { return this.props.vocales; }
  get libro(): string | undefined { return this.props.libro; }
  get folio(): string | undefined { return this.props.folio; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get notas(): ActaExamenNota[] { return this.props.notas; }

  registrarNota(studentId: string, nota: number, condicion: CondicionExamen): void {
    const existing = this.props.notas.findIndex((n) => n.studentId === studentId);
    const newNota: ActaExamenNota = {
      id: Id.create().get(),
      actaId: this.props.id.get(),
      studentId,
      nota,
      condicion,
    };

    if (existing >= 0) {
      this.props.notas[existing] = newNota;
    } else {
      this.props.notas.push(newNota);
    }
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
