import type { CourseCycle } from '../entities/course-cycle';

export interface CourseCycleFilters {
  level?: number;
  cycleId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateManyResult {
  created: number;
  skipped?: number;
  updated: number;
  total: number;
}

export interface CourseCycleRepository {
  findById(id: string): Promise<CourseCycle | null>;
  findByUuid(uuid: string): Promise<CourseCycle | null>;
  findByPair(courseId: string, cycleId: string): Promise<CourseCycle | null>;
  findAll(filters: CourseCycleFilters): Promise<PaginatedResult<CourseCycle>>;
  save(courseCycle: CourseCycle): Promise<void>;
  createMany(courseCycles: CourseCycle[]): Promise<CreateManyResult>;
  softDelete(id: string): Promise<void>;
}
