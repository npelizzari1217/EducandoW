import type { AcademicCycle } from '../entities/academic-cycle';

export interface AcademicCycleFilters {
  level?: number;
  active?: boolean;
  code?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AcademicCycleRepository {
  findById(id: number): Promise<AcademicCycle | null>;
  findByUuid(uuid: string): Promise<AcademicCycle | null>;
  findByCode(code: string): Promise<AcademicCycle | null>;
  findActive(level?: number): Promise<AcademicCycle[]>;
  findAll(filters: AcademicCycleFilters): Promise<PaginatedResult<AcademicCycle>>;
  save(cycle: AcademicCycle): Promise<void>;
  softDelete(uuid: string): Promise<void>;
}
