import { Id } from '../../shared/value-objects/id';
import { Orientacion } from '../value-objects/orientacion';

export interface CursoProps {
  id: Id;
  courseSectionId?: string;
  year: number;
  division: string;
  orientacion?: Orientacion;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
}

export type CreateCursoInput = Omit<CursoProps, 'id' | 'active' | 'deletedAt'>;

export class Curso {
  private constructor(private props: CursoProps) {}

  static create(input: CreateCursoInput): Curso {
    return new Curso({
      ...input,
      id: Id.create(),
      active: true,
    });
  }

  static reconstruct(props: CursoProps): Curso {
    return new Curso(props);
  }

  get id(): Id {
    return this.props.id;
  }

  get courseSectionId(): string | undefined {
    return this.props.courseSectionId;
  }

  get year(): number {
    return this.props.year;
  }

  get division(): string {
    return this.props.division;
  }

  get orientacion(): Orientacion | undefined {
    return this.props.orientacion;
  }

  get academicYear(): string {
    return this.props.academicYear;
  }

  get active(): boolean {
    return this.props.active;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  update(input: Partial<CreateCursoInput>): void {
    if (input.year !== undefined) this.props.year = input.year;
    if (input.division !== undefined) this.props.division = input.division;
    if (input.orientacion !== undefined) this.props.orientacion = input.orientacion;
    if (input.academicYear !== undefined) this.props.academicYear = input.academicYear;
    if (input.courseSectionId !== undefined) this.props.courseSectionId = input.courseSectionId;
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
