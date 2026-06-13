import { Injectable } from '@nestjs/common';
import {
  GrupoRepository,
  GrupoGlobalRow,
  GrupoGlobalFilters,
  DocenteXCicloRepository,
  resolveAccessScope,
} from '@educandow/domain';

/**
 * ListGruposGlobalUseCase — cross-materia grupo listing with scope-based filtering.
 *
 * Scope rules:
 *  - ROOT/ADMIN (allLevels): no level restriction; apply caller's level filter as-is.
 *  - DIRECTOR/SECRETARIO (isAdministrative): restrict to their compositeLevels.
 *  - TEACHER: restrict to their own grupos (via their DocenteXCiclo records).
 */
@Injectable()
export class ListGruposGlobalUseCase {
  constructor(
    private readonly grupoRepo: GrupoRepository,
    private readonly docenteRepo: DocenteXCicloRepository,
  ) {}

  async execute(
    user: { roles: string[]; levels?: number[]; userId: string },
    filters: { level?: number; courseCycleId?: string; materiaId?: string },
  ): Promise<GrupoGlobalRow[]> {
    const scope = resolveAccessScope(user);
    const gFilters: GrupoGlobalFilters = {};

    if (filters.courseCycleId) gFilters.courseCycleId = filters.courseCycleId;
    if (filters.materiaId) gFilters.materiaId = filters.materiaId;

    if (scope.allLevels) {
      // ROOT/ADMIN: apply level filter as-is (no restriction)
      if (filters.level !== undefined) gFilters.level = filters.level;
    } else if (scope.isAdministrative) {
      // DIRECTOR/SECRETARIO: restrict to their compositeLevels
      const allowedLevels = scope.compositeLevels;
      if (filters.level !== undefined) {
        if (!allowedLevels.includes(filters.level)) return [];
        gFilters.level = filters.level;
      } else {
        if (allowedLevels.length === 0) return [];
        gFilters.levelIn = allowedLevels;
      }
    } else {
      // TEACHER: only their grupos (by their docenteXCiclo records)
      const docenteXCiclos = await this.docenteRepo.findByUserId(user.userId);
      if (docenteXCiclos.length === 0) return [];
      gFilters.docenteXCicloIds = docenteXCiclos.map((d) => d.id);
      if (filters.level !== undefined) gFilters.level = filters.level;
    }

    return this.grupoRepo.findAllGlobal(gFilters);
  }
}
