import type { StudentGuardian } from '../entities';

export interface StudentGuardianRepository {
  save(guardian: StudentGuardian): Promise<void>;
  findById(id: string): Promise<StudentGuardian | null>;
  findByStudentId(studentId: string): Promise<StudentGuardian[]>;
  findByGuardianUserId(guardianUserId: string): Promise<StudentGuardian[]>;
  delete(id: string): Promise<void>;
  findByComposite(studentId: string, userId: string): Promise<StudentGuardian | null>;
}
