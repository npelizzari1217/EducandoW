import type { Curso } from '../entities/curso';

export interface CursoRepository {
  findById(id: string): Promise<Curso | null>;
  findAll(academicYear?: string): Promise<Curso[]>;
  save(curso: Curso): Promise<void>;
  delete(id: string): Promise<void>;
}
