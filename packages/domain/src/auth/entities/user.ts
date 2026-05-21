import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';
import { Password } from '../value-objects/password';

export type UserRole = 'ADMIN' | 'MANAGER' | 'TEACHER';

export interface UserProps {
  id: Id;
  email: Email;
  name: string;
  hashedPassword: string;
  role: UserRole;
  institutionId?: string;
  level?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  static create(props: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt'>): User {
    return new User({
      ...props,
      id: Id.create(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstruct(props: UserProps): User {
    return new User(props);
  }

  get id(): Id { return this.props.id; }
  get email(): Email { return this.props.email; }
  get name(): string { return this.props.name; }
  get hashedPassword(): string { return this.props.hashedPassword; }
  get role(): UserRole { return this.props.role; }
  get institutionId(): string | undefined { return this.props.institutionId; }
  get level(): string | undefined { return this.props.level; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  setHashedPassword(hash: string): void {
    this.props.hashedPassword = hash;
    this.props.updatedAt = new Date();
  }

  assignToInstitution(institutionId: string): void {
    this.props.institutionId = institutionId;
    this.props.updatedAt = new Date();
  }

  assignLevel(level: string): void {
    this.props.level = level;
    this.props.updatedAt = new Date();
  }
}
