# Tasks: retiro-teachers-admin-s3b2

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> Delivery: auto-chain · Single PR (AD-7) · Pure deletion — Strict TDD adapted

---

## Execution Model

This change is a pure vertical slice deletion. No new behavior = no test-first required.
Strict TDD adapted: acceptance is verified by green suite + clean typecheck + confirmed
absences. A typecheck gate between the API and web batches prevents compounding errors.

```
T1 ──┐
T2 ──┘→ T3 (typecheck gate) → T4 ──┐
                                T5 ──┤──> T7 ──┐
                                T6 ──┘    T8 ──┴──> T9 (build)
                                          T10 (sweep + domain confirm)
```

T4, T5, T6 are parallel after T3.
T7, T8, T10 are parallel after T4 + T5 + T6.
T9 is sequential after T7 + T8.

---

## Batch 1 — API slice deletion

### T1 — Delete 7 API source files + remove empty directory

**Requires:** nothing  
**Satisfies:** REQ-2 (SC-2.2), REQ-9 (SC-9.1 prerequisite), AD-1, AD-6  
**Parallel with:** T2  

Files to delete (all confirmed present):

| File | Absolute path |
|---|---|
| teacher.controller.ts | `api/src/presentation/teacher/teacher.controller.ts` |
| teacher.module.ts | `api/src/presentation/teacher/teacher.module.ts` |
| create-teacher.dto.ts | `api/src/presentation/teacher/dto/create-teacher.dto.ts` |
| update-teacher.dto.ts | `api/src/presentation/teacher/dto/update-teacher.dto.ts` |
| teacher.use-cases.ts | `api/src/application/teacher/use-cases/teacher.use-cases.ts` |
| prisma-teacher.repository.ts | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts` |
| prisma-teacher.repository.spec.ts | `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.spec.ts` |

After deleting the 4 files under `api/src/presentation/teacher/`, also remove the now-empty
directory `api/src/presentation/teacher/` (including the `dto/` subdirectory).

Note: `api/src/application/teacher/` directory may also be empty after deleting
`teacher.use-cases.ts` — remove it if so.

DO NOT touch: domain `Teacher` entity, `TeacherRepository` interface, Prisma schema, any
file under `packages/`, `api/src/infrastructure/persistence/prisma/repositories/` other
than the two prisma-teacher files listed above.

---

### T2 — Edit app.module.ts: remove TeacherModule

**Requires:** nothing (safe to run parallel with T1)  
**Satisfies:** REQ-2 (SC-2.1), REQ-1 (SC-1.1–SC-1.5), AD-2  
**Parallel with:** T1  

File: `api/src/app.module.ts`

Two removals (design confirmed line numbers — verify before editing):
1. Import line: `import { TeacherModule } from './presentation/teacher/teacher.module';` (design L8)
2. Array entry: `TeacherModule,` inside the `imports[]` array (design L48)

No other file in the DI graph imports `TeacherModule` (AD-2 — grep confirmed).
After this edit, `TeacherModule`, its `'TeacherRepository'` token, and all five use-case
factories disappear from the NestJS DI tree atomically.

---

### T3 — Gate: API typecheck

**Requires:** T1 + T2 complete  
**Satisfies:** REQ-2 (SC-2.3), REQ-6 (SC-6.1), REQ-9 (SC-9.1)  
**Sequential**  

Command:
```
pnpm --filter api typecheck
```

Acceptance:
- Exit code 0
- Zero new TypeScript errors (baseline: 11 pre-existing errors are acceptable if unchanged)
- Domain `Teacher` entity and `TeacherRepository` interface MUST NOT produce new errors

If this gate fails, STOP. Do not proceed to web slice. Diagnose residual imports in
`app.module.ts` or any file that was not deleted.

---

## Batch 2 — Web slice deletion (all parallel after T3)

### T4 — Delete teachers.tsx page

**Requires:** T3  
**Satisfies:** REQ-3 (SC-3.1), AD-5  
**Parallel with:** T5, T6  

File to delete: `web/src/pages/dashboard/teachers.tsx`

If `web/src/pages/dashboard/` becomes empty after deletion, remove it. Otherwise leave the
directory intact.

---

### T5 — Edit App.tsx: remove TeachersPage import + /teachers route

**Requires:** T3  
**Satisfies:** REQ-3 (SC-3.2), AD-5  
**Parallel with:** T4, T6  

File: `web/src/App.tsx`

Two removals (design confirmed line numbers — verify before editing):
1. Import line L20: `import TeachersPage from './pages/dashboard/teachers';` (or similar)
2. Route line L66: `<Route path="/teachers" element={<TeachersPage />} />` (or similar)

Do not alter any other route or import.

---

### T6 — Edit sidebar.tsx: remove Docentes → /teachers entry

**Requires:** T3  
**Satisfies:** REQ-3 (SC-3.3), AD-5  
**Parallel with:** T4, T5  

File: `web/src/components/layout/sidebar.tsx`

Removal (design confirmed line number — verify before editing):
- Line L38: `{ label: 'Docentes', path: '/teachers', moduleCode: 'TEACHERS', requiresLevel: true }` (or similar object literal)

The `moduleCode: 'TEACHERS'` string is frontend-only display data, independent of the
`TEACHERS` permission record in master DB (which MUST NOT be touched — AD-3).

---

## Batch 3 — Verification gates (after T4 + T5 + T6)

### T7 — API test suite

**Requires:** T4 + T5 + T6  
**Satisfies:** REQ-9 (SC-9.3), AD-6  
**Parallel with:** T8, T10  

Command:
```
pnpm --filter api test
```

Acceptance:
- Exit 0
- All tests pass
- ~6 pre-existing Pool-mock warnings are EXPECTED and are not failures — do not treat
  them as regressions
- `prisma-teacher.repository.spec.ts` no longer appears in the run (it was deleted in T1)
- Coverage MUST remain ≥ 80%

---

### T8 — Web test suite

**Requires:** T4 + T5 + T6  
**Satisfies:** REQ-9 (SC-9.3)  
**Parallel with:** T7, T10  

Command:
```
pnpm --filter web test
```

Acceptance:
- Exit 0
- All tests pass; no test references the deleted `teachers.tsx`

---

### T10 — Dangling sweep + domain presence confirmation

**Requires:** T4 + T5 + T6  
**Satisfies:** REQ-2 (SC-2.2), REQ-3 (SC-3.1–SC-3.3), REQ-6 (SC-6.1), REQ-4 (SC-4.2)  
**Parallel with:** T7, T8  

#### Step 10a — Dangling reference sweep

Run each pattern below across `api/src/` and `web/src/`. Expect ZERO matches.

```
rg "TeacherController" api/src web/src
rg "TeacherModule" api/src web/src
rg "PrismaTeacherRepository" api/src web/src
rg "TeachersPage" api/src web/src
rg "path=\"/teachers\"" web/src
rg "path='/teachers'" web/src
```

Note on false-positive exclusions:
- The string `'TEACHERS'` in `docente-ciclo.controller.ts` is the permission module code —
  NOT a TeacherModule reference. It MUST remain and is not a match for these patterns.
- Domain entity `Teacher` / interface `TeacherRepository` in `packages/domain/` are
  intentionally retained dead code — they are also NOT matched by these patterns.

Any match → treat as a blocker before T9.

#### Step 10b — Domain dead code confirmation

Verify these files still exist and are untouched:

```
rg -l "class Teacher" packages/
rg -l "TeacherRepository" packages/
```

At least one result per command MUST appear. If absent, a required keep-file was
accidentally deleted in T1 — STOP and restore before proceeding.

---

### T9 — Full monorepo build

**Requires:** T7 + T8 (T10 should also be green, but is non-blocking for build)  
**Satisfies:** REQ-9 (SC-9.2)  
**Sequential (final gate)**  

Command:
```
pnpm build
```

Acceptance:
- Exit 0 for every workspace (`api`, `web`, `packages/*`)
- Zero new build errors

---

## Preserved invariants (apply must NOT change these)

| Item | Location | Reason |
|---|---|---|
| `Teacher` Prisma model | `api/prisma_tenant/schema.prisma` | FK target for MesaExamen / ActaExamen / SubjectAssignment |
| No new migration | `api/prisma_tenant/migrations/` | REQ-4 (SC-4.1) — schema unchanged |
| `TEACHERS` permission record | master DB (data, not code) | Guards `/docentes-x-ciclo` (AD-3, REQ-5) |
| Domain `Teacher` entity | `packages/domain/.../personnel/entities/teacher.ts` | Dead code, build-safe, cleanup deferred to S3b-final (AD-4) |
| `TeacherRepository` interface | `packages/domain/.../personnel/repositories/` | Same — deferred (AD-4) |
| `/users` endpoints | `api/src/presentation/user/` | REQ-7 (SC-7.1) — must not be touched |
| `/docentes-x-ciclo` endpoint | `api/src/presentation/docente-ciclo/` | REQ-7 (SC-7.2), REQ-5 — must not be touched |

---

## R-GAP notice (REQ-8)

After S3b-2 deploys, no code path creates new `Teacher` rows. Existing rows work as
`presidenteId` FK. New docentes (created via `/users` post-deploy) cannot yet act as
`presidente` — Postgres FK will reject. This is ACCEPTED until S3b-3. Document in the
PR description.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~350–400 (all deletions; 7 deleted files + 3 small edits) |
| 400-line budget risk | Low (pure deletions; trivial to review) |
| Chained PRs recommended | No |
| Decision needed before apply | No |

---

## Summary Checklist

- [x] T1 — 7 API files deleted; empty directories removed
- [x] T2 — `app.module.ts` cleaned (import + imports[] entry removed)
- [x] T3 — `pnpm --filter api typecheck` exits 0 (gate) — 11 errors, all pre-existing baseline
- [x] T4 — `web/src/pages/dashboard/teachers.tsx` deleted
- [x] T5 — `App.tsx` import + route removed
- [x] T6 — `sidebar.tsx` Docentes entry removed
- [x] T7 — `pnpm --filter api test` green — 126 files, 1198 tests passed
- [x] T8 — `pnpm --filter web test` green — 37 files, 394 tests passed (3 stale sidebar assertions fixed)
- [x] T10 — dangling sweep ZERO matches; domain Teacher entity + TeacherRepository confirmed present
- [x] T9 — `pnpm build` exits 0 — 3/3 packages built successfully
