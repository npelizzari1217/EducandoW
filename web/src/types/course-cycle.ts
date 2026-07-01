import type { PaginatedResult, CreateManyResult } from '@educandow/domain';

export interface BimonthDateSet {
  firstBimonthStart: string | null;
  firstBimonthEnd: string | null;
  secondBimonthStart: string | null;
  secondBimonthEnd: string | null;
  thirdBimonthStart: string | null;
  thirdBimonthEnd: string | null;
  fourthBimonthStart: string | null;
  fourthBimonthEnd: string | null;
}

/**
 * Course Cycle DTO — represents the API wire format.
 *
 * NOTE: The domain package (`@educandow/domain`) exports `CourseCycle` as an
 * entity class with Date objects and value objects (CourseName, PassingGrade,
 * BimonthPeriod, Level). This DTO is the JSON serialization format.
 */
export interface CourseCycle {
  uuid: string;
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: string;
  level: number;
  active: boolean;
  passingGrade: number;
  promotionText: string | null;
  ownBimonthDates: BimonthDateSet;
  effectiveBimonthDates: BimonthDateSet;
  lastModifiedAt: string;
  /** Number of students enrolled in this CourseCycle. Optional for back-compat. */
  studentCount?: number;
  /**
   * Active grading phase (Capacidad A — fase de calificación bimestral).
   * NULL = no phase activated yet / cutover (blocks all grading).
   * Only meaningful for Primario (20-22) / Secundario (30-32); Inicial/Terciario
   * never populate this field.
   */
  gradingPhase?: 'BIM_1' | 'BIM_2' | 'BIM_3' | 'BIM_4' | 'CIERRE' | null;
}

/** Uses domain's paginated result shape */
export type CourseCycleListResponse = PaginatedResult<CourseCycle>;

export interface CreateCourseCycleDto {
  courseId: string;
  studyPlanId: string;
  cycleId: string;
  courseName: string;
  level: string;
  passingGrade: number;
  promotionText?: string | null;
  firstBimonthStart: string;
  firstBimonthEnd: string;
  secondBimonthStart: string;
  secondBimonthEnd: string;
  thirdBimonthStart: string;
  thirdBimonthEnd: string;
  fourthBimonthStart: string;
  fourthBimonthEnd: string;
}

export interface UpdateCourseCycleDto {
  courseName?: string;
  passingGrade?: number;
  active?: boolean;
  promotionText?: string | null;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

export interface GenerateCourseCyclesDto {
  level: number;
  cycleId: string;
  studyPlanId?: string;
}

/** Uses domain's bulk creation result shape */
export type GenerateResult = CreateManyResult;
