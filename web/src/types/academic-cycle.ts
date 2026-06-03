import type { PaginatedResult } from '@educandow/domain';

/**
 * Academic Cycle DTO — represents the API wire format.
 *
 * NOTE: The domain package (`@educandow/domain`) exports `AcademicCycle` as an
 * entity class with Date objects and value objects (CycleCode, BimonthPeriod).
 * This DTO is the JSON serialization format that comes over the wire, with
 * string dates and flat bimonth fields. The adapter layer bridges the two.
 */
export interface AcademicCycle {
  uuid: string;
  code: string;
  name: string;
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

/** Uses domain's paginated result shape */
export type AcademicCycleListResponse = PaginatedResult<AcademicCycle>;

export interface CreateAcademicCycleDto {
  code: string;
  name: string;
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
