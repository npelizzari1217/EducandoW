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
}

export class Teacher {
  private constructor(private props: TeacherProps) {}

  static create(props: Omit<TeacherProps, 'id'>): Teacher {
    return new Teacher({ ...props, id: Id.create() });
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

  get fullName(): string {
    return `${this.props.lastName}, ${this.props.firstName}`;
  }
}
