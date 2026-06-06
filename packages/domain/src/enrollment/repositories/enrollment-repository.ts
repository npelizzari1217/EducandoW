import type { Enrollment } from '../entities';

export interface FindByCourseParams {
  cycleId: string;
  level?: number;
  grade?: string;
  division?: string;
  academicYear?: string;
}

export interface EnrollmentRepository {
  findById(id: string): Promise<Enrollment | null>;
  findByStudent(studentId: string): Promise<Enrollment[]>;
  findByInstitution(institutionId: string): Promise<Enrollment[]>;
  findByCycleId(cycleId: string): Promise<Enrollment[]>;
  findByCourse(params: FindByCourseParams): Promise<Enrollment[]>;
  findActive(studentId: string): Promise<Enrollment | null>;
  save(enrollment: Enrollment): Promise<void>;
  saveMany(enrollments: Enrollment[]): Promise<void>;
  delete(id: string): Promise<void>;
}
