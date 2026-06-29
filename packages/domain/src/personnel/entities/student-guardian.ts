import { Id } from '../../shared/value-objects/id';
import { Mobile } from '../../shared/value-objects/mobile';
import { Email } from '../../shared/value-objects/email';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export interface StudentGuardianProps {
  id: Id;
  studentId: string;
  userId?: string;
  relationship: string;
  fullName?: string;
  mobile?: Mobile;
  email?: Email;
  isFinancialResponsible: boolean;
  isAuthorizedToPickUp: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class StudentGuardian {
  private constructor(private props: StudentGuardianProps) {}

  static create(input: {
    studentId: string;
    userId?: string;
    relationship: string;
    fullName?: string;
    mobile?: Mobile;
    email?: Email;
    isFinancialResponsible?: boolean;
    isAuthorizedToPickUp?: boolean;
    active?: boolean;
  }): Result<StudentGuardian, ValidationError> {
    const trimmed = input.relationship?.trim() ?? '';
    if (trimmed.length === 0) {
      return err(new ValidationError('Relationship cannot be empty'));
    }
    if (trimmed.length > 15) {
      return err(new ValidationError('Relationship must be 15 characters or fewer'));
    }

    const now = new Date();
    return ok(
      new StudentGuardian({
        id: Id.create(),
        studentId: input.studentId,
        userId: input.userId,
        relationship: trimmed,
        fullName: input.fullName,
        mobile: input.mobile,
        email: input.email,
        isFinancialResponsible: input.isFinancialResponsible ?? false,
        isAuthorizedToPickUp: input.isAuthorizedToPickUp ?? false,
        active: input.active ?? true,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static reconstruct(props: StudentGuardianProps): StudentGuardian {
    return new StudentGuardian(props);
  }

  // ── Mutation ─────────────────────────────────────────────

  update(patch: {
    fullName?: string;
    mobile?: Mobile;
    email?: Email | null;
    relationship?: string;
    active?: boolean;
    isFinancialResponsible?: boolean;
    isAuthorizedToPickUp?: boolean;
  }): void {
    if (patch.fullName !== undefined) this.props.fullName = patch.fullName;
    if (patch.mobile !== undefined) this.props.mobile = patch.mobile;
    if ('email' in patch) {
      this.props.email = patch.email ?? undefined;
    }
    if (patch.relationship !== undefined) this.props.relationship = patch.relationship;
    if (patch.active !== undefined) this.props.active = patch.active;
    if (patch.isFinancialResponsible !== undefined) this.props.isFinancialResponsible = patch.isFinancialResponsible;
    if (patch.isAuthorizedToPickUp !== undefined) this.props.isAuthorizedToPickUp = patch.isAuthorizedToPickUp;
    this.props.updatedAt = new Date();
  }

  // ── Getters ──────────────────────────────────────────────

  get id(): Id {
    return this.props.id;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get userId(): string | undefined {
    return this.props.userId;
  }

  get relationship(): string {
    return this.props.relationship;
  }

  get fullName(): string | undefined {
    return this.props.fullName;
  }

  get mobile(): Mobile | undefined {
    return this.props.mobile;
  }

  get email(): Email | undefined {
    return this.props.email;
  }

  get isFinancialResponsible(): boolean {
    return this.props.isFinancialResponsible;
  }

  get isAuthorizedToPickUp(): boolean {
    return this.props.isAuthorizedToPickUp;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
