# Archive Report — retiro-teachers-admin-s3b2

> Phase: sdd-archive · Store: hybrid · 2026-06-17
> S3b-2 del retiro de Teacher — retirar el CRUD admin `/teachers`.
> Branch: feat/retiro-teachers-admin-s3b2

---

## Change Summary

Retired the `/teachers` REST CRUD and its React page (`teachers.tsx`), completing Decision #3
of the Teacher legacy retirement roadmap. Docente persona management is now served exclusively
by `/users` + `/docentes-x-ciclo` (Decision #3, resolved 2026-06-17).

**Verify verdict:** PASS — 0 CRITICAL / 0 WARNING / 1 SUGGESTION (see below).

---

## What Was Removed

### API (7 files deleted)

| File | Path |
|------|------|
| `teacher.controller.ts` | `api/src/presentation/teacher/teacher.controller.ts` |
| `teacher.module.ts` | `api/src/presentation/teacher/teacher.module.ts` |
| `create-teacher.dto.ts` | `api/src/presentation/teacher/dto/create-teacher.dto.ts` |
| `update-teacher.dto.ts` | `api/src/presentation/teacher/dto/update-teacher.dto.ts` |
| `teacher.use-cases.ts` | `api/src/application/teacher/use-cases/teacher.use-cases.ts` |
| `prisma-teacher.repository.ts` | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts` |
| `prisma-teacher.repository.spec.ts` | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.spec.ts` |

Directories `api/src/presentation/teacher/` and `api/src/application/teacher/` removed (were empty after deletion).

### API (1 file edited)

- `api/src/app.module.ts` — removed `TeacherModule` import and `imports[]` entry.

### Web (1 file deleted)

- `web/src/pages/dashboard/teachers.tsx`

### Web (3 files edited)

- `web/src/App.tsx` — removed `TeachersPage` import + `/teachers` Route.
- `web/src/components/layout/sidebar.tsx` — removed "Docentes" → `/teachers` nav entry.
- `web/src/components/layout/__tests__/sidebar.test.tsx` — updated stale assertions to assert
  `Docentes` is NOT in the document.

**Total diff**: 12 files changed, 661 deletions, 0 additions (git diff main --stat).

---

## What Was Kept (intentionally)

| Item | Location | Reason |
|------|----------|--------|
| Prisma `Teacher` model | `api/prisma_tenant/schema.prisma` | FK target for MesaExamen/ActaExamen/SubjectAssignment |
| Domain `Teacher` entity | `packages/domain/src/personnel/entities/teacher.ts` | Dead code, build-safe; cleanup deferred to S3b-final |
| `TeacherRepository` interface | `packages/domain/src/personnel/repositories/teacher-repository.ts` | Dead code, build-safe; cleanup deferred to S3b-final |
| `TEACHERS` permission record | master DB (data, not code) | Guards `GET /docentes-x-ciclo` (`@Roles({ module: 'TEACHERS', action: 'READ' })`) |
| MesaExamen/ActaExamen FKs | `api/prisma_tenant/schema.prisma` | `presidenteId → Teacher` FK Restrict — migrated in S3b-3 |
| `SubjectAssignment.teacherId` | `api/prisma_tenant/schema.prisma` | Cascade gate — blocked until S3-pre / Decision #1 |

No schema migration was generated or applied.

---

## Verify Result

**PASS — 0 CRITICAL / 0 WARNING / 1 SUGGESTION**

| Check | Result |
|-------|--------|
| CHECK 1 — /teachers CRUD removed (REQ-1, REQ-2, REQ-3) | PASS |
| CHECK 2 — No dangling DI / imports (REQ-2, REQ-6, REQ-9) | PASS |
| CHECK 3 — KEEP confirmed: schema, domain entity, TEACHERS permission (REQ-4, REQ-5, REQ-6) | PASS |
| CHECK 4 — FK consumers intact (REQ-4) | PASS |
| CHECK 5 — No functional regression (REQ-7, REQ-9) | PASS |
| CHECK 6 — Dangling sweep ZERO (REQ-2, REQ-3) | PASS |

**Test results:**

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| `pnpm --filter api test` | 126 | 1198 | GREEN |
| `pnpm --filter web test` | 37 | 394 | GREEN |
| `pnpm build` (turbo) | 3/3 pkgs | — | EXIT 0 |
| `pnpm --filter api typecheck` | — | — | 11 errors (all pre-existing baseline) |

### SUGGESTION (deferred, non-blocking)

`web/src/pages/dashboard/dashboard.tsx` has a static `<Card title="Docentes">` with copy
"Registro y asignación de docentes a materias y cursos." — it no longer navigates anywhere
(the `/teachers` route was removed). Left as-is intentionally: updating static dashboard copy
is cosmetic, not a spec requirement, and will be revisited in S3b-final or a dedicated UX pass.

---

## R-GAP Window (accepted)

After S3b-2, no code path creates new `Teacher` table rows (the sole creator,
`CreateTeacherUseCase`, was removed). Creating a `MesaExamen` or `ActaExamen` with a
`presidenteId` that has no existing `Teacher` row will be rejected by Postgres (FK Restrict).

- **Affected:** new docentes created via `/users` after S3b-2 deploy, when acting as `presidente`.
- **Not affected:** existing `Teacher` rows (all work normally as `presidenteId`).
- **Closes in:** S3b-3, which migrates `presidenteId` FK → User/DocenteXCiclo + backfill.

---

## Commits on Branch

| Hash | Message |
|------|---------|
| `3e86b68` | `feat(api): remove teacher admin CRUD slice (S3b-2)` |
| `43adf4a` | `feat(web): remove teachers admin page and sidebar entry (S3b-2)` |
| `96493fd` | `test(web): update sidebar tests — remove stale Docentes assertions (S3b-2)` |

---

## Canonical Spec Updated

Delta merged into: `openspec/specs/teacher-identity-authz/spec.md`
New requirement added: **TIA-R10** — `/teachers` admin CRUD retired; docente persona management
via `/users` + `/docentes-x-ciclo`.

---

## Engram Observation IDs (traceability)

| Artifact | Observation ID |
|----------|---------------|
| explore | #1098 |
| proposal | #1099 |
| spec | #1100 |
| design | #1102 |
| tasks | #1104 |
| apply-progress | #1107 |
| verify-report | #1110 |
| archive-report | (saved after this file) |

---

## Remaining Roadmap (Teacher Legacy Retirement)

Umbrella: `openspec/changes/retiro-teacher-legacy/explore.md` (ACTIVE)

| Step | Status | Description |
|------|--------|-------------|
| S1 (`retiro-evaluaciones-legacy-s1`) | DONE ✔ 2026-06-16 | Retired SubjectAssignment CRUD UI |
| S2 (`retiro-boletin-docente-s2`) | DONE ✔ 2026-06-17 | Migrated boletín docente name from Teacher → DocenteXCiclo/User |
| S3a (`retiro-homeroom-titular-s3a`) | DONE ✔ 2026-06-17 | Migrated homeroom branch to AsignacionCursoXCiclo(TITULAR) |
| S3b-0 (`retiro-homeroom-column-s3b0`) | DONE ✔ 2026-06-17 | Dropped `homeroomTeacherId` column |
| S3b-1 (`retiro-sala-grado-curso-teacher-s3b1`) | DONE ✔ 2026-06-17 | Dropped `Sala/Grado/Curso.teacherId` columns (Approach A) |
| **S3b-2** (`retiro-teachers-admin-s3b2`) | **DONE ✔ 2026-06-17** | **Retired `/teachers` admin CRUD — this change** |
| S3b-3 | NEXT | Migrate `MesaExamen/ActaExamen.presidenteId` FK → User + backfill (closes R-GAP) |
| S3-pre | PENDING | Migrate grading Inicial/Terciario out of NotaTrimestral (Decision #1 pending) |
| S3b-final | PENDING | Drop `Teacher` table + domain entity + repo (after all consumers resolved) |

**Remaining Teacher consumers:**
- `MesaExamen.presidenteId` / `ActaExamen.presidenteId` — FK Restrict → Teacher (S3b-3)
- `SubjectAssignment.teacherId` — FK Cascade gate, blocked until S3-pre / Decision #1

**R-GAP window is OPEN** — no new Teacher rows can be created until S3b-3 deploys.
