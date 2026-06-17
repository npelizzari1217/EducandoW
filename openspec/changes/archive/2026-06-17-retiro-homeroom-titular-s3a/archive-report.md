# Archive Report — retiro-homeroom-titular-s3a

**Date**: 2026-06-17
**Branch**: feat/retiro-homeroom-titular-s3a
**Archived to**: `openspec/changes/archive/2026-06-17-retiro-homeroom-titular-s3a/`
**Umbrella change**: retiro-teacher-legacy (ACTIVE — slices remain)
**Verdict at archive**: PASS WITH WARNINGS — 0 CRITICAL · 1 WARNING (ERD WIP hygiene, expected)

---

## Artifact Observation IDs (engram)

| Artifact | Engram ID |
|---|---|
| explore | #1067 |
| proposal | #1068 |
| design | #1071 |
| spec | #1070 |
| tasks | #1072 |
| apply-progress | #1073 |
| verify-report | #1074 |
| archive-report | (this save) |

---

## What Changed

**Migration of `ListTeacherCourseCyclesUseCase` homeroom branch** from the legacy `Teacher.id → CourseCycle.homeroomTeacherId` resolution path to the new model path: `userId → DocenteXCiclo(active=true) → AsignacionCursoXCiclo(rol=TITULAR) → courseCycleId[]`.

### Files touched (9)

| File | Change |
|---|---|
| `packages/domain/src/asignacion-curso-ciclo/repositories/asignacion-curso-x-ciclo-repository.ts` | +`findTitularCourseIdsByUser` port method |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.ts` | +`findTitularCourseIdsByUser` impl (nested filter + Set dedup) |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asignacion-curso-x-ciclo.repository.spec.ts` | NEW — 4 tests (happy path, dedup, empty, where-clause shape) |
| `api/src/application/grading/list-teacher-course-cycles.use-case.ts` | Rewrite homeroom branch; swap constructor −teacherRepo +asignacionRepo |
| `api/src/application/grading/list-teacher-course-cycles.use-case.spec.ts` | Rewrite homeroom tests; remove Teacher/makeTeacher; correct subject constructor |
| `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts` | −`findByHomeroomTeacher` port method |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts` | −`findByHomeroomTeacher` impl |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.spec.ts` | −`findByHomeroomTeacher` test block |
| `api/src/presentation/course-cycle/course-cycle.module.ts` | −Teacher DI; +PrismaAsignacionCursoXCicloRepository direct provider + factory update |

### Commits on branch (4)

- `1cb8f21` — feat(grading): S3a T1–T3 RED+GREEN prisma-asignacion titular method
- `d114e18` — feat(grading): S3a T4–T5 RED+GREEN homeroom branch rewrite + use-case tests
- `d1901fb` — feat(grading): S3a T6–T8 remove findByHomeroomTeacher (port, impl, spec)
- `1ab7012` — feat(grading): S3a T9 update CourseCycleModule DI

---

## What Is Preserved (No Change)

| Item | Status |
|---|---|
| `CourseCycle.homeroomTeacherId` column | PRESERVED — drop is a later slice (S3b) |
| FK `homeroomTeacher Teacher? @relation(onDelete: SetNull)` | PRESERVED |
| `@@index([homeroomTeacherId])` | PRESERVED |
| Subject mode (`ListTeacherCourseCyclesUseCase`) | UNCHANGED |
| Output contract `Array<{cycle: CourseCycle; modality: number\|null}>` | UNCHANGED |
| HTTP contract `GET /course-cycles?teacherUserId=...&role=homeroom` | UNCHANGED |
| Frontend `use-teacher-grading-access.ts` | UNCHANGED |
| Schema migrations | NONE — zero Prisma changes committed |

---

## Verify Gate Results

| Gate | Result |
|---|---|
| `pnpm --filter api test` | PASS 1212/1212 (129 files, 0 regressions) |
| `pnpm --filter api typecheck` | PASS — 11 pre-existing errors, 0 new |
| `pnpm build` | PASS 3/3 tasks |
| `git diff main...HEAD -- '*.prisma'` | PASS (empty — no committed schema changes) |

**Spec requirements**: 15/15 PASS (REQ-01 through REQ-15). REQ-16 is operational (non-code).

**Warning**: WARNING-01 — uncommitted ERD generator WIP in working tree (`generator erd` block in both `schema.prisma` files). This is user WIP, intentionally not committed. A naive `git add .` before PR creation would accidentally stage it. Mitigated: apply used explicit file paths only; archive commit does the same.

---

## Deploy Precondition (R4 — ALTO, operacional)

Before deploying S3a to production, operators MUST verify the **skip-count produced by the Fase 4 backfill script** (`scripts/backfill-asignacion-curso.ts`) per tenant.

A skipped CourseCycle (logged with ⚠️ because `Teacher.userId=null` or no matching `DocenteXCiclo`) will produce **empty homeroom navigation** for that CC after S3a deploy. This is a **silent degradation** (no error), not a code issue.

Action: confirm all ⚠️ skip-count entries per tenant are zero or intentionally accepted before prod rollout.

---

## Remaining Teacher Consumers (after S3a)

After this slice, the only remaining readers/consumers of the `Teacher` table are:

| Consumer | Type | Next slice |
|---|---|---|
| `/teachers` admin CRUD (`TeacherController`, `teachers.tsx`) | Active CRUD feature | S3b |
| `MesaExamen.presidenteId` FK (Restrict) | Schema constraint | S3b |
| `ActaExamen.presidenteId` FK (Restrict) | Schema constraint | S3b |
| `CourseCycle.homeroomTeacherId` column/FK/index | Schema column (not queried) | S3b — drop after `/teachers` + exam boards migrated |

`SubjectAssignment.teacherId` FK and all boletín Teacher reads: already removed in S1 (retiro-evaluaciones-legacy-s1) and S2 (retiro-boletin-docente-s2).

---

## Roadmap Snapshot (umbrella: retiro-teacher-legacy)

| Slice | Status |
|---|---|
| S1 — retiro-evaluaciones-legacy | DONE ✔ (2026-06-16) |
| S2 — retiro-boletin-docente | DONE ✔ (2026-06-17) |
| **S3a — retiro-homeroom-titular** | **DONE ✔ (2026-06-17 — this archive)** |
| S3b — drop homeroomTeacherId + /teachers + MesaExamen/ActaExamen | PENDING — requires Decisions #2/#3 |
| S3-pre — migrate Inicial/Terciario grading off NotaTrimestral | PENDING — requires Decision #1 |
| S4 — drop SubjectAssignment + archival Evaluacion/NotaTrimestral | PENDING — requires S3-pre + S3b + all decisions |

---

## Canonical Spec Merges (performed during archive)

| Spec file | Change |
|---|---|
| `openspec/specs/teacher-identity-authz/spec.md` | TIA-R5 and TIA-S5 superseded: homeroom now resolves via TITULAR (not homeroomTeacherId) |
| `openspec/specs/asignacion-curso-ciclo/spec.md` | Added ACC-R6 and ACC-S9/S10: `findTitularCourseIdsByUser` homeroom navigation port method |
