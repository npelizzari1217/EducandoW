# Archive Report — asistencia-reporting-result

**Archived:** 2026-08-04 · **Verdict:** PASS (0 CRITICAL, 1 WARNING pre-existing/unrelated, 1 SUGGESTION).
**Épico:** application-error-handling. **CONSUMER slice** (follow-up #2). **Nivel pedagógico:** N/A.

## What shipped

Pure `throw` → `Result` migration of the `asistencia-reporting` + `reportes` area: **28 throws across
4 use-cases** became `err(...)`. No behavior change of substance — HTTP status preserved for every
code; error bodies migrate to the app-standard `{ error: { status, code, message } }` envelope with
`code` preserved (Option B).

- `GenerateAsistenciaMensualPdfUseCase` (12 throws), `GenerateBoletinUseCase` (7),
  `GenerateBoletinBatchUseCase` (2, signature `Promise<Buffer>` → `Promise<Result<Buffer, BoletinError>>`),
  `GenerateConstanciaRegularUseCase` (7) → all return `Result`.
- Controllers `asistencia-reporting.controller.ts` + `reportes.controller.ts`: all 5 endpoints retrofitted
  to `unwrapResultOrThrow`; bespoke try/catch + `instanceof` maps removed; `getBoletinBatch` retrofitted
  from raw `Buffer` (had no test → net-new coverage added).
- **Option B** (ADR-1): 2-line additive fix to `unwrap-result-or-throw.ts` + `exception.filter.ts` so the
  `HttpException` path preserves the machine-readable `code`. Frontend verified shape-tolerant (no regression).
- Legacy duplicate `constancia-controller.test.ts` deleted. Canonical spec consumer entry corrected (ARR-R8).

## Key decision: NO reclassification (deferred to follow-up #3)

The canonical spec previously instructed reclassifying `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`
to `extends ApplicationError`. Exploration proved this **semantically incorrect** — none of the 28 sites is
caller-context/authz (they are NOT_FOUND, intrinsic invariants, and infra guards). So the 3 classes stay
`extends Error`; their correct reclassification (candidate `DomainError` / future `InfrastructureError`, plus
a product decision on `INSTITUTION_NOT_FOUND` 500 and `BATCH_ALL_FAILED` aggregate) is **deferred to a
dedicated follow-up #3**. The canonical entry was corrected to remove the wrong instruction.

## Delivery — 4 stacked PRs

Branch chain from post-#124 `main`: `-a` (Slice A + Option B) → `-b` (boletin) → `-c` (boletin-batch)
→ `-d` (constancia + docs + this archive). 18 commits total. Est. ~800-900 lines.

## Verification (independent, Docker available)

- ARR-R1..R8 all PASS (see `verify-report.md`). `tsc` exit 0; api build clean; `rg "throw new"` on all 4
  use-cases → 0. Option B `code` preservation asserted by helper + filter unit tests.
- `pnpm --filter api test`: 2191/2192 (1 pre-existing unrelated failure `archive-legacy-grading-data.spec.ts`).
- **WARNING (pre-existing, not this change):** `pnpm build` (monorepo) fails on `web#build` due to a hardcoded
  POSIX path in `web/src/pages/dashboard/__tests__/students.test.tsx` — present on `origin/main`, this change
  touches zero `web/` files. Tracked separately.

## Canonical spec sync

Done in Slice D (commit `e24522d`): `application-error-handling/spec.md` consumer entry now reads
`reportes` / `asistencia-reporting` — FULLY MIGRATED (throw → Result) by `asistencia-reporting-result`,
with the `→ApplicationError` blanket instruction removed and reclassification deferred to follow-up #3.

## Follow-ups (épico error-handling)

- **#3a Reclassify the 3 reporting error classes** (`BoletinError`/`ConstanciaError`/`AsistenciaReportingError`)
  — new, surfaced by this change. Needs `InfrastructureError` model + product decision on the 2 ambiguous codes.
- **#3b module queue** — `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
- **Separate tickets** — the 4 pre-existing failing integration `.db.test.ts`; the pre-existing `web#build`
  POSIX-path failure.
