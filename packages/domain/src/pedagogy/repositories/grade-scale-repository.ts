import type { Id } from '../../shared/value-objects/id';
import type { GradeScale, GradeScaleValue } from '../entities/grade-scale';

export interface GradeScaleRepository {
  findById(id: string): Promise<GradeScale | null>;
  findByLevel(level: number, modality: number): Promise<GradeScale[]>;
  findValueById(id: string): Promise<GradeScaleValue | null>;
  findValuesByScale(scaleId: Id): Promise<GradeScaleValue[]>;
  save(scale: GradeScale): Promise<void>;
  saveValue(value: GradeScaleValue): Promise<void>;
  delete(id: string): Promise<void>;
}
