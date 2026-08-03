# Tasks: forbidden-error-reclassification

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (Option A) |
| Delivery strategy | ask-on-risk |
| Decision needed before apply | No |
| Review focus | the 3 widening files: `nota-cursada-terciario.use-cases.ts`, `docente-materia.use-cases.ts`, `student.use-cases.ts` |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Classification test (RED) + new `ForbiddenError` class (GREEN) | PR 1 (single) | TDD anchor — genuine RED→GREEN |
| 2 | Split-import 17 production consumers | PR 1 (single) | Old domain export still present but unused after this |
| 3 | Widen 7 use-case signatures (3 files) | PR 1 (single) | Required — step 2 breaks these without it |
| 4 | Delete domain file + barrel export | PR 1 (single) | Nothing imports it anymore |
| 5 | Delete `DOMAIN_STATUS['FORBIDDEN']` dead entry | PR 1 (single) | Depends on Unit 1-4 landing (filter never reads it) |
| 6 | Split-import 16 existing test files | PR 1 (single) | Import-path only, no assertion rewrites |
| 7 | Verification gate | PR 1 (single) | Closing unit — tsc + tests + greps |

This is **ONE atomic PR** (Option A, per proposal). There is no intermediate `tsc`-green state between Units 1-4 — only the final state must compile (design §5). Refactor-style TDD applies to Units 2-6: existing tests + `tsc --noEmit` are the safety net; behavior stays green throughout. Only Unit 1's classification test is genuine RED→GREEN.

---

## Phase 1: Classification Test (RED) + New Class (GREEN) — FER-R1, FER-R2, FER-R8

- [x] 1.1 Write `api/src/application/shared/errors/__tests__/forbidden-error.test.ts` — mirrors `authorization-errors.test.ts`; asserts `instanceof ApplicationError` true, `instanceof DomainError` false, `code === 'FORBIDDEN'`, `httpStatus === 403`, default message `'Forbidden'`, and a custom-message variant (design §6.1). **RED**: fails to resolve — `../forbidden-error` does not exist yet (FER-R8)
- [x] 1.2 Create `api/src/application/shared/errors/forbidden-error.ts` — `export class ForbiddenError extends ApplicationError { constructor(message = 'Forbidden') { super(message, 'FORBIDDEN', 403); } }` (design §1.1). Additive only — old domain class still exists, tree stays green. Run 1.1's test → **GREEN** (FER-R1, FER-R2)

## Phase 2: Split-Import — 17 Production Consumers — FER-R2, FER-R4

Mechanical transform per consumer (design §2.1): drop `ForbiddenError` from the `@educandow/domain` import block, add `import { ForbiddenError } from '<relative-path>';` at the depth in the table below. `instanceof ForbiddenError` checks are untouched beyond the import line.

- [x] 2.1 `api/src/application/asistencia/record-subject-attendance-day.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.2 `api/src/application/asistencia/record-general-attendance-day.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.3 `api/src/application/asistencia/list-subject-attendance.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.4 `api/src/application/asistencia/list-general-attendance.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.5 `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.6 `api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` — import `../shared/errors/forbidden-error`; **7 literal `throw new ForbiddenError(...)` sites stay throws, no Result conversion** (FER-R2, FER-R6)
- [x] 2.7 `api/src/presentation/asistencia-reporting/asistencia-reporting.controller.ts` — import `../../application/shared/errors/forbidden-error`; `handleError()`'s `instanceof ForbiddenError` check untouched beyond the import (FER-R2, FER-R4)
- [x] 2.8 `api/src/application/asignacion-curso/assign-docente-to-curso.use-case.ts` — import `../shared/errors/forbidden-error`; **literal `throw`, bare `Promise<T>` return stays unchanged** (FER-R2, FER-R6)
- [x] 2.9 `api/src/application/grading/upsert-subject-period-grades.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.10 `api/src/application/grading/upsert-subject-final-grades.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.11 `api/src/application/institution/use-cases/institution.use-cases.ts` — import `../../shared/errors/forbidden-error` (FER-R2)
- [x] 2.12 `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` — import `../../shared/errors/forbidden-error` (widening in Phase 3) (FER-R2)
- [x] 2.13 `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts` — import `../../shared/errors/forbidden-error` (widening in Phase 3) (FER-R2)
- [x] 2.14 `api/src/application/student-observation/create-observation.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.15 `api/src/application/student-observation/delete-observation.use-case.ts` — import `../shared/errors/forbidden-error` (FER-R2)
- [x] 2.16 `api/src/application/student/use-cases/student.use-cases.ts` — import `../../shared/errors/forbidden-error` (widening in Phase 3) (FER-R2)
- [x] 2.17 `api/src/presentation/student/student.controller.ts` — import `../../application/shared/errors/forbidden-error`; `throwGuardianError()`'s `instanceof ForbiddenError` check untouched beyond the import (FER-R2, FER-R4)

## Phase 3: Widen 7 Signatures — FER-R5 (review focus)

Required because after Phase 2, `ForbiddenError` no longer satisfies the bare `DomainError` generic. Widen to explicit union — **no `any`, no `as` cast**.

- [x] 3.1 `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts` — `CreateNotaCursadaSlotUC.execute` (L57): `Promise<Result<NotaCursadaTerciario, DomainError>>` → `Promise<Result<NotaCursadaTerciario, DomainError | ForbiddenError>>` (FER-R5)
- [x] 3.2 same file — `UpdateNotaCursadaSlotUC.execute` (L95): `Promise<Result<NotaCursadaTerciario, DomainError>>` → `Promise<Result<NotaCursadaTerciario, DomainError | ForbiddenError>>` (FER-R5)
- [x] 3.3 same file — `ConfirmarNotaCursadaUC.execute` (L134): `Promise<Result<void, DomainError>>` → `Promise<Result<void, DomainError | ForbiddenError>>` (FER-R5)
- [x] 3.4 `api/src/application/nivel-terciario/use-cases/docente-materia.use-cases.ts` — `AssignDocenteMateriaUC.execute` (L37): `Promise<Result<DocenteXMateriaCarrera, DomainError>>` → `Promise<Result<DocenteXMateriaCarrera, DomainError | ForbiddenError>>` (FER-R5)
- [x] 3.5 same file — `ListAssignmentsUC.execute` (L77): `Promise<Result<DocenteXMateriaCarrera[], DomainError>>` → `Promise<Result<DocenteXMateriaCarrera[], DomainError | ForbiddenError>>` (FER-R5)
- [x] 3.6 same file — `UnassignDocenteMateriaUC.execute` (L103): `Promise<Result<DocenteXMateriaCarrera, DomainError>>` → `Promise<Result<DocenteXMateriaCarrera, DomainError | ForbiddenError>>` (FER-R5). Optional micro-touch (L4 header comment) skipped — kept churn minimal per design §3.2
- [x] 3.7 `api/src/application/student/use-cases/student.use-cases.ts` — `PatchStudentUseCase.execute` (L152 in current file — line drifted by 1 vs design's L151, same method, reconciled by name): `Promise<Result<Student, DomainError>>` → `Promise<Result<Student, DomainError | ForbiddenError>>` (forwards `checkOwnership`'s `Result<void, ForbiddenError>` err; `checkOwnership` L200 and `validateAllowedFields` L227 already type `ForbiddenError` explicitly, confirmed NOT widened, no change needed there) (FER-R5)

## Phase 4: Delete Domain Residue — FER-R1, FER-R9

- [ ] 4.1 Delete `packages/domain/src/shared/errors/forbidden-error.ts` entirely (FER-R1)
- [ ] 4.2 Remove `export { ForbiddenError } from './shared/errors/forbidden-error';` from `packages/domain/src/index.ts:7` (FER-R1). No other file under `packages/domain` is touched (FER-R9)

## Phase 5: Filter Cleanup — FER-R7

- [ ] 5.1 Delete `FORBIDDEN: 403,` (L13) from the `DOMAIN_STATUS` map in `api/src/presentation/shared/filters/exception.filter.ts` — dead code once `ForbiddenError` is `instanceof ApplicationError` (the `ApplicationError` branch at L91 fires before `DomainError`/`DOMAIN_STATUS` at L95); no observable status change (FER-R3, FER-R7)

## Phase 6: Split-Import — 16 Existing Test Files — FER-R2, FER-R8, FER-R9

Same split-import transform as Phase 2, at each test file's relative depth. Assertions (`toBeInstanceOf(ForbiddenError)`, `.rejects.toBeInstanceOf(ForbiddenError)`, `constructor.name === 'ForbiddenError'`) are **unaffected** — only the import line changes, no Result-shape or assertion rewrites (FER-R6 scope boundary applies here too).

- [ ] 6.1 Enumerate the full set before editing: run `rg -l "\bForbiddenError\b" api --glob "**/*.test.ts"` and `rg -l "\bForbiddenError\b" api/test` — reconcile against explore.md's count of 16 (design §6.2)
- [ ] 6.2 Split-import each hit from 6.1, covering (at minimum) the known members: the `nivel-terciario`, `student`, `asistencia`, `grading`, `institution`, `student-observation` use-case test suites, and the `asistencia-reporting.controller` / `student.controller` presentation tests (the `instanceof` handlers) (FER-R2, FER-R8)
- [ ] 6.3 `api/test/unit/patch-student.use-case.test.ts` — **import-path update ONLY**; file stays at its current legacy location, no move/consolidate (FER-R9)
- [ ] 6.4 If any of the above suites boot Prisma/DB (integration/e2e controller tests), note this is a pre-existing property of the suite, not introduced here — flag for the honesty check in Phase 7 rather than skip silently

## Phase 7: Verification Gate — FER-R1..R9

- [ ] 7.1 `pnpm --filter api typecheck` (`tsc --noEmit`) exits 0 — proves all 7 widenings (Phase 3) + 17 import swaps (Phase 2) are complete and consistent (FER-R5)
- [ ] 7.2 `pnpm test` green, including the new classification test (Phase 1.1) asserting the full contract. For any DB-bound suite unavailable in the apply environment: run at minimum the classification test + mocked-repo unit suites + `tsc --noEmit`, and honestly report DB-bound suites as "not executed here, no logic changed" — never report green without having run it (FER-R8, design §6.2)
- [ ] 7.3 Grep — zero domain residue: `rg "\bForbiddenError\b" packages/domain` → 0 hits (FER-R1)
- [ ] 7.4 Grep — single-source import: `rg "ForbiddenError.*@educandow/domain"` and `rg "@educandow/domain.*ForbiddenError"` → 0 hits (FER-R2)
- [ ] 7.5 Grep — no new base classes: confirm the only class added under `api/src/application/shared/errors/` is `ForbiddenError` (moved) (FER-R9)
- [ ] 7.6 Grep — DOMAIN_STATUS cleaned: `rg "FORBIDDEN" api/src/presentation/shared/filters/exception.filter.ts` → 0 hits (FER-R7)
- [ ] 7.7 Inspect diff — `asistencia-reporting` still has 7 literal `throw new ForbiddenError`; `asignacion-curso` still `throw` + bare `Promise<T>` — no throw→Result conversion introduced (FER-R6)
- [ ] 7.8 HTTP 403 invariant — guaranteed structurally by 7.6's branch-order proof + the Phase 1.1 test's `httpStatus === 403`; confirm no runtime status change for any of the 8 modules (asistencia, asistencia-reporting, asignacion-curso, grading, institution, nivel-terciario, student-observation, student) (FER-R3)

---

## Commit Plan (conventional, single atomic PR — work units per design §5)

1. `test(shared-errors): add ForbiddenError classification test` + `refactor(shared-errors): reclassify ForbiddenError as ApplicationError` — Phase 1 (RED→GREEN anchor)
2. `refactor(*): split-import ForbiddenError to local api path across 17 consumers` — Phase 2
3. `refactor(nivel-terciario,student): widen Result signatures to DomainError | ForbiddenError` — Phase 3
4. `refactor(domain): remove ForbiddenError class and barrel export` — Phase 4
5. `refactor(exception-filter): remove dead DOMAIN_STATUS FORBIDDEN entry` — Phase 5
6. `test(*): split-import ForbiddenError to local api path across 16 test files` — Phase 6
7. (no commit — Phase 7 is the verification gate run before push)

---

## Definition of Done

- All requirements FER-R1 through FER-R9 satisfied (traced above per task).
- `pnpm --filter api typecheck` exits 0.
- `pnpm test` green; any DB-bound suite not runnable in the apply environment is honestly flagged, never silently reported green.
- Zero `ForbiddenError` residue under `packages/domain` (file deleted, export removed, both greps in Phase 7.3/7.4 empty).
- No new `ApplicationError` base classes introduced besides the moved `ForbiddenError` (FER-R9).
- `asistencia-reporting` and `asignacion-curso` throw idiom unchanged (FER-R6).
- `api/test/unit/patch-student.use-case.test.ts` stays at its current path (FER-R9).

---

**Persistence note (hybrid):** openspec is the committed source of truth for this artifact. Engram backfill
at `topic_key: sdd/forbidden-error-reclassification/tasks` (type `architecture`, project `educandow`,
`scope: project`, `capture_prompt: false`).
