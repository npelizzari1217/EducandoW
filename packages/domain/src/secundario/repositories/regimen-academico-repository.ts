import type { RegimenAcademico } from '../entities/regimen-academico';

export interface RegimenAcademicoRepository {
  findById(id: string): Promise<RegimenAcademico | null>;
  findByCursoAndSubject(cursoId: string, subjectId: string): Promise<RegimenAcademico | null>;
  findByCurso(cursoId: string): Promise<RegimenAcademico[]>;
  save(regimen: RegimenAcademico): Promise<void>;
}
