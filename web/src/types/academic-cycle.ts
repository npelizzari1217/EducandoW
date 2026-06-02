export interface AcademicCycle {
  uuid: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  modality: number;
  startDate: string;
  endDate: string;
  active: boolean;
  firstBimonthStart: string | null;
  firstBimonthEnd: string | null;
  secondBimonthStart: string | null;
  secondBimonthEnd: string | null;
  thirdBimonthStart: string | null;
  thirdBimonthEnd: string | null;
  fourthBimonthStart: string | null;
  fourthBimonthEnd: string | null;
}

export interface AcademicCycleListResponse {
  data: AcademicCycle[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateAcademicCycleDto {
  code: string;
  name: string;
  description?: string | null;
  level: number;
  modality?: number;
  startDate: string;
  endDate: string;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}

export interface UpdateAcademicCycleDto {
  code?: string;
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  firstBimonthStart?: string;
  firstBimonthEnd?: string;
  secondBimonthStart?: string;
  secondBimonthEnd?: string;
  thirdBimonthStart?: string;
  thirdBimonthEnd?: string;
  fourthBimonthStart?: string;
  fourthBimonthEnd?: string;
}
