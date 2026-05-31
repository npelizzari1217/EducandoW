import { Id } from '../../shared/value-objects/id';

export interface CarreraProps {
  id: Id;
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string;
  active: boolean;
  deletedAt?: Date;
}

export class Carrera {
  private constructor(private props: CarreraProps) {}

  static create(props: Omit<CarreraProps, 'id' | 'active' | 'deletedAt'>): Carrera {
    return new Carrera({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: CarreraProps): Carrera {
    return new Carrera(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get titulo(): string { return this.props.titulo; }
  get duracion(): number { return this.props.duracion; }
  get resolucion(): string | undefined { return this.props.resolucion; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  update(props: Partial<Omit<CarreraProps, 'id' | 'active' | 'deletedAt'>>): void {
    if (props.name !== undefined) this.props.name = props.name;
    if (props.titulo !== undefined) this.props.titulo = props.titulo;
    if (props.duracion !== undefined) this.props.duracion = props.duracion;
    if (props.resolucion !== undefined) this.props.resolucion = props.resolucion;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
