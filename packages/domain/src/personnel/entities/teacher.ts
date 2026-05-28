import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';
import { Dni } from '../value-objects/dni';

export interface TeacherProps {
  id: Id;
  firstName: string;
  lastName: string;
  dni: Dni;
  email: Email;
  phone?: string;
  title?: string;
  institutionId: string;
  active?: boolean;
  deletedAt?: Date;
}

export class Teacher {
  private constructor(private props: TeacherProps) {}

  static create(props: Omit<TeacherProps, 'id' | 'deletedAt'> & { active?: boolean }): Teacher {
    return new Teacher({ ...props, id: Id.create(), active: props.active ?? true });
  }

  static reconstruct(props: TeacherProps): Teacher {
    return new Teacher(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get dni(): Dni {
    return this.props.dni;
  }

  get email(): Email {
    return this.props.email;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get title(): string | undefined {
    return this.props.title;
  }

  get institutionId(): string {
    return this.props.institutionId;
  }

  get active(): boolean {
    return this.props.active ?? true;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get fullName(): string {
    return `${this.props.lastName}, ${this.props.firstName}`;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
