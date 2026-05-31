import type { ActaExamen } from '../entities/acta-examen';

export interface ActaExamenRepository {
  findById(id: string): Promise<ActaExamen | null>;
  findByMateriaCarrera(materiaCarreraId: string): Promise<ActaExamen[]>;
  findAll(): Promise<ActaExamen[]>;
  save(acta: ActaExamen): Promise<void>;
  saveNota(actaId: string, studentId: string, nota: number, condicion: string): Promise<void>;
}
