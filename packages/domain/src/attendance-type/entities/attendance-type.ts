import { Id } from '../../shared/value-objects/id';
import { ValidationError } from '../../shared/errors/validation-error';
import { AttendanceTypeCode } from '../value-objects/attendance-type-code';
import { SystemAttendanceTypeError } from '../errors/system-attendance-type-error';

/** Valid pedagogical levels for AttendanceType (excludes ADMINISTRACION=9). */
const VALID_LEVELS = new Set([1, 2, 3, 4]);

export interface CreateAttendanceTypeInput {
  code: string;
  description: string;
  absenceValue: number;
  level: number;
  assignable: boolean;
  isSystem?: boolean;
  active?: boolean;
}

export interface ReconstructAttendanceTypeProps {
  id: string;
  code: AttendanceTypeCode;
  description: string;
  absenceValue: number;
  level: number;
  assignable: boolean;
  isSystem: boolean;
  active: boolean;
  deletedAt?: Date | null;
}

interface AttendanceTypeProps {
  id: string;
  code: AttendanceTypeCode;
  description: string;
  absenceValue: number;
  level: number;
  assignable: boolean;
  isSystem: boolean;
  active: boolean;
  deletedAt: Date | null;
}

export class AttendanceType {
  private constructor(private readonly props: AttendanceTypeProps) {}

  static create(input: CreateAttendanceTypeInput): AttendanceType {
    const codeResult = AttendanceTypeCode.create(input.code);
    if (codeResult.isErr()) {
      throw codeResult.unwrapErr();
    }

    if (input.absenceValue < 0) {
      throw new ValidationError('absenceValue must be >= 0');
    }

    if (!VALID_LEVELS.has(input.level)) {
      throw new ValidationError(
        `level must be one of {1, 2, 3, 4}; got ${input.level}. ADMINISTRACION (9) is not valid for AttendanceType`,
      );
    }

    return new AttendanceType({
      id: Id.create().get(),
      code: codeResult.unwrap(),
      description: input.description,
      absenceValue: input.absenceValue,
      level: input.level,
      assignable: input.assignable,
      isSystem: input.isSystem ?? false,
      active: input.active ?? true,
      deletedAt: null,
    });
  }

  static reconstruct(props: ReconstructAttendanceTypeProps): AttendanceType {
    return new AttendanceType({
      id: props.id,
      code: props.code,
      description: props.description,
      absenceValue: props.absenceValue,
      level: props.level,
      assignable: props.assignable,
      isSystem: props.isSystem,
      active: props.active,
      deletedAt: props.deletedAt ?? null,
    });
  }

  /** Throws SystemAttendanceTypeError if this type is a system-protected type. */
  assertMutable(): void {
    if (this.props.isSystem) {
      throw new SystemAttendanceTypeError();
    }
  }

  get id(): string {
    return this.props.id;
  }

  get code(): AttendanceTypeCode {
    return this.props.code;
  }

  get description(): string {
    return this.props.description;
  }

  get absenceValue(): number {
    return this.props.absenceValue;
  }

  get level(): number {
    return this.props.level;
  }

  get assignable(): boolean {
    return this.props.assignable;
  }

  get isSystem(): boolean {
    return this.props.isSystem;
  }

  get active(): boolean {
    return this.props.active;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
}
