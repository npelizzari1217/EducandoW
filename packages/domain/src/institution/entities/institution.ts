import { Id } from '../../shared/value-objects/id';
import { Level, LevelType } from '../value-objects/level';

export interface InstitutionProps {
  id: Id;
  name: string;
  levels: Level[];
  address?: string;
  phone?: string;
  email?: string;
}

export class Institution {
  private constructor(private readonly props: InstitutionProps) {}

  static create(props: Omit<InstitutionProps, 'id'>): Institution {
    return new Institution({
      ...props,
      id: Id.create(),
    });
  }

  static reconstruct(props: InstitutionProps): Institution {
    return new Institution(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get levels(): Level[] {
    return [...this.props.levels];
  }

  get address(): string | undefined {
    return this.props.address;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  hasLevel(level: LevelType): boolean {
    return this.props.levels.some((l) => l.get() === level);
  }

  addLevel(level: Level): void {
    if (!this.hasLevel(level.get())) {
      this.props.levels.push(level);
    }
  }
}
