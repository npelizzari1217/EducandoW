import type { Ingresante } from '../entities';
import type { Id } from '../../shared/value-objects/id';

export interface IngresanteRepository {
  save(ingresante: Ingresante): Promise<void>;
  findById(id: Id): Promise<Ingresante | null>;
  findByStatus(status: string): Promise<Ingresante[]>;
  findAll(): Promise<Ingresante[]>;
  findByDni(dni: string): Promise<Ingresante | null>;
  delete(id: Id): Promise<void>;
}
