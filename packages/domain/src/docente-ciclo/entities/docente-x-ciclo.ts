import { Id } from '../../shared/value-objects/id';

/**
 * DocenteXCiclo — represents a User's participation as institutional personnel
 * in a specific academic cycle (Fase 2, DC-R1).
 *
 * Covers BOTH teachers and preceptors. Behavioral distinction is determined by
 * the User's assigned system modules (DC-R3) — NOT by a type flag here.
 *
 * Persona fields (dni, firstName, etc.) live in User (master DB) — DC-R2.
 * userId is a cross-DB reference (no FK — AD-6 pattern, same as Teacher.userId).
 */

export interface DocenteXCicloProps {
  id: string;
  /** Cross-DB reference to master User.id (no FK — AD-6). */
  userId: string;
  /** Reference to AcademicCycle.uuid in the tenant DB. */
  cycleId: string;
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocenteXCicloInput {
  userId: string;
  cycleId: string;
}

export class DocenteXCiclo {
  private constructor(private readonly props: DocenteXCicloProps) {}

  static create(input: CreateDocenteXCicloInput): DocenteXCiclo {
    const now = new Date();
    return new DocenteXCiclo({
      id: Id.create().get(),
      userId: input.userId,
      cycleId: input.cycleId,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: DocenteXCicloProps): DocenteXCiclo {
    return new DocenteXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get cycleId(): string { return this.props.cycleId; }
  get active(): boolean { return this.props.active; }
  get deletedAt(): Date | undefined { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
