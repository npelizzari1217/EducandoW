import type { Grado } from '../entities/grado';

export interface GradoRepository {
  findById(id: string): Promise<Grado | null>;
  findAll(academicYear?: string): Promise<Grado[]>;
  save(grado: Grado): Promise<void>;
  delete(id: string): Promise<void>;
}
