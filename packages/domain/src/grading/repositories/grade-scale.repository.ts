import type { GradeScale, GradeScaleValue } from '../entities/grade-scale';

export interface GradeScaleFilters {
  level?: number;
  modality?: number;
  active?: boolean;
}

export interface GradeScaleRepository {
  findById(id: string): Promise<GradeScale | null>;
  list(filters?: GradeScaleFilters): Promise<GradeScale[]>;
  existsByName(level: number, modality: number, name: string, excludeId?: string): Promise<boolean>;
  countActiveValues(scaleId: string): Promise<number>;
  save(scale: GradeScale): Promise<void>;
  softDelete(id: string): Promise<void>;

  // value operations
  findValueById(id: string): Promise<GradeScaleValue | null>;
  saveValue(value: GradeScaleValue): Promise<void>;
  softDeleteValue(id: string): Promise<void>;
  existsValueCode(scaleId: string, code: string, excludeId?: string): Promise<boolean>;
}
