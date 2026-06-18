import type { NotaCursadaTerciario } from '../entities/nota-cursada-terciario';

export interface NotaCursadaTerciarioRepository {
  findByInscripcion(inscripcionMateriaId: string): Promise<NotaCursadaTerciario[]>;
  findSlot(inscripcionMateriaId: string, slot: string): Promise<NotaCursadaTerciario | null>;
  save(entity: NotaCursadaTerciario): Promise<void>;
  update(entity: NotaCursadaTerciario): Promise<void>;
}
