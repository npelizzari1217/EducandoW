import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';

export type GuardianRelationship = 'mother' | 'father' | 'legal_guardian' | 'other';

const VALID_RELATIONSHIPS: GuardianRelationship[] = ['mother', 'father', 'legal_guardian', 'other'];

export interface StudentGuardianProps {
  id: Id;
  studentId: string;
  userId: string;
  relationship: GuardianRelationship;
  isFinancialResponsible: boolean;
  isAuthorizedToPickUp: boolean;
  createdAt: Date;
}

export class StudentGuardian {
  private constructor(private props: StudentGuardianProps) {}

  static create(props: {
    studentId: string;
    userId: string;
    relationship: GuardianRelationship;
    isFinancialResponsible?: boolean;
    isAuthorizedToPickUp?: boolean;
  }): StudentGuardian {
    if (!VALID_RELATIONSHIPS.includes(props.relationship)) {
      throw new ValidationError(
        `Invalid relationship: "${props.relationship}". Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`,
      );
    }

    return new StudentGuardian({
      ...props,
      isFinancialResponsible: props.isFinancialResponsible ?? false,
      isAuthorizedToPickUp: props.isAuthorizedToPickUp ?? false,
      id: Id.create(),
      createdAt: new Date(),
    });
  }

  static reconstruct(props: StudentGuardianProps): StudentGuardian {
    return new StudentGuardian(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get relationship(): GuardianRelationship {
    return this.props.relationship;
  }

  get isFinancialResponsible(): boolean {
    return this.props.isFinancialResponsible;
  }

  get isAuthorizedToPickUp(): boolean {
    return this.props.isAuthorizedToPickUp;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
