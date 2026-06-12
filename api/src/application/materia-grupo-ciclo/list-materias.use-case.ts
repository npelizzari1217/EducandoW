import { Injectable } from '@nestjs/common';
import type {
  MateriaXCursoXCicloRepository,
  AlumnosXMateriaRepository,
  GrupoRepository,
  MateriaXCursoXCiclo,
} from '@educandow/domain';

export interface MateriaWithCounts {
  materia: MateriaXCursoXCiclo;
  alumnoCount: number;
  grupoCount: number;
}

/**
 * ListMateriasUseCase — Fase 3c (F3-A5).
 *
 * Lists all MateriaXCursoXCiclo for a CourseCycle with enrollment and group counts.
 */
@Injectable()
export class ListMateriasUseCase {
  constructor(
    private readonly materiaRepo: MateriaXCursoXCicloRepository,
    private readonly alumnosRepo: AlumnosXMateriaRepository,
    private readonly grupoRepo: GrupoRepository,
  ) {}

  async execute(courseCycleId: string): Promise<MateriaWithCounts[]> {
    const materias = await this.materiaRepo.findByCourseCycleId(courseCycleId);
    if (materias.length === 0) return [];

    return Promise.all(
      materias.map(async (m) => {
        const [alumnos, grupos] = await Promise.all([
          this.alumnosRepo.findByMateria(m.id),
          this.grupoRepo.findByMateria(m.id),
        ]);
        return {
          materia: m,
          alumnoCount: alumnos.length,
          grupoCount: grupos.length,
        };
      }),
    );
  }
}
