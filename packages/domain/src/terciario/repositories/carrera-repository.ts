import type { Carrera } from '../entities/carrera';

export interface CarreraRepository {
  findById(id: string): Promise<Carrera | null>;
  findAll(): Promise<Carrera[]>;
  save(carrera: Carrera): Promise<void>;
  delete(id: string): Promise<void>;
}
