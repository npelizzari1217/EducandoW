import type { CourseSection } from '../entities/course-section';
import type { LevelType } from '../../institution/value-objects/level';

export interface CourseSectionRepository {
  findById(id: string): Promise<CourseSection | null>;
  findByInstitution(institutionId: string): Promise<CourseSection[]>;
  findByLevel(institutionId: string, level: LevelType, academicYear: string): Promise<CourseSection[]>;
  save(section: CourseSection): Promise<void>;
  delete(id: string): Promise<void>;
}
