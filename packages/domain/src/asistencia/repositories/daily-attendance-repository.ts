/**
 * DailyAttendanceRepository — port for AsistenciaDiaria persistence (Fase 6, F6-D2).
 * Tenant scoping is implicit via TenantContext.
 */
import type { AsistenciaDiaria } from '../entities/asistencia-diaria';

export interface DailyAttendanceRepository {
  /** Record a daily attendance entry (upsert by unique key ccId+studentId+date). */
  record(data: {
    courseCycleId: string;
    studentId: string;
    date: Date;
    statusCode: string;
    observaciones?: string;
  }): Promise<AsistenciaDiaria>;

  /** Return all attendance records for a CursoXCiclo on a given date. */
  findByCourseAndDate(courseCycleId: string, date: Date): Promise<AsistenciaDiaria[]>;

  /** Return all attendance records for a student in a CursoXCiclo. */
  findByCourseAndStudent(courseCycleId: string, studentId: string): Promise<AsistenciaDiaria[]>;
}
