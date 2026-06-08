# Verify Report — competency-hierarchy (Fase 2) FINAL

**Verdict**: PASS — 0 CRITICAL, 0 WARNING, 2 SUGGESTION (non-blocking)
**Date**: 2026-06-08

## Test Gates (actual)

| Gate | Result |
|------|--------|
| `pnpm --filter domain test` | 792/792 passed (70 files) — CLEAN |
| `pnpm --filter api test` | 617/623 passed (71 files) — 6 pre-existing failures (postgres-admin.service ×6, ensure-institution-levels), 0 regressions |
| `pnpm --filter api build` | 0 TypeScript errors, 296 files — CLEAN |
| `pnpm --filter web test` | 176/176 passed (17 files) — CLEAN |
| `pnpm --filter web lint` | 0 errors, 0 warnings — CLEAN |

## Backend findings (from verify-report-backend) — CONFIRMED CLOSED in a fix-batch

- **C1** — `UpdateSubjectCompetencyUC` duplicate-name guard added (idempotent: own name allowed; sibling conflict → `ValidationError`). CLOSED.
- **W1** — POST duplicate name → HTTP 400 (was 409). CLOSED.
- **W2** — PATCH differentiates: duplicate → 400, not-found → 404 (no blanket 422). CLOSED.
- **W3** — `CreateSubjectAssignmentUC` isolates AutoCreate failure (fire-and-forget, un-awaited + caught). CLOSED.
- **W4** — Isolation test added (`subject-assignment.use-cases.test.ts`, 2 scenarios). CLOSED.

## Front-end (competency-frontend spec) — FULLY CONFORMANT

- Two previously-dead routes (`/subjects/:id/competencies`, `/students/:id/competency-valuations`) removed; zero references in `web/src/`.
- Plan→Course→Subject drill-down via `GET /study-plans` + `GET /study-plans/:id` (inline `subjects[].id = studyPlanSubjectId`); loading/empty/error + cascade resets covered.
- Copy-from-another-course dialog → `POST /subject-competencies/copy` → shows copied/skipped, refreshes list.
- No `periodActive` references in web.

## Fase-3 boundary — CLEAN

`CompetencyValuation` structurally untouched: no `courseCycleId`, `@@unique([studentId, competencyId])` unchanged, no GradeScale fields, Fase-3 marker comment present.

## Suggestions (non-blocking)

- **S1** — Migration generated CREATE TABLE instead of TRUNCATE+ALTER (tables never previously existed). Schema outcome identical. No functional impact.
- **S2** — `PlanCourseSubjectSelector.handlePlanChange()` swallows `GET /study-plans/:id` errors silently (no user feedback). UX improvement; spec does not require it.

## Tasks: 24/24 complete (PR1 T1.1–T1.8, PR2 T2.1–T2.7, PR3 T3.1–T3.4, Fix-batch C1+W1–W4, PR4 T4.1–T4.5).
