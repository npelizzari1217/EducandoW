import { Id } from '../../shared/value-objects/id';
import { SlotCursadaTerciario } from '../value-objects/slot-cursada-terciario';
import { CondicionCursada } from '../value-objects/condicion-cursada';

export interface NotaCursadaTerciarioProps {
  id: Id;
  inscripcionMateriaId: string;
  slot: SlotCursadaTerciario;
  nota?: number;
  condicion: CondicionCursada;
  fecha?: string;
  creadoAt: Date;
  actualizadoAt: Date;
}

export class NotaCursadaTerciario {
  private constructor(private props: NotaCursadaTerciarioProps) {}

  static create(
    props: Omit<NotaCursadaTerciarioProps, 'id' | 'creadoAt' | 'actualizadoAt'>,
  ): NotaCursadaTerciario {
    const now = new Date();
    return new NotaCursadaTerciario({
      ...props,
      id: Id.create(),
      creadoAt: now,
      actualizadoAt: now,
    });
  }

  static reconstruct(props: NotaCursadaTerciarioProps): NotaCursadaTerciario {
    return new NotaCursadaTerciario(props);
  }

  get id(): Id { return this.props.id; }
  get inscripcionMateriaId(): string { return this.props.inscripcionMateriaId; }
  get slot(): SlotCursadaTerciario { return this.props.slot; }
  get nota(): number | undefined { return this.props.nota; }
  get condicion(): CondicionCursada { return this.props.condicion; }
  get fecha(): string | undefined { return this.props.fecha; }
  get creadoAt(): Date { return this.props.creadoAt; }
  get actualizadoAt(): Date { return this.props.actualizadoAt; }

  updateNota(nota?: number): void {
    this.props.nota = nota;
    this.props.actualizadoAt = new Date();
  }

  updateCondicion(condicion: CondicionCursada): void {
    this.props.condicion = condicion;
    this.props.actualizadoAt = new Date();
  }

  updateFecha(fecha?: string): void {
    this.props.fecha = fecha;
    this.props.actualizadoAt = new Date();
  }
}
