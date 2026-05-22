import type { Attendance } from '../entities/attendance';

export interface AttendanceRepository {
  findById(id: string): Promise<Attendance | null>;
  findByStudent(studentId: string): Promise<Attendance[]>;
  findByCourseSectionAndDate(courseSectionId: string, date: Date): Promise<Attendance[]>;
  findByStudentAndDate(studentId: string, date: Date): Promise<Attendance | null>;
  save(attendance: Attendance): Promise<void>;
  delete(id: string): Promise<void>;
}
