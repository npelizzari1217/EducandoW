import type { Grade } from '../entities/grade';

export interface GradeRepository {
  findById(id: string): Promise<Grade | null>;
  findByStudent(studentId: string): Promise<Grade[]>;
  findBySubjectAndStudent(subjectId: string, studentId: string): Promise<Grade[]>;
  findByCourseSection(courseSectionId: string): Promise<Grade[]>;
  save(grade: Grade): Promise<void>;
  delete(id: string): Promise<void>;
}
