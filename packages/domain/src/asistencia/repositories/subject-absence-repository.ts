/**
 * SubjectAbsenceRepository — port for AusenciaXGrupo persistence (Fase 6, F6-D1).
 * Tenant scoping is implicit via TenantContext.
 */
import type { AusenciaXGrupo } from '../entities/ausencia-x-grupo';

export interface SubjectAbsenceRepository {
  /** Record a new subject absence (upsert by unique key grupoId+studentId+date). */
  record(data: {
    grupoId: string;
    studentId: string;
    date: Date;
    observaciones?: string;
  }): Promise<AusenciaXGrupo>;

  /** Return all absences for a group on a given date. */
  findByGrupoAndDate(grupoId: string, date: Date): Promise<AusenciaXGrupo[]>;

  /** Return all absences for a student in a group. */
  findByGrupoAndStudent(grupoId: string, studentId: string): Promise<AusenciaXGrupo[]>;

  /** Delete a specific absence record by id. */
  delete(id: string): Promise<void>;
}
