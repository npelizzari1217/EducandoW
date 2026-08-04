# Archive Report — infrastructure-error-model

**Archived:** 2026-08-04 · **Verdict:** PASS (0 CRITICAL, 0 WARNING, 1 SUGGESTION non-blocking).
**Épico:** application-error-handling. **Prerequisite for follow-up #3a.** **Nivel pedagógico:** N/A.

## What shipped

Modeled the **3rd tier of the layered error model** — `InfrastructureError` — and piloted it on the 3 sites
that were already waiting for it. Completes `DomainError → ApplicationError → InfrastructureError → Presentation`.

- **Base**: `abstract class InfrastructureError extends Error` (`api/src/application/shared/errors/infrastructure-error.ts`),
  `httpStatus` fixed field = 500 (unoverridable), required `code`.
- **Subclasses**: `TenantClientUnavailableError` (`TENANT_CLIENT_UNAVAILABLE`), `TemplateNotFoundError`
  (`TEMPLATE_NOT_FOUND`) in `infrastructure-errors.ts`.
- **Wiring**: `AppExceptionFilter` branch (→500/code/message, after ApplicationError) + dedicated
  identity-preserving re-throw branch in `unwrapResultOrThrow`.
- **Pilots** (guards flipped from bare `throw` to `return err(...)`, all already 500, now gain `code`):
  1. `update-grupo.use-case.ts` — tenant-client guard → `err(TenantClientUnavailableError)` (lifts the prior
     documented "must stay a throw" MGCM-R6 deferral).
  2. `competency.use-cases.ts` (`AutoCreate...UC`) — `execute` `Promise<void>` → `Result<void, ...>`, getter
     inlined, all 5 exit paths → `ok(undefined)`; **its fire-and-forget caller in `course-cycle.use-cases.ts`
     updated** to log on the resolved `Result`'s `isErr()` while keeping `.catch` for real rejections (the
     load-bearing edit).
  3. `generate-attendance-types-pdf.use-case.ts` — template guard → `err(TemplateNotFoundError)` (also fixes a
     genuine type-mismatch: a `throw` inside a `Result`-declared method).

## Delivery — 2 stacked PRs

`feat/infrastructure-error-model` (PR1, base+wiring, purely additive) → `feat/infrastructure-error-model-pilots`
(PR2, 3 pilots). 18 commits. Code ~260-330 lines.

## Verification (independent, Docker available)

- IEM-R1..R9 all PASS (see `verify-report.md`). `tsc` + api `build` green. Pilot 2's 5 exit paths + caller
  `.then/.catch` audited against real code.
- `pnpm --filter api test`: 2205/2206 (1 pre-existing unrelated failure).
- PR1 verified purely additive (nothing consumed InfrastructureError until PR2).

## Canonical spec sync

Updated `openspec/specs/application-error-handling/spec.md`:
- Added an **`InfrastructureError` tier** requirement (base + filter/unwrap wiring + concrete classes + 2 scenarios).
- Marked the 3 previously-deferred infra guards (update-grupo, competency, generate-attendance-types-pdf) as DONE.
- Replaced the "not yet modeled" follow-up bullet with "MODELED + piloted (2026-08-04)".

## Follow-ups

- **`reporting-errors-reclassification` (#3a)** — the direct consumer: uses `InfrastructureError` for its 5 infra
  guards (TEMPLATE_NOT_FOUND ×2, tenant INTERNAL_ERROR ×3), plus `DomainError` subclasses for NOT_FOUND/invariants.
  Its exploration is already done (`openspec/changes/reporting-errors-reclassification/explore.md`).
- **Naming**: the reporting follow-up must decide whether to reuse `TENANT_CLIENT_UNAVAILABLE`/`TEMPLATE_NOT_FOUND`
  or keep its legacy `INTERNAL_ERROR` wire code (behavior-preserving) for its own guards.
- **Pre-existing debt** (surfaced, out of scope): repo lint red on `subject-group-filter.db.test.ts` +
  `guardians.test.ts`; `web#build` POSIX path (chip `task_4ee23ff8`); 4 integration `.db.test.ts`;
  `archive-legacy-grading-data.spec.ts` Windows path.
