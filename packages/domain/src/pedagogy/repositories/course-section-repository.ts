import type { CourseSection } from '../entities/course-section';

export interface CourseSectionRepository {
  findById(id: string): Promise<CourseSection | null>;
  findByInstitution(institutionId: string): Promise<CourseSection[]>;
  findByLevel(institutionId: string, level: string, academicYear: string): Promise<CourseSection[]>;
  save(section: CourseSection): Promise<void>;
  delete(id: string): Promise<void>;
}
