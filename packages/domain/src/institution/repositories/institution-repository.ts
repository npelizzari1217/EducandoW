import type { Institution } from '../entities';

export interface InstitutionRepository {
  findById(id: string): Promise<Institution | null>;
  findAll(): Promise<Institution[]>;
  save(institution: Institution): Promise<void>;
  delete(id: string): Promise<void>;
  existsByName(name: string): Promise<boolean>;
  findByCue(cue: string): Promise<Institution | null>;
  softDelete(id: string): Promise<void>;
  update(institution: Institution): Promise<void>;
  findByDbName(dbName: string): Promise<Institution | null>;
}
