import { Id } from '../../shared/value-objects/id';
import { Level } from '../../institution/value-objects/level';
import { IngresanteStatus } from '../value-objects/ingresante-status';
import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export interface IngresanteProps {
  id: Id;
  firstName: string;
  lastName: string;
  dni: string;
  birthDate?: Date;
  address?: string;
  phone?: string;
  email?: string;
  cycleId?: Id;
  level: Level;
  status: IngresanteStatus;
  createdAt?: Date;
  deletedAt?: Date;
}

type CreateInput = Omit<IngresanteProps, 'id' | 'status' | 'createdAt' | 'deletedAt' | 'cycleId'> & {
  cycleId: Id;
};

export class Ingresante {
  private constructor(private props: IngresanteProps) {}

  static create(props: CreateInput): Result<Ingresante, ValidationError> {
    if (!props.firstName?.trim()) {
      return err(new ValidationError('firstName must not be empty'));
    }
    if (!props.lastName?.trim()) {
      return err(new ValidationError('lastName must not be empty'));
    }
    if (!props.dni?.trim()) {
      return err(new ValidationError('dni must not be empty'));
    }

    return ok(
      new Ingresante({
        ...props,
        id: Id.create(),
        status: IngresanteStatus.reconstruct('INSCRIPTO'),
        createdAt: new Date(),
      }),
    );
  }

  static reconstruct(props: IngresanteProps): Ingresante {
    return new Ingresante(props);
  }

  // ── Getters ──────────────────────────────────────────────

  get id(): Id {
    return this.props.id;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get dni(): string {
    return this.props.dni;
  }

  get birthDate(): Date | undefined {
    return this.props.birthDate;
  }

  get address(): string | undefined {
    return this.props.address;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get cycleId(): Id | undefined {
    return this.props.cycleId;
  }

  get level(): Level {
    return this.props.level;
  }

  get status(): IngresanteStatus {
    return this.props.status;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // ── Mutations ────────────────────────────────────────────

  transitionTo(next: IngresanteStatus): Result<void, ValidationError> {
    if (!this.props.status.canTransitionTo(next)) {
      return err(
        new ValidationError(
          `Transición inválida: no se puede pasar de ${this.props.status.value} a ${next.value}`,
        ),
      );
    }
    this.props.status = next;
    return ok(undefined);
  }

  markIngreso(): Result<void, ValidationError> {
    return this.transitionTo(IngresanteStatus.reconstruct('INGRESO'));
  }

  markNoIngresara(): Result<void, ValidationError> {
    return this.transitionTo(IngresanteStatus.reconstruct('NO_INGRESARA'));
  }
}
