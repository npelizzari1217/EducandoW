# Archive Report: Course Cycle Generate Improvements

**Archived at**: 2026-06-03
**Source**: `openspec/changes/course-cycle-generate-improvements/`
**Destination**: `openspec/changes/archive/2026-06-03-course-cycle-generate-improvements/`

## Summary

Change that improved `POST /v1/course-cycles/generate` from a createMany+skip to a per-course UPSERT, making `studyPlanId` optional, deriving level from plan (removing hardcoded `buildLevel('PRIMARIO')`), and simplifying the frontend by replacing the generation modal with direct filter-based invocation.

## Verification

- **Commits**: 5 commits (a56e138 through e3b1fa3)
- **Tests**: 33 passing (20 backend + 8 frontend + 5 DTO)
- **Tasks**: All 12/12 completed (Phases 1–5)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| course-cycle | Updated | 2 MODIFIED requirements merged into main spec |

### Requirement Changes Merged

| Requirement | Action | Details |
|-------------|--------|---------|
| Bulk Generate CourseCycles | Modified | UPSERT semantics, optional `studyPlanId`, `Level.fromParts`, response `{created, updated, total}` |
| Frontend CRUD Page | Modified | Direct generate button (no modal), `studyPlanId` filter, removed `GenerateCourseCyclesModal` and "Nuevo Curso" button |

### Scenarios Added

| Requirement | Scenario |
|-------------|----------|
| Bulk Generate | Level derived from plan — not hardcoded |
| Bulk Generate | studyPlanId absent — all plans for the level are processed |
| Bulk Generate | studyPlanId absent — no plans found for level |
| Frontend | "Generar Cursos" button disabled without required filters |
| Frontend | "Generar Cursos" submits with required filters only |
| Frontend | "Generar Cursos" submits with all three filters |

### Scenarios Modified

| Requirement | Scenario | Change |
|-------------|----------|--------|
| Bulk Generate | All courses generated — none pre-exist | Response changed: `skipped`→`updated` |
| Bulk Generate | Some courses already exist | Now updates `courseName` instead of skipping silently; `skipped`→`updated` |
| Bulk Generate | AcademicCycle is inactive | Added "or updated" to reflect UPSERT behavior |
| Frontend | "Generar cursos" modal submits successfully | Replaced with two "Generar Cursos" scenarios (mandatory filters only and with all three filters) |

## Archive Contents

| Artifact | Status | Notes |
|----------|--------|-------|
| proposal.md | ✅ | Intent, scope, approach, risks, rollback plan |
| specs/course-cycle/spec.md | ✅ | Delta spec — 2 modified requirements with scenarios |
| design.md | ✅ | 4 ADRs, use case pseudocode, file manifest |
| tasks.md | ✅ | 12/12 tasks completed across 5 phases |
| archive-report.md | ✅ | This file |

## Source of Truth Updated

The following specs now reflect the new behavior:
- `openspec/specs/course-cycle/spec.md`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
