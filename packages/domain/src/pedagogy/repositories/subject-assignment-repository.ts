import type { SubjectAssignment } from '../entities/subject-assignment';

export interface SubjectAssignmentRepository {
  findById(id: string): Promise<SubjectAssignment | null>;
  findBySubject(subjectId: string): Promise<SubjectAssignment[]>;
  findByTeacher(teacherId: string): Promise<SubjectAssignment[]>;
  findByCourseSection(courseSectionId: string): Promise<SubjectAssignment[]>;
  save(assignment: SubjectAssignment): Promise<void>;
  delete(id: string): Promise<void>;
}
