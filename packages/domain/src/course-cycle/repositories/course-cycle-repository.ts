import type { CourseCycle } from '../entities/course-cycle';

export interface EnrolledStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

export interface CourseCycleFilters {
  level?: number;
  /** Restricción de acceso por nivel: lista de códigos compuestos permitidos.
   * Se usa cuando !allLevels (SECRETARIO/DIRECTOR). Filtra sobre el campo `level` del CourseCycle.
   * Si está presente y no vacío, limita los resultados a los niveles permitidos.
   * Se intersecta con `level` cuando ambos están presentes. */
  levelIn?: number[];
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
   * Bulk variant of findGradingContextByUuid — one query for N course cycles.
   * Returns a Map keyed by CourseCycle UUID with the authoritative StudyPlan.{level, modality}.
   * UUIDs with no matching record or missing StudyPlan are absent from the Map.
   * Design §2: StudyPlan is the authoritative modality source for CourseCycle grading.
   */
  findGradingContextsByUuids(uuids: string[]): Promise<Map<string, { level: number; modality: number }>>;

  /**
   * Returns enrolled students for a CourseCycle, derived from the heuristic join
   * (CourseCycle → CourseSection → Enrollment → Student). Empty array if cycle not
   * found or has no active enrollments.
   * Delegates to the shared infra helper findEnrolledStudentsByCourseCycle.
   */
  findEnrolledStudents(uuid: string): Promise<EnrolledStudent[]>;

  /**
   * Returns CourseCycles whose courseId (CourseSection FK) is in the provided set.
   * Used for "por materia": SubjectAssignment.courseSectionId → CourseCycle.courseId.
   * Tenant scoping is via TenantContext.
   */
  findByCourseSectionIds(courseSectionIds: string[]): Promise<CourseCycle[]>;

  /**
   * Returns CourseCycles whose uuid is in the provided set.
   * Used for "por grupo": MateriaXCursoXCiclo.courseCycleId → CourseCycle.uuid.
   * Empty input → empty array. Tenant scoping is via TenantContext.
   */
  findByUuids(uuids: string[]): Promise<CourseCycle[]>;

  /**
   * Returns a Map of CourseCycle UUID → enrolled student count.
   * Uses a single groupBy aggregation over AlumnosXCursoXCiclo (no N+1).
   * Empty input → empty Map (no DB query). CCs with zero enrollments are absent
   * from the Map; callers MUST default missing keys to 0.
   * Tenant scoping is via TenantContext.
   */
  countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>;
}
