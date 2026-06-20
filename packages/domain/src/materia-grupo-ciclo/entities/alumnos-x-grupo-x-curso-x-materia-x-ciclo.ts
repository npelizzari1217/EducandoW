import { Id } from '../../shared/value-objects/id';

/**
 * AlumnosXGrupoXCursoXMateriaXCiclo — maps a student (via their materia membership)
 * into a specific group (Fase 3, MGC-R4, MGC-R5).
 *
 * The FK is to MateriasXAlumnoXCursoXCiclo (not to Student directly).
 * This enforces grupo ⊆ materia at the database level:
 *   - You can only add a student to a group if they already exist in the materia's universe.
 *   - Cross-course membership is impossible because the alumnoMateria row itself
 *     belongs to a specific CourseCycle (enforced by the FK chain at DB level).
 *
 * Co-docencia (MGC-R5 / MGC-S12): the same alumnosXMateriaXCursoXCicloId may appear
 * in more than one grupo of the same materia. The @@unique is on (grupoId, alumnosXMateriaId),
 * so duplicates within the same grupo are prevented but cross-grupo overlap is allowed.
 */

export interface AlumnosXGrupoXCursoXMateriaXCicloProps {
  id: string;
  grupoId: string;
  /** FK → MateriasXAlumnoXCursoXCiclo.id (enforces grupo ⊆ materia at DB level). */
  alumnosXMateriaXCursoXCicloId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlumnosXGrupoXCursoXMateriaXCicloInput {
  grupoId: string;
  alumnosXMateriaXCursoXCicloId: string;
}

export class AlumnosXGrupoXCursoXMateriaXCiclo {
  private constructor(private readonly props: AlumnosXGrupoXCursoXMateriaXCicloProps) {}

  static create(input: CreateAlumnosXGrupoXCursoXMateriaXCicloInput): AlumnosXGrupoXCursoXMateriaXCiclo {
    if (!input.grupoId) {
      throw new Error('AlumnosXGrupoXCursoXMateriaXCiclo: grupoId is required');
    }
    if (!input.alumnosXMateriaXCursoXCicloId) {
      // MGC-R4: the FK reference to universe membership is mandatory
      throw new Error(
        'AlumnosXGrupoXCursoXMateriaXCiclo: alumnosXMateriaXCursoXCicloId is required (MGC-R4)'
      );
    }
    const now = new Date();
    return new AlumnosXGrupoXCursoXMateriaXCiclo({
      id: Id.create().get(),
      grupoId: input.grupoId,
      alumnosXMateriaXCursoXCicloId: input.alumnosXMateriaXCursoXCicloId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: AlumnosXGrupoXCursoXMateriaXCicloProps): AlumnosXGrupoXCursoXMateriaXCiclo {
    return new AlumnosXGrupoXCursoXMateriaXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get grupoId(): string { return this.props.grupoId; }
  get alumnosXMateriaXCursoXCicloId(): string { return this.props.alumnosXMateriaXCursoXCicloId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
