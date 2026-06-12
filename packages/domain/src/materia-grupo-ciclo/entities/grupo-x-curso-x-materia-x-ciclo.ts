import { Id } from '../../shared/value-objects/id';

/**
 * GrupoXCursoXMateriaXCiclo — associates EXACTLY ONE DocenteXCiclo with a subset
 * of students from a MateriaXCursoXCiclo's universe (Fase 3, MGC-R3).
 *
 * For a non-split subject: 1 group = all enrolled students (MGC-S7).
 * For a split subject (materia partida): N groups, each with its own DocenteXCiclo (MGC-S8).
 *
 * The @@unique([materiaXCursoXCicloId, docenteXCicloId]) at the DB level ensures
 * one docente can have at most one group per materia.
 *
 * Overlap (co-docencia) is allowed at the AlumnosXGrupo level — same student in
 * multiple groups of the same materia is valid (MGC-R5 / MGC-S12).
 */

export interface GrupoXCursoXMateriaXCicloProps {
  id: string;
  materiaXCursoXCicloId: string;
  /** Reference to DocenteXCiclo.id — exactly one per group (MGC-R3). */
  docenteXCicloId: string;
  /** Optional name for the group (e.g., "Comisión A"). */
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGrupoXCursoXMateriaXCicloInput {
  materiaXCursoXCicloId: string;
  docenteXCicloId: string;
  name?: string;
}

export class GrupoXCursoXMateriaXCiclo {
  private constructor(private readonly props: GrupoXCursoXMateriaXCicloProps) {}

  static create(input: CreateGrupoXCursoXMateriaXCicloInput): GrupoXCursoXMateriaXCiclo {
    if (!input.materiaXCursoXCicloId) {
      throw new Error('GrupoXCursoXMateriaXCiclo: materiaXCursoXCicloId is required');
    }
    if (!input.docenteXCicloId) {
      // MGC-R3: a group MUST have exactly one DocenteXCiclo
      throw new Error('GrupoXCursoXMateriaXCiclo: docenteXCicloId is required (MGC-R3)');
    }
    const now = new Date();
    return new GrupoXCursoXMateriaXCiclo({
      id: Id.create().get(),
      materiaXCursoXCicloId: input.materiaXCursoXCicloId,
      docenteXCicloId: input.docenteXCicloId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: GrupoXCursoXMateriaXCicloProps): GrupoXCursoXMateriaXCiclo {
    return new GrupoXCursoXMateriaXCiclo(props);
  }

  get id(): string { return this.props.id; }
  get materiaXCursoXCicloId(): string { return this.props.materiaXCursoXCicloId; }
  get docenteXCicloId(): string { return this.props.docenteXCicloId; }
  get name(): string | undefined { return this.props.name; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
}
