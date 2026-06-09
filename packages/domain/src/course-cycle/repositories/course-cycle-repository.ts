import type { CourseCycle } from '../entities/course-cycle';

export interface EnrolledStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

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
  /**
   * Returns the (level, modality) pair for grading config lookup, derived from
   * CourseCycle → StudyPlan. Returns null when the cycle does not exist.
   * Design §2: modality resolved via StudyPlan.modality (authoritative source).
   */
  findGradingContextByUuid(courseCycleUuid: string): Promise<{ level: number; modality: number } | null>;

  /**
   * Returns enrolled students for a CourseCycle, derived from the heuristic join
   * (CourseCycle → CourseSection → Enrollment → Student). Empty array if cycle not
   * found or has no active enrollments.
   * Delegates to the shared infra helper findEnrolledStudentsByCourseCycle.
   */
  findEnrolledStudents(uuid: string): Promise<EnrolledStudent[]>;

  /**
   * Returns CourseCycles where homeroomTeacherId = teacherId (AD-6 "por curso" path).
   * Empty array when no match — caller returns HTTP 200 with empty data, never 404.
   * Tenant scoping is via TenantContext.
   */
  findByHomeroomTeacher(teacherId: string): Promise<CourseCycle[]>;

  /**
   * Returns CourseCycles whose courseId (CourseSection FK) is in the provided set.
   * Used for "por materia": SubjectAssignment.courseSectionId → CourseCycle.courseId.
   * Tenant scoping is via TenantContext.
   */
  findByCourseSectionIds(courseSectionIds: string[]): Promise<CourseCycle[]>;
}
