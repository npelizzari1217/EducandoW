import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { GradoNumero } from '../value-objects/grado-numero';
import { Division } from '../value-objects/division';

export interface GradoProps {
  id: Id;
  courseSectionId?: string;
  grade: GradoNumero;
  division: Division;
  teacherId?: string;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
}

export interface CreateGradoInput {
  courseSectionId?: string;
  grade: number;
  division: string;
  teacherId?: string;
  academicYear: string;
}

export class Grado {
  private constructor(private props: GradoProps) {}

  static create(input: CreateGradoInput): Result<Grado, ValidationError> {
    const gradeResult = GradoNumero.create(input.grade);
    if (gradeResult.isErr()) return err(gradeResult.unwrapErr());

    const divisionResult = Division.create(input.division);
    if (divisionResult.isErr()) return err(divisionResult.unwrapErr());

    if (!input.academicYear || input.academicYear.trim().length === 0) {
      return err(new ValidationError('El año lectivo es requerido'));
    }

    return ok(new Grado({
      id: Id.create(),
      courseSectionId: input.courseSectionId,
      grade: gradeResult.unwrap(),
      division: divisionResult.unwrap(),
      teacherId: input.teacherId,
      academicYear: input.academicYear.trim(),
      active: true,
    }));
  }

  static reconstruct(props: GradoProps): Grado {
    return new Grado(props);
  }

  get id(): Id { return this.props.id; }
  get courseSectionId(): string | undefined { return this.props.courseSectionId; }
  get grade(): GradoNumero { return this.props.grade; }
  get division(): Division { return this.props.division; }
  get teacherId(): string | undefined { return this.props.teacherId; }
  get academicYear(): string { return this.props.academicYear; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  update(fields: Partial<Pick<CreateGradoInput, 'courseSectionId' | 'teacherId' | 'academicYear'>>): void {
    if (fields.courseSectionId !== undefined) this.props.courseSectionId = fields.courseSectionId;
    if (fields.teacherId !== undefined) this.props.teacherId = fields.teacherId;
    if (fields.academicYear !== undefined) this.props.academicYear = fields.academicYear;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
