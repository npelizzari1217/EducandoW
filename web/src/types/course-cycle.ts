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
}

export interface CourseCycleListResponse {
  data: CourseCycle[];
  page: number;
  pageSize: number;
  total: number;
}

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
  studyPlanId: string;
  cycleId: string;
}

export interface GenerateResult {
  created: number;
  skipped: number;
  total: number;
}
