# Tasks: reporting-errors-reclassification

> **Domain-dist gotcha (read before every slice):** vitest aliases `@educandow/domain` to SOURCE (no
> rebuild needed for tests), but `tsc --noEmit` / `pnpm build` resolve through `node_modules` to the
> BUILT dist. **Sequence per slice, no exceptions:**
> `pnpm --filter @educandow/domain build` → `pnpm --filter api typecheck` → `pnpm --filter api test`
> → `pnpm --filter api lint`. Skipping the domain build after touching `packages/domain` gives a
> false RED on typecheck (or worse, a stale false GREEN).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Slice 0 ~300 / Slice 1 ~150 / Slice 2 ~250 / Slice 3 ~180 — total ~880 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Slice 0 → Slice 1 → Slice 2 → Slice 3 (stacked) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Delivery already decided by proposal/design (proposal §Delivery, design §8): 4 slices stacked on
`main`, each compiles green independently, each with its own PR. No further chain-strategy decision
needed before `sdd-apply` starts Slice 0.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 0 | Shared additive layer: 8 DomainError subclasses, `InstitutionNotFoundError`, `unwrapResultOrThrow` branch, 8 `DOMAIN_STATUS` entries | PR 1 (base `main`) | Zero call sites touched, zero behavior change |
| 1 | Migrate AsistenciaReporting (5 sites), delete `AsistenciaReportingError` | PR 2 (base PR 1) | Cleanest module, proves pattern |
| 2 | Migrate Boletin + batch (9 sites), delete `BoletinError` | PR 3 (base PR 2) | Two-module class, biggest slice |
| 3 | Migrate Constancia (7 sites), delete `ConstanciaError`, final RER-R5 grep guard, canonical spec sync | PR 4 (base PR 3) | Closes the change |

## Definition of Done

- RER-R1..R8 all satisfied (traced per task below).
- `pnpm --filter @educandow/domain build` + `pnpm --filter api typecheck` + `pnpm --filter api test`
  + `pnpm --filter api lint` green after every slice, coverage ≥ 80%.
- `BoletinError`, `ConstanciaError`, `AsistenciaReportingError` no longer exist anywhere (grep = 0 hits).
- Every one of the 11 codes has a dedicated instanceof + code + status test.
- Tenant `INTERNAL_ERROR` → `TENANT_CLIENT_UNAVAILABLE` is the ONLY wire-`code` change; all other 8
  codes and all HTTP statuses/body shapes are byte-identical to pre-change behavior.

---

## Slice 0 — Shared additive layer (~300 lines) — PR 1, base `main`

Traces: RER-R1, RER-R2, RER-R3, RER-R4, RER-R7, RER-R8.

- [x] 0.1 RED — `packages/domain/src/reportes/errors/index.test.ts`: instanceof `DomainError` + `code`
      assertion for each of the 8 new classes (design §2, §7.1).
- [x] 0.2 GREEN — Create `packages/domain/src/reportes/errors/index.ts` with the 8 subclasses, exact
      code per design §2 (`AxccNotFoundError`, `ReporteStudentNotFoundError`,
      `ReporteCourseCycleNotFoundError`, `MateriaXCursoXCicloNotFoundError`, `StudentNotPrintableError`,
      `StudentNotEligibleError`, `BoletinLevelUnknownError`, `BatchAllFailedError`).
- [x] 0.3 Create barrel `packages/domain/src/reportes/index.ts` re-exporting the 8 classes (design §2).
- [x] 0.4 Edit `packages/domain/src/index.ts` — add the package-root re-export block from `./reportes`
      near line 8 (design §2).
- [x] 0.5 `pnpm --filter @educandow/domain build` (mandatory before any typecheck below).
- [x] 0.6 RED — `api/src/application/shared/errors/__tests__/infrastructure-errors.test.ts`: add
      `InstitutionNotFoundError` case — instanceof `InfrastructureError`, `code === 'INSTITUTION_NOT_FOUND'`,
      `httpStatus === 500` (design §3, §7.1).
- [x] 0.7 GREEN — Append `InstitutionNotFoundError` to
      `api/src/application/shared/errors/infrastructure-errors.ts` (design §3 exact code).
- [x] 0.8 RED — Table-driven test in `exception.filter.spec` (or dedicated file): for each of the 8
      new codes, build the instance, run through `AppExceptionFilter`, assert 404/422, NEVER 400
      (design §7.2). [RER-R2 regression guard]
- [x] 0.9 GREEN — Add the 8 entries to `DOMAIN_STATUS` in
      `api/src/presentation/shared/filters/exception.filter.ts` (design §4 exact block, before closing `}`).
- [x] 0.10 RED — `api/src/presentation/shared/http/__tests__/unwrap-result-or-throw.test.ts`: (a)
      `err(new AxccNotFoundError('x'))` → throws that exact instance, `instanceof DomainError`,
      identity-preserving; (b) bare `PdfError`-shaped error still hits the generic `HttpException`
      fallback with correct status/code; (c) a caller typed `Result<T, DomainError | PdfError>`
      type-checks (design §7.3). [RER-R4, RER-R8]
- [x] 0.11 GREEN — Edit `api/src/presentation/shared/http/unwrap-result-or-throw.ts`: add
      `instanceof DomainError` branch (after `InfrastructureError`, before fallback), relax generic
      bound to `httpStatus?: number`, fallback `error.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR`,
      update the doc-comment to drop the stale `BoletinError`/`ConstanciaError`/`AsistenciaReportingError`
      mention (design §5 exact before/after).
- [x] 0.12 Verify: `pnpm --filter @educandow/domain build` → `pnpm --filter api typecheck` →
      `pnpm --filter api test` → `pnpm --filter api lint`, all green, coverage ≥ 80%. Confirm `git diff`
      touches zero files under `application/reportes` / `application/asistencia-reporting` (additive-only,
      zero behavior change — design §8).
- [x] 0.13 Commit (one work unit): `feat(errors): add reporting DomainError subclasses, InstitutionNotFoundError, and unwrapResultOrThrow DomainError branch`

## Slice 1 — AsistenciaReporting (~150 lines) — PR 2, base PR 1

Traces: RER-R1, RER-R3, RER-R5, RER-R6, RER-R8.

- [ ] 1.1 RED — Update `generate-asistencia-mensual-pdf.use-case` test suite: re-derive
      `.toBeInstanceOf(AsistenciaReportingError)` asserts to the new concrete classes per site (design §6.4);
      add the tenant guard assertion for `code === 'TENANT_CLIENT_UNAVAILABLE'` at 500.
- [ ] 1.2 GREEN — In `generate-asistencia-mensual-pdf.use-case.ts`, swap the 5 call sites (L161, L198,
      L209, L243 `render`, L386 `tenantClient`) per design §6.4 exact mapping; update imports (drop
      `AsistenciaReportingError`, add `ReporteCourseCycleNotFoundError` + `MateriaXCursoXCicloNotFoundError`
      from `@educandow/domain`, `TemplateNotFoundError` + `TenantClientUnavailableError` from
      `../shared/errors/infrastructure-errors`).
- [ ] 1.3 Widen return-type unions per design §6.4: `executeGeneral`/`executeMateria`, `render`,
      `tenantClient`, `checkDoor2General`/`checkDoor2Materia`.
- [ ] 1.4 Delete `asistencia-reporting.errors.ts` (single-module, last reference now gone).
- [ ] 1.5 Update `asistencia-reporting.controller` test(s) for the tenant wire-code delta
      (`INTERNAL_ERROR` → `TENANT_CLIENT_UNAVAILABLE`) — RER-R3 is the ONLY code-string change in this slice.
- [ ] 1.6 Verify: domain build (no-op, unchanged since Slice 0) → `pnpm --filter api typecheck` →
      `pnpm --filter api test` → `pnpm --filter api lint`. Grep confirms zero remaining references to
      `AsistenciaReportingError` in the tree.
- [ ] 1.7 Commit: `refactor(asistencia-reporting): reclassify errors to DomainError/InfrastructureError subclasses`

## Slice 2 — Boletin + batch (~250 lines) — PR 3, base PR 2

Traces: RER-R1, RER-R3, RER-R5, RER-R6, RER-R8.

- [ ] 2.1 RED — Update `generate-boletin.use-case` test suite: re-derive `.toBeInstanceOf(BoletinError)`
      asserts for the 7 sites (design §6.1) to the new concrete classes; tenant guard asserts
      `TENANT_CLIENT_UNAVAILABLE`/500.
- [ ] 2.2 GREEN — In `generate-boletin.use-case.ts`, swap L131, L134, L150, L168, L215, L898
      (`tenantClient`), L938 (`getBaseLevel`) per design §6.1; widen `execute`/`getBaseLevel`/`tenantClient`
      return unions; update imports.
- [ ] 2.3 RED — Update `generate-boletin-batch.use-case` test suite for L113 `BATCH_ALL_FAILED` and L152
      `tenantClient` (design §6.2).
- [ ] 2.4 GREEN — In `generate-boletin-batch.use-case.ts`, swap L113 and L152 per design §6.2; update
      L8 import (drop `BoletinError`, add `BatchAllFailedError` from `@educandow/domain`,
      `TenantClientUnavailableError` from infra); widen `execute`/`tenantClient` return unions.
- [ ] 2.5 Delete inline `BoletinError` class (L37-46 of `generate-boletin.use-case.ts`) — only now that
      BOTH `generate-boletin.use-case.ts` and `generate-boletin-batch.use-case.ts` are migrated.
- [ ] 2.6 Update `reportes.controller` tests covering boletin + batch endpoints for the tenant wire-code
      delta and any status assertions touched by the reclassification.
- [ ] 2.7 Verify: `pnpm --filter api typecheck` → `pnpm --filter api test` → `pnpm --filter api lint`.
      Grep confirms zero remaining references to `BoletinError`.
- [ ] 2.8 Commit: `refactor(boletin): reclassify errors to DomainError/InfrastructureError subclasses`

## Slice 3 — Constancia + close-out (~180 lines) — PR 4, base PR 3

Traces: RER-R1, RER-R3, RER-R5, RER-R6, RER-R7, RER-R8.

- [ ] 3.1 RED — Update `generate-constancia-regular.use-case` test suite: re-derive
      `.toBeInstanceOf(ConstanciaError)` asserts for the 7 sites (design §6.3); tenant guard asserts
      `TENANT_CLIENT_UNAVAILABLE`/500; `InstitutionNotFoundError` instanceof `InfrastructureError`.
- [ ] 3.2 GREEN — In `generate-constancia-regular.use-case.ts`, swap L97, L105, L117, L124, L137, L153,
      L192 per design §6.3 (verify `TemplateNotFoundError('constancia-regular.hbs')` message is byte-identical
      to the old string per design §6.3 footnote); update L13 import (domain subclasses from
      `@educandow/domain`, `TenantClientUnavailableError`/`InstitutionNotFoundError`/`TemplateNotFoundError`
      from `../shared/errors/infrastructure-errors`); widen `execute` return union.
- [ ] 3.3 Delete `ConstanciaError` class from `templates/constancia.template.ts` (L33-42), single-module,
      last reference now gone.
- [ ] 3.4 Update `reportes.controller` constancia tests for the tenant wire-code delta.
- [ ] 3.5 RER-R5 final grep guard (test or CI check): 0 hits for `BoletinError`, `ConstanciaError`,
      `AsistenciaReportingError` across the entire tree (production + tests).
- [ ] 3.6 Canonical spec sync — edit `openspec/specs/application-error-handling/spec.md`: update the
      `reportes / asistencia-reporting` follow-up entry (currently lines 239-251) from "DEFERRED to
      follow-up #3" to FULLY DONE, listing the 8 `DomainError` + `InstitutionNotFoundError` classes and
      the tenant wire-code fix; update the "InfrastructureError tier" follow-up line (currently line 295)
      to mark the reporting consumer as closed.
- [ ] 3.7 Verify: `pnpm --filter api typecheck` → `pnpm --filter api test` → `pnpm --filter api lint`,
      coverage ≥ 80%. Full-tree grep guard (3.5) green.
- [ ] 3.8 Commit: `refactor(constancia): reclassify errors to DomainError/InfrastructureError subclasses` +
      `docs(sdd): sync application-error-handling canonical spec for reporting-errors-reclassification`
