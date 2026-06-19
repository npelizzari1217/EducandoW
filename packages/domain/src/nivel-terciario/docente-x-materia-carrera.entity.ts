import { Id } from '../shared/value-objects/id';

export interface DocenteXMateriaCarreraProps {
  id: string;
  userId: string;
  materiaCarreraId: string;
  anioAcademico: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocenteXMateriaCarreraInput {
  userId: string;
  materiaCarreraId: string;
  anioAcademico: string;
}

export class DocenteXMateriaCarrera {
  private constructor(private props: DocenteXMateriaCarreraProps) {}

  static create(input: CreateDocenteXMateriaCarreraInput): DocenteXMateriaCarrera {
    const now = new Date();
    return new DocenteXMateriaCarrera({
      id: Id.create().get(),
      userId: input.userId,
      materiaCarreraId: input.materiaCarreraId,
      anioAcademico: input.anioAcademico,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: DocenteXMateriaCarreraProps): DocenteXMateriaCarrera {
    return new DocenteXMateriaCarrera({ ...props });
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get materiaCarreraId(): string { return this.props.materiaCarreraId; }
  get anioAcademico(): string { return this.props.anioAcademico; }
  get active(): boolean { return this.props.active; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  unassign(): void {
    this.props.active = false;
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    this.props.active = true;
    this.props.updatedAt = new Date();
  }
}
