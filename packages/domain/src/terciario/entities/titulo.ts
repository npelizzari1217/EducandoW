import { Id } from '../../shared/value-objects/id';
import { EstadoTitulo } from '../value-objects/estado-titulo';

export interface TituloProps {
  id: Id;
  studentId: string;
  carreraId: string;
  fechaEgreso?: Date;
  fechaEmision?: Date;
  estado: EstadoTitulo;
  nroRegistro?: string;
}

export class Titulo {
  private constructor(private props: TituloProps) {}

  static create(props: Omit<TituloProps, 'id'>): Titulo {
    return new Titulo({ ...props, id: Id.create() });
  }

  static reconstruct(props: TituloProps): Titulo {
    return new Titulo(props);
  }

  get id(): Id { return this.props.id; }
  get studentId(): string { return this.props.studentId; }
  get carreraId(): string { return this.props.carreraId; }
  get fechaEgreso(): Date | undefined { return this.props.fechaEgreso; }
  get fechaEmision(): Date | undefined { return this.props.fechaEmision; }
  get estado(): EstadoTitulo { return this.props.estado; }
  get nroRegistro(): string | undefined { return this.props.nroRegistro; }

  updateEstado(estado: EstadoTitulo): void {
    this.props.estado = estado;
  }

  emitir(nroRegistro: string): void {
    this.props.estado = EstadoTitulo.create('EMITIDO');
    this.props.nroRegistro = nroRegistro;
    this.props.fechaEmision = new Date();
  }
}
