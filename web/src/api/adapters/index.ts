/**
 * API Response Adapters
 *
 * The adapter layer is the ONLY place in the web package that references
 * raw API envelope fields (e.g., `data.data`, `data.items`). Components
 * and hooks consume adapted output — never raw response shapes.
 *
 * Schema:
 *   List:   { data: { data: T[], total: number } }
 *   Single: { data: { ...item } }
 */

import type { AxiosResponse } from 'axios';
import type { AcademicCycle as AcademicCycleDto } from '../../types/academic-cycle';
import type { CourseCycle as CourseCycleDto } from '../../types/course-cycle';

// ── Generic envelope unwrappers ────────────────────────────

interface ListEnvelope<T> {
  data: T[];
  total?: number;
}

type ApiListResponse<T> = AxiosResponse<{ data: ListEnvelope<T> } | ListEnvelope<T>>;

/**
 * Extracts the array from a paginated API list response.
 *
 * Given:  { data: { data: [...items], total: N } }
 * Returns: [...items]  (always an array, never undefined)
 */
export function adaptListResponse<T>(res: ApiListResponse<T>): T[] {
  const body = res.data as Record<string, unknown> | undefined;
  if (body && 'data' in body && Array.isArray((body as Record<string, unknown>).data)) {
    return (body as Record<string, unknown>).data as T[];
  }
  if (Array.isArray(body)) {
    return body as T[];
  }
  return [];
}

interface SingleEnvelope<T> {
  data: T;
}

type ApiSingleResponse<T> = AxiosResponse<{ data: T } | SingleEnvelope<T>>;

/**
 * Extracts a single item from an API response envelope.
 *
 * Given:  { data: { ...item } }
 * Returns: item  (or null if not present)
 */
export function adaptSingleResponse<T>(res: ApiSingleResponse<T>): T | null {
  const body = res.data;
  if (body && typeof body === 'object' && 'data' in body && body.data !== null && body.data !== undefined) {
    return body.data as T;
  }
  return (body as T) ?? null;
}

// ── Domain-specific adapters ────────────────────────────────

/**
 * Adapts a raw academic cycle from the API into the web DTO shape.
 * Currently a passthrough — the API already returns the web DTO format.
 * Exists for future-proofing and to enforce the adapter boundary.
 */
export function adaptAcademicCycle(raw: AcademicCycleDto): AcademicCycleDto {
  return raw;
}

/**
 * Adapts a raw course cycle from the API into the web DTO shape.
 * Currently a passthrough — the API already returns the web DTO format.
 * Exists for future-proofing and to enforce the adapter boundary.
 */
export function adaptCourseCycle(raw: CourseCycleDto): CourseCycleDto {
  return raw;
}
