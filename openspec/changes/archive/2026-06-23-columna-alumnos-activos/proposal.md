# Proposal — columna-alumnos-activos

## Intent

**Problem**: The CursosXCiclo management list (`web/src/pages/dashboard/course-cycles.tsx`) shows no indication of how many students are enrolled in each course-cycle. Admins must open each CC to gauge enrollment, slowing day-to-day decisions (e.g. whether a CC is worth assigning subjects/competencies to).

**Why now**: Enrollment volume is the single most-requested signal for the listing, and the data already exists in the tenant DB — exposing it is low-risk and high-value.

**Success looks like**: Each row of the admin CursosXCiclo table displays an **"Alumnos"** column with the count of enrolled students, fetched without N+1 queries and without a DB migration.

## Scope

**In scope**
- Add `countEnrolledByCourseCycleIds(ids: string[]): Promise<Map<string, number>>` to the CourseCycle repository port + Prisma implementation (tenant client).
- Thread the count through `ListCourseCyclesUseCase` → controller `toResponse()` → response DTO (`studentCount: number`).
- Add `studentCount?: number` to the frontend `CourseCycle` type.
- Add the "Alumnos" column to the admin listing table.
- Tests: repository aggregation, use-case, frontend column render.

**Out of scope (deferred)**
- Teacher list path (`listTeacherCCsUC`) — no count added now.
- Gating "Asignar materias y competencias" on `studentCount > 0` (UX opportunity, recorded only).
- Any `Student.active` / status-based filtering or distinct "active vs inactive" semantics.

## Decisions (baked in)

1. **Definition**: "Alumnos" = `COUNT` of `AlumnosXCursoXCiclo` rows per `courseCycleId` — ALL enrolled, NO `Student.active` filter. Consistent with `enrolled-students.query.ts`. Each bridge row IS an enrollment. Header label: **"Alumnos"**.
2. **Approach = Option A** (single `groupBy` aggregation, no N+1): one `alumnosXCursoXCiclo.groupBy({ by: ['courseCycleId'], where: { courseCycleId: { in: ids } }, _count: { studentId: true } })` per page. NOT `include: { _count }` (subquery per row).
3. **Multi-tenant**: count comes only from the TENANT DB via `TenantContext.getClient()`. No master/tenant mixing.
4. **No DB migration**: read-only aggregation over existing `@@index([courseCycleId])`. Code-only, standard deploy.
5. **Pedagogical level**: **level-agnostic** — the count is per CourseCycle regardless of pedagogical level.
6. **Error handling**: empty-safe — a missing count maps to `0`; no throws in domain/application.

## Approach & rationale

Follow the existing `modality` threading precedent: the count is a derived, non-domain field stitched in at the controller. Port lives in `packages/domain`, implementation in `api/infrastructure`, orchestration in the use case (application), thin controller. The repository method speaks domain language and returns a `Map<string, number>` (not ORM types). One aggregation keeps the list endpoint O(1) in queries regardless of page size.

## Files

- `packages/domain/.../course-cycle-repository.ts` (port)
- `api/.../prisma-course-cycle.repository.ts` (impl)
- `api/.../course-cycle.use-cases.ts` (ListCourseCyclesUseCase)
- `api/.../course-cycle.controller.ts` (thread into toResponse)
- `web/src/types/course-cycle.ts` (type)
- `web/src/pages/dashboard/course-cycles.tsx` (column)
