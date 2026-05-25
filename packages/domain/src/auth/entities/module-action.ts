import { Id } from '../../shared/value-objects/id';

export interface ModuleActionProps {
  id: Id;
  code: string;
  name: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ModuleAction {
  private constructor(private props: ModuleActionProps) {}

  static create(props: { code: string; name: string }): ModuleAction {
    return new ModuleAction({
      id: Id.create(),
      code: props.code,
      name: props.name,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: ModuleActionProps): ModuleAction {
    return new ModuleAction(props);
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
