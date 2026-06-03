import { Id } from '../../shared/value-objects/id';
import { Email } from '../../shared/value-objects/email';
import { Dni } from '../value-objects/dni';

export interface StudentProps {
  id: Id;
  firstName: string;
  lastName: string;
  dni: Dni;
  email?: Email;
  birthDate?: Date;
  guardianName?: string;
  guardianPhone?: string;
  motherName?: string;
  fatherDni?: string;
  motherDni?: string;
  address?: string;
  phone?: string;
  photoUrl?: string;
  userId?: string;
  institutionId?: Id;
  active?: boolean;
  deletedAt?: Date;
}

export class Student {
  private constructor(private props: StudentProps) {}

  static create(props: Omit<StudentProps, 'id' | 'active' | 'deletedAt'>): Student {
    return new Student({ ...props, id: Id.create(), active: true });
  }

  static reconstruct(props: StudentProps): Student {
    return new Student(props);
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

  get email(): Email | undefined {
    return this.props.email;
  }

  get birthDate(): Date | undefined {
    return this.props.birthDate;
  }

  get guardianName(): string | undefined {
    return this.props.guardianName;
  }

  get guardianPhone(): string | undefined {
    return this.props.guardianPhone;
  }

  get motherName(): string | undefined {
    return this.props.motherName;
  }

  get fatherDni(): string | undefined {
    return this.props.fatherDni;
  }

  get motherDni(): string | undefined {
    return this.props.motherDni;
  }

  get address(): string | undefined {
    return this.props.address;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get photoUrl(): string | undefined {
    return this.props.photoUrl;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get institutionId(): Id | undefined {
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
