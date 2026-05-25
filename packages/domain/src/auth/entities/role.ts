import { Id } from '../../shared/value-objects/id';

export interface RoleProps {
  id: Id;
  name: string;
  description: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Role {
  private constructor(private props: RoleProps) {}

  static create(props: { name: string; description: string }): Role {
    return new Role({
      id: Id.create(),
      name: props.name,
      description: props.description,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: RoleProps): Role {
    return new Role(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get description(): string { return this.props.description; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isActive(): boolean {
    return this.props.active && !this.props.deletedAt;
  }
}
