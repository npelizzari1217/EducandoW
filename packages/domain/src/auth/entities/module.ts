import { Id } from '../../shared/value-objects/id';

export interface ModuleProps {
  id: Id;
  code: string;
  name: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Module {
  private constructor(private props: ModuleProps) {}

  static create(props: { code: string; name: string }): Module {
    return new Module({
      id: Id.create(),
      code: props.code,
      name: props.name,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: ModuleProps): Module {
    return new Module(props);
  }

  get id(): Id { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isActive(): boolean {
    return this.props.active && !this.props.deletedAt;
  }
}
