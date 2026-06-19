import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';

export interface CarreraProps {
  id: Id;
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string;
  active: boolean;
  deletedAt?: Date;
  llamadosVencimiento: number;
}

export class Carrera {
  private constructor(private props: CarreraProps) {}

  static create(props: Omit<CarreraProps, 'id' | 'active' | 'deletedAt' | 'llamadosVencimiento'> & { llamadosVencimiento?: number }): Carrera {
    const llamadosVencimiento = props.llamadosVencimiento ?? 5;
    if (llamadosVencimiento <= 0) {
      throw new ValidationError('llamadosVencimiento debe ser un número positivo (> 0)');
    }
    return new Carrera({ ...props, llamadosVencimiento, id: Id.create(), active: true });
  }

  static reconstruct(props: CarreraProps): Carrera {
    if (props.llamadosVencimiento <= 0) {
      throw new ValidationError('llamadosVencimiento debe ser un número positivo (> 0)');
    }
    return new Carrera(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get titulo(): string { return this.props.titulo; }
  get duracion(): number { return this.props.duracion; }
  get resolucion(): string | undefined { return this.props.resolucion; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get llamadosVencimiento(): number { return this.props.llamadosVencimiento; }

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
