import { Id } from '../../shared/value-objects/id';

/**
 * AlumnosXCursoXCiclo — authoritative universe of students enrolled in a CourseCycle (SDD-1).
 *
 * One row per (courseCycleId, studentId) pair; the @@unique at the DB level prevents duplicates.
 * Students are added one by one from the enrolled registry.
 *
 * `printable` is DORMANT in SDD-1: always created as false, never read or written by any
 * use-case in this phase. Reserved for boletín generation in SDD-2.
 */

export interface AlumnosXCursoXCicloProps {
  id: string;
  /** Reference to CourseCycle.uuid in the tenant DB. */
  courseCycleId: string;
  /** Reference to Student.id in the tenant DB. */
  studentId: string;
  /** Gate for boletín generation (SDD-2). Always false in SDD-1. */
  printable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlumnosXCursoXCicloInput {
  courseCycleId: string;
  studentId: string;
}

export class AlumnosXCursoXCiclo {
  private constructor(private readonly props: AlumnosXCursoXCicloProps) {}

  static create(input: CreateAlumnosXCursoXCicloInput): AlumnosXCursoXCiclo {
    if (!input.courseCycleId) {
      throw new Error('AlumnosXCursoXCiclo: courseCycleId is required');
    }
    if (!input.studentId) {
      throw new Error('AlumnosXCursoXCiclo: studentId is required');
    }
    const now = new Date();
    return new AlumnosXCursoXCiclo({
      id: Id.create().get(),
      courseCycleId: input.courseCycleId,
      studentId: input.studentId,
      printable: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: AlumnosXCursoXCicloProps): AlumnosXCursoXCiclo {
    return new AlumnosXCursoXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get courseCycleId(): string { return this.props.courseCycleId; }
  get studentId(): string { return this.props.studentId; }
  get printable(): boolean { return this.props.printable; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
