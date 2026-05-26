import type { AcademicCycle } from '../entities/academic-cycle';

export interface AcademicCycleRepository {
  findActive(level?: number): Promise<AcademicCycle[]>;
  findById(id: string): Promise<AcademicCycle | null>;
}
