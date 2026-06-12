import { Injectable } from '@nestjs/common';
import type {
  GrupoRepository,
  AlumnosXGrupoRepository,
  GrupoXCursoXMateriaXCiclo,
  AlumnosXGrupoXCursoXMateriaXCiclo,
} from '@educandow/domain';

export interface GrupoWithAlumnos {
  grupo: GrupoXCursoXMateriaXCiclo;
  alumnos: AlumnosXGrupoXCursoXMateriaXCiclo[];
}

/**
 * ListGruposUseCase — Fase 3c (F3-A6).
 *
 * Lists all groups for a MateriaXCursoXCiclo, each with its student list.
 * Also provides getAlumnosForGrupo for the F3-P6 endpoint.
 */
@Injectable()
export class ListGruposUseCase {
  constructor(
    private readonly grupoRepo: GrupoRepository,
    private readonly alumnosGrupoRepo: AlumnosXGrupoRepository,
  ) {}

  async execute(materiaXCursoXCicloId: string): Promise<GrupoWithAlumnos[]> {
    const grupos = await this.grupoRepo.findByMateria(materiaXCursoXCicloId);
    if (grupos.length === 0) return [];

    return Promise.all(
      grupos.map(async (g) => {
        const alumnos = await this.alumnosGrupoRepo.findByGrupo(g.id);
        return { grupo: g, alumnos };
      }),
    );
  }

  /** Returns the AlumnosXGrupo entries for a specific grupo (F3-P6). */
  async getAlumnosForGrupo(grupoId: string): Promise<AlumnosXGrupoXCursoXMateriaXCiclo[]> {
    return this.alumnosGrupoRepo.findByGrupo(grupoId);
  }
}
