import { Injectable } from '@nestjs/common';
import type { DocenteXCiclo, DocenteXCicloRepository } from '@educandow/domain';

/**
 * DocenteXCicloService — application service (Fase 2, F2-A1).
 *
 * Provides getOrCreateForCycle (idempotent upsert) and module-check helpers
 * that determine whether a User can act as teacher (GRADES) or preceptor
 * (ATTENDANCE) — DC-R3.
 *
 * This service is called by Fases 3 and 4 when assigning a User to a group
 * or a CursoXCiclo. The upsert delegates to the repository; the @@unique
 * constraint in the DB guarantees no duplicates even under concurrent requests.
 */
@Injectable()
export class DocenteXCicloService {
  constructor(private readonly repo: DocenteXCicloRepository) {}

  /**
   * Returns the existing DocenteXCiclo for (userId, cycleId), or creates one.
   * Idempotent — DC-S3: second call with same pair returns the same record.
   */
  async getOrCreateForCycle(userId: string, cycleId: string): Promise<DocenteXCiclo> {
    return this.repo.upsert({ userId, cycleId });
  }

  /**
   * Door 1 check: can this user enter grades?
   * Requires GRADES module — DC-S5, DC-S6.
   * Caller passes the list of module codes from the User.
   */
  canEnterGrades(moduleCodes: string[]): boolean {
    return moduleCodes.includes('GRADES');
  }

  /**
   * Door 1 check: can this user record attendance?
   * Requires ATTENDANCE module — DC-S7.
   */
  canRecordAttendance(moduleCodes: string[]): boolean {
    return moduleCodes.includes('ATTENDANCE');
  }
}
