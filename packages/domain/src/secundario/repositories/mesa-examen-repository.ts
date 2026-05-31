import type { MesaExamen } from '../entities/mesa-examen';

export interface MesaExamenRepository {
  findById(id: string): Promise<MesaExamen | null>;
  findAll(subjectId?: string): Promise<MesaExamen[]>;
  save(mesa: MesaExamen): Promise<void>;
  saveInscripcion(mesaId: string, studentId: string): Promise<void>;
}
