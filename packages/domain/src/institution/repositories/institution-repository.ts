import type { Institution } from '../entities';

export interface InstitutionRepository {
  findById(id: string): Promise<Institution | null>;
  findAll(): Promise<Institution[]>;
  save(institution: Institution): Promise<void>;
  delete(id: string): Promise<void>;
  existsByName(name: string): Promise<boolean>;
}
