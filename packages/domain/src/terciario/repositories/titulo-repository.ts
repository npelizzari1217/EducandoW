import type { Titulo } from '../entities/titulo';

export interface TituloRepository {
  findById(id: string): Promise<Titulo | null>;
  findByStudent(studentId: string): Promise<Titulo[]>;
  findAll(): Promise<Titulo[]>;
  save(titulo: Titulo): Promise<void>;
}
