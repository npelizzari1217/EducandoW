import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';
import { Id } from '../../shared/value-objects/id';
import { AgeGroup } from '../value-objects/age-group';
import { Turno } from '../value-objects/turno';

export interface SalaProps {
  id: Id;
  name: string;
  ageGroup: AgeGroup;
  turno: Turno;
  capacity: number;
  academicYear: string;
  active: boolean;
  deletedAt?: Date;
}

export interface CreateSalaProps {
  name: string;
  ageGroup: number;
  turno: string;
  capacity: number;
  academicYear: string;
}

export class Sala {
  private constructor(private readonly props: SalaProps) {}

  static create(input: CreateSalaProps): Result<Sala, ValidationError> {
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Sala name cannot be empty'));
    }
    if (input.name.trim().length > 100) {
      return err(new ValidationError('Sala name cannot exceed 100 characters'));
    }
    if (input.capacity <= 0) {
      return err(new ValidationError('Sala capacity must be greater than 0'));
    }
    if (input.capacity > 50) {
      return err(new ValidationError('Sala capacity cannot exceed 50'));
    }
    if (!/^\d{4}$/.test(input.academicYear)) {
      return err(new ValidationError('Academic year must be in YYYY format'));
    }

    const ageGroupResult = AgeGroup.create(input.ageGroup);
    if (ageGroupResult.isErr()) return err(ageGroupResult.unwrapErr());

    const turnoResult = Turno.create(input.turno);
    if (turnoResult.isErr()) return err(turnoResult.unwrapErr());

    return ok(
      new Sala({
        id: Id.create(),
        name: input.name.trim(),
        ageGroup: ageGroupResult.unwrap(),
        turno: turnoResult.unwrap(),
        capacity: input.capacity,
        academicYear: input.academicYear,
        active: true,
      }),
    );
  }

  static reconstruct(props: SalaProps): Sala {
    return new Sala(props);
  }

  get id(): Id { return this.props.id; }
  get name(): string { return this.props.name; }
  get ageGroup(): AgeGroup { return this.props.ageGroup; }
  get turno(): Turno { return this.props.turno; }
  get capacity(): number { return this.props.capacity; }
  get academicYear(): string { return this.props.academicYear; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
  }
}
