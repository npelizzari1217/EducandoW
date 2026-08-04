# Tasks: asistencia-reporting-result

> **APPLY WAITS**: implementation of these slices WAITS for PR #124
> (`forbidden-error-reclassification`) to merge to `main` and for this branch to be
> rebased onto post-#124 `main` (proposal decision #3). Do not start Slice A before that.

## Review Workload Forecast

| Slice | Est. diff | 400-budget risk | Chained | Decision before apply |
|---|---|---|---|---|
| A — asistencia-reporting | ~240-310 | Moderate | Yes (base) | No |
| B — boletin | ~175-230 | Low-Mod | Yes (on PR A) | No |
| C — boletin-batch | ~165-210 | Low-Mod | Yes (on PR B) | No |
| D — constancia | ~200-280 | Moderate | Yes (on PR C) | No |
| **Aggregate** | **~800-1030** | **High** | **Yes (4 stacked)** | **No** |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

ADR-1 is RESOLVED = **Option B** (preserve `code`, 2-line additive filter/helper fix, lands in Slice
A). No A-vs-B decision remains open. Delivery = 4 chained/stacked slices A→B→C→D, per user, each
independently green — this matches `delivery_strategy: ask-on-risk`'s bar (decision already made),
so `sdd-apply` may proceed slice-by-slice without re-asking.

### Suggested Work Units

| Unit | Goal | Branch (base) | Notes |
|------|------|----------------|-------|
| A | asistencia-reporting (ARR-R1/2/4/5/6) + Option B shared fix | `refactor/asistencia-reporting-result` (from post-#124 `main`) | Largest slice — shared helper/filter fix lands here |
| B | boletin (ARR-R1/2/4/5/6) | `refactor/asistencia-reporting-result-b` (from `-a`) | Watch `BOLETIN_LEVEL_UNKNOWN` dup (L211/L934) |
| C | boletin-batch (ARR-R1/2/4/5/6) | `refactor/asistencia-reporting-result-c` (from `-b`) | Signature change `Promise<Buffer>`→`Promise<Result<...>>`; net-new controller test |
| D | constancia + docs (ARR-R1/2/4/5/6/8) | `refactor/asistencia-reporting-result-d` (from `-c`) | Delete legacy test; canonical spec correction |

Shared-file note: `reportes.controller.ts` is touched by B/C/D, each editing ONLY its own endpoint
method + its own import line — no cross-slice edits. No error class is reclassified (ARR-R3/R7) —
never edit `extends` on `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`.

---

## Slice A — asistencia-reporting (ARR-R1, R2, R4, R5, R6, R7)

- [x] A.0 Create branch `refactor/asistencia-reporting-result` from post-#124 `main` (rebase if needed)
- [x] A.1 **[RED]** `api/src/presentation/shared/unwrap-result-or-throw.test.ts`: add/adjust test asserting the thrown `HttpException`'s body carries `code` (not just `statusCode`/`message`) for a bare-`Error`-with-`code` input
- [x] A.2 **[RED]** `api/src/presentation/shared/exception.filter.spec.ts`: add/adjust test asserting the `HttpException` branch re-reads `code` from the thrown response object into the final envelope
- [x] A.3 **[GREEN]** `unwrap-result-or-throw.ts`: widen generic bound to admit bare `Error`-with-`code`/`httpStatus`/`message`; branch-2 `HttpException` body → put code under `code` key (`{ statusCode, code: error.code, message: error.message }`) — ARR-R2/R7 Option B, 2-line additive fix
- [x] A.4 **[GREEN]** `exception.filter.ts` `HttpException` branch: add `if (typeof obj.code === 'string') code = obj.code;` — re-reads `code` into final `{ error: { status, code, message } }` envelope
- [x] A.5 `generate-asistencia-mensual-pdf.use-case.ts` L153,185,196: 3 `AsistenciaReportingError` throws (`COURSE_CYCLE_NOT_FOUND`×2, `MATERIA_X_CURSO_X_CICLO_NOT_FOUND`) → `err(...)` in `executeGeneral`/`executeMateria` — ARR-R1
- [x] A.6 Same file L230: `TEMPLATE_NOT_FOUND` throw in `render` → `err(...)`; `render` signature → `Promise<Result<Buffer, PdfError | AsistenciaReportingError>>` — ARR-R1/R4
- [x] A.7 Same file L313,318,323,334,342,347,352: 7 `ForbiddenError` throws in `checkDoor2General`/`checkDoor2Materia` → `err(...)`; both helpers → `Promise<Result<void, ForbiddenError | AsistenciaReportingError>>` — ARR-R1/R4
- [x] A.8 Same file L359: `tenantClient()` L356-362 → sync `Result<TenantPrismaClient, AsistenciaReportingError>` (was throwing); propagate at both call sites (L147/179) and inside `checkDoor2*` (L307/328) via `isErr()`/`unwrap()` — ARR-R1/R4
- [x] A.9 `executeGeneral`/`executeMateria` final signatures → `Promise<Result<Buffer, PdfError | AsistenciaReportingError | ForbiddenError>>`; wire the Door-2 auth-gate `check.isErr()` guard at L143-145/L175-177 — ARR-R4
- [x] A.10 `asistencia-reporting.controller.ts`: delete `handleError()` (L118-131) + both try/catch blocks; `printGeneral`/`printMateria` → `unwrapResultOrThrow(await this.generateUC.execute*(...))`; remove now-unused `ForbiddenException`/`ForbiddenError`/`AsistenciaReportingError` imports if unreferenced — ARR-R5
- [x] A.11 Rewrite `generate-asistencia-mensual-pdf.use-case.test.ts` (general) + `.materia.test.ts`: all `.rejects.toBeInstanceOf(...)` → `isErr()`/`unwrapErr()`; success paths → `.unwrap()` where a raw buffer was read — ARR-R6
- [x] A.12 Rewrite `asistencia-reporting.controller.test.ts` identity cases: `AsistenciaReportingError` maps (general L59-67, materia L127-134) → `mockResolvedValue(err(...))` + assert `.rejects.toBeInstanceOf(HttpException)` status 404 + `getResponse().code === 'COURSE_CYCLE_NOT_FOUND'`; `ForbiddenError` map (L75-81) → `err(new ForbiddenError(...))` + `.rejects.toBeInstanceOf(ForbiddenError)` (403); "rethrows unknown errors" (L83-90) → `err(boom)` form — ARR-R6
- [x] A.13 Commit: `refactor(http): widen unwrapResultOrThrow bound, preserve error code (Option B)`
- [x] A.14 Commit: `refactor(asistencia-reporting): return Result from generate-asistencia-mensual-pdf (12 throws)`
- [x] A.15 Commit: `refactor(asistencia-reporting): consume Result in controller, drop handleError/try-catch`
- [x] A.16 Commit: `test(asistencia-reporting): migrate helper/filter/use-case/controller tests to Result`
- [x] A.17 **Verify**: `pnpm --filter api typecheck` green; `pnpm --filter api test` green; `rg "throw new" api/src/application/asistencia-reporting/generate-asistencia-mensual-pdf.use-case.ts` → 0; diff budget check (~240-310, Moderate)

---

## Slice B — boletin (ARR-R1, R2, R4, R5, R6)

- [x] B.0 Create branch `refactor/asistencia-reporting-result-b` from `refactor/asistencia-reporting-result`
- [x] B.1 `generate-boletin.use-case.ts` L129,132,148,166: 4 `BoletinError` throws (`AXCC_NOT_FOUND`, `STUDENT_NOT_PRINTABLE`, `COURSE_CYCLE_NOT_FOUND`, `STUDENT_NOT_FOUND`) in `execute` → `err(...)` — ARR-R1
- [x] B.2 Same file L934: `getBaseLevel(levelCode)` → `Result<string, BoletinError>` (was throwing `BOLETIN_LEVEL_UNKNOWN`); L185 caller in `execute` propagates via `isErr()`/`unwrap()` — ARR-R1/R4
- [x] B.3 Same file L211: separate `BOLETIN_LEVEL_UNKNOWN` guard (missing `.hbs` template for a known level) → `err(...)` — distinct site from B.2's L934, do NOT double-convert — ARR-R1
- [x] B.4 Same file L892-896: `tenantClient()` → sync `Result<TenantPrismaClient, BoletinError>` (was throwing `INTERNAL_ERROR`); L122 caller propagates — ARR-R1/R4
- [x] B.5 `execute` signature → `Promise<Result<Buffer, PdfError | BoletinError>>` — ARR-R4
- [x] B.6 `reportes.controller.ts#getBoletin` (L30-56): delete try/catch + `instanceof BoletinError` map → `unwrapResultOrThrow(await this.singleUC.execute(...))`; keep `BoletinError` import (still used by batch endpoint until Slice C) — ARR-R5
- [x] B.7 Rewrite `generate-boletin.use-case.test.ts`: all `.rejects.toBeInstanceOf(BoletinError)` → `isErr()`/`unwrapErr()`; success → `.unwrap()` — ARR-R6
- [x] B.8 Verify `generate-boletin.{inicial,terciario,docente-s2}.test.ts` compile against new `execute`/`getBaseLevel` signatures — CORRECTION: each file DOES have one `execute()`-level test (T12-INI/TER/PRI/SEC) asserting `STUDENT_NOT_PRINTABLE` via `.rejects.toThrowError`, not just private-builder calls as assumed; all 4 rewritten to `isErr()`/`unwrapErr()` alongside the private-builder tests (untouched) — ARR-R6
- [x] B.9 Rewrite `reportes.controller.test.ts` L68-76 (`getBoletin` maps thrown `BoletinError`): `mockResolvedValue(err(new BoletinError('no encontrado','AXCC_NOT_FOUND',404)))` + `.rejects.toBeInstanceOf(HttpException)` status 404 + `getResponse().code === 'AXCC_NOT_FOUND'` — ARR-R6
- [x] B.10 Commit: `refactor(reportes): return Result from generate-boletin (7 throws)`
- [x] B.11 Commit: `refactor(reportes): consume boletin Result in getBoletin`
- [x] B.12 Commit: `test(reportes): migrate boletin use-case + controller tests to Result`
- [x] B.13 **Verify**: `pnpm --filter api typecheck` green; `pnpm --filter api test` green (Slice A stays green); `rg "throw new" api/src/application/reportes/generate-boletin.use-case.ts` → 0; diff budget check (~175-230, Low-Mod) — actual: 154 changed lines, within budget

---

## Slice C — boletin-batch (ARR-R1, R2, R4, R5, R6)

- [ ] C.0 Create branch `refactor/asistencia-reporting-result-c` from `refactor/asistencia-reporting-result-b`
- [ ] C.1 `generate-boletin-batch.use-case.ts` L31 (`tenantClient()` L148 `INTERNAL_ERROR`): convert to sync `Result<TenantPrismaClient, BoletinError>`, propagate via `isErr()`/`unwrap()` at the L31 call site — ARR-R1/R4
- [ ] C.2 Same file L109-113: `BATCH_ALL_FAILED` throw → `err(...)` — ARR-R1
- [ ] C.3 Same file L57 (empty-ZIP) and L126 (final): wrap success returns in `ok(...)`; per-row try/catch loop (L74-105) stays unchanged (already consumes `Result` via `isErr()`/`continue`) — ARR-R4
- [ ] C.4 `execute` signature → `Promise<Result<Buffer, BoletinError>>` (was `Promise<Buffer>`) — ARR-R4
- [ ] C.5 `reportes.controller.ts#getBoletinBatch` (L63-88): delete try/catch + `instanceof BoletinError` map → `unwrapResultOrThrow(await this.batchUC.execute(...))` — ARR-R5
- [ ] C.6 Rewrite `generate-boletin-batch.use-case.test.ts` (~11 tests): success/empty-ZIP → `isOk()`/`.unwrap()`; `BATCH_ALL_FAILED` → `isErr()`/`unwrapErr()` — ARR-R6
- [ ] C.7 **NET-NEW** `reportes.controller.test.ts`: add `getBoletinBatch` coverage — success (`ok(Buffer)` → `res.set`/`res.send`, no error), empty ZIP (`ok(emptyBuffer)` → 200), `BATCH_ALL_FAILED` (`err(...)` → `.rejects.toBeInstanceOf(HttpException)` 422 + `code === 'BATCH_ALL_FAILED'`), `INTERNAL_ERROR`/no-tenant (`err(...)` → 500) — ARR-R6
- [ ] C.8 Commit: `refactor(reportes): Result-return generate-boletin-batch (Promise<Buffer> -> Result)`
- [ ] C.9 Commit: `refactor(reportes): retrofit getBoletinBatch to unwrapResultOrThrow`
- [ ] C.10 Commit: `test(reportes): migrate batch tests + add net-new getBoletinBatch controller test`
- [ ] C.11 **Verify**: `pnpm --filter api typecheck` green (confirms `Promise<Result<Buffer, BoletinError>>` signature); `pnpm --filter api test` green (Slices A/B stay green); `rg "throw new" api/src/application/reportes/generate-boletin-batch.use-case.ts` → 0; diff budget check (~165-210, Low-Mod). Docker available but no `.db.test.ts` exists for this module — unit + tsc suffice; run integration only if a test file actually exercises these controllers via DB.

---

## Slice D — constancia + docs (ARR-R1, R2, R4, R5, R6, R8)

- [ ] D.0 Create branch `refactor/asistencia-reporting-result-d` from `refactor/asistencia-reporting-result-c`
- [ ] D.1 `generate-constancia-regular.use-case.ts` L93 (inline tenant guard): `INTERNAL_ERROR` throw → `err(...)` — ARR-R1
- [ ] D.2 Same file L101,113,120,133,149,188: 6 more `ConstanciaError` throws (`AXCC_NOT_FOUND`, `STUDENT_NOT_FOUND`, `STUDENT_NOT_ELIGIBLE`, `COURSE_CYCLE_NOT_FOUND`, `INSTITUTION_NOT_FOUND`, `TEMPLATE_NOT_FOUND`) → `err(...)` — status/class unchanged even for the 2 ambiguous codes (deferred to follow-up #3) — ARR-R1/R7
- [ ] D.3 `execute` signature → `Promise<Result<Buffer, PdfError | ConstanciaError>>`; final `generatePdf(html)` passthrough unchanged — ARR-R4
- [ ] D.4 `reportes.controller.ts#createConstanciaRegular` (L95-122): delete try/catch + `instanceof ConstanciaError` map → `unwrapResultOrThrow(await this.constanciaUC.execute(...))` — ARR-R5
- [ ] D.5 Final import sweep: remove now-unreferenced `BoletinError`/`ConstanciaError` imports from `reportes.controller.ts` (verify no `instanceof` remains across all 3 endpoints) — ARR-R5
- [ ] D.6 Rewrite `generate-constancia-regular.use-case.test.ts` (~13 tests): all 7 `.rejects.toBeInstanceOf(ConstanciaError)` → `isErr()`/`unwrapErr()`; success → `.unwrap()` — ARR-R6
- [ ] D.7 Rewrite `reportes.controller.test.ts` L107-115 (`createConstanciaRegular` maps thrown `ConstanciaError`): `mockResolvedValue(err(new ConstanciaError('no elegible','STUDENT_NOT_ELIGIBLE',422)))` + `.rejects.toBeInstanceOf(HttpException)` 422 + `code === 'STUDENT_NOT_ELIGIBLE'` — ARR-R6
- [ ] D.8 **DELETE** `api/src/presentation/reportes/__tests__/constancia-controller.test.ts` (149 lines) — legacy duplicate asserting the old flat body; coverage subsumed by rewritten `reportes.controller.test.ts` — ARR-R6
- [ ] D.9 Edit `openspec/specs/application-error-handling/spec.md` L206-210: remove the blanket "migrate `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` to `extends ApplicationError`" instruction; record pure `throw`→`Result` conversion with 3 classes unchanged; reference follow-up #3 for their classification — ARR-R8
- [ ] D.10 Commit: `refactor(reportes): return Result from generate-constancia-regular (7 throws)`
- [ ] D.11 Commit: `refactor(reportes): consume constancia Result, remove dead BoletinError/ConstanciaError imports`
- [ ] D.12 Commit: `test(reportes): migrate constancia tests, delete legacy constancia-controller.test.ts`
- [ ] D.13 Commit: `docs(spec): correct application-error-handling consumer entry (ARR-R8)`
- [ ] D.14 **Verify**: `pnpm --filter api typecheck` green; `pnpm --filter api test` green (Slices A/B/C stay green); `rg "throw new" api/src/application/reportes/generate-constancia-regular.use-case.ts` → 0; `constancia-controller.test.ts` absent; diff budget check (~200-280, Moderate)

---

## Definition of Done

- ARR-R1: `rg "throw new" api/src/application/{asistencia-reporting,reportes}/generate-*.use-case.ts` → 0 across all 4 files.
- ARR-R2: HTTP status unchanged for all 28 sites; response body is the standard `{ error: { status, code, message } }` envelope with `code` and `message` preserved (Option B helper/filter fix verified by A.1/A.2 tests).
- ARR-R3/R7: `git diff` shows no `extends` change on `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`; no `InfrastructureError`; no `attendance-type-pdf` file touched; no HTTP status literal changed.
- ARR-R4: `pnpm --filter api typecheck` green after every slice; `GenerateBoletinBatchUseCase.execute` is `Promise<Result<Buffer, BoletinError>>`.
- ARR-R5: both controllers have 0 bespoke try/catch; all 5 endpoints use `unwrapResultOrThrow`; `ForbiddenError` still 403.
- ARR-R6: 0 `toThrow`/`rejects.toBeInstanceOf(<XError>)` remain on the 4 use-cases; `constancia-controller.test.ts` deleted; net-new `getBoletinBatch` controller test present.
- ARR-R8: canonical `application-error-handling/spec.md` consumer entry corrected, references follow-up #3.
- Global: `pnpm test` green; `pnpm build` green; `pnpm --filter api typecheck` green.

---

## Traceability

ARR-R1 → A.5-A.9, B.1-B.4, C.1-C.2, D.1-D.2. ARR-R2/R7 (Option B) → A.1-A.4 (shared fix). ARR-R3
(no reclassification) → guardrail across all slices, never a task target. ARR-R4 (signature
widening) → A.6/A.7/A.9, B.2/B.5, C.4, D.3. ARR-R5 (controller idiom) → A.10, B.6, C.5, D.4/D.5.
ARR-R6 (test rewrite + legacy delete + net-new) → A.11/A.12, B.7-B.9, C.6/C.7, D.6-D.8. ARR-R7
(scope boundary) → guardrail, verified at each slice verification. ARR-R8 (canonical correction) →
D.9. Slice independence/base → A.0/A.17, B.0/B.13, C.0/C.11, D.0/D.14.
