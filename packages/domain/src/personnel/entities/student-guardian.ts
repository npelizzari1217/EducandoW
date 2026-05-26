import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';

export type GuardianRelationship = 'mother' | 'father' | 'legal_guardian' | 'other';

const VALID_RELATIONSHIPS: GuardianRelationship[] = ['mother', 'father', 'legal_guardian', 'other'];

export interface StudentGuardianProps {
  id: Id;
  studentId: string;
  userId: string;
  relationship: GuardianRelationship;
  createdAt: Date;
}

export class StudentGuardian {
  private constructor(private props: StudentGuardianProps) {}

  static create(props: Omit<StudentGuardianProps, 'id' | 'createdAt'>): StudentGuardian {
    if (!VALID_RELATIONSHIPS.includes(props.relationship)) {
      throw new ValidationError(
        `Invalid relationship: "${props.relationship}". Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`,
      );
    }

    return new StudentGuardian({
      ...props,
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

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
