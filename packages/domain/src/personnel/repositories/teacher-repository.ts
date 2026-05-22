import type { Teacher } from '../entities';

export interface TeacherRepository {
  findById(id: string): Promise<Teacher | null>;
  findByInstitution(institutionId: string): Promise<Teacher[]>;
  findByDni(dni: string): Promise<Teacher | null>;
  search(institutionId: string, query: string): Promise<Teacher[]>;
  save(teacher: Teacher): Promise<void>;
  delete(id: string): Promise<void>;
}
