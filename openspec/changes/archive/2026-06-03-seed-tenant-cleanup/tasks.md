# Tasks: Seed Tenant Cleanup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~20 (deletion + 3 comments) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Removal

- [x] 1.1 Delete `api/prisma/seed-tenant-data.ts`

## Phase 2: Archive Warnings

- [x] 2.1 Add db push deprecation warning to `openspec/changes/archive/2026-06-02-curso-por-ciclo/archive-report.md`
- [x] 2.2 Add db push deprecation warning to `openspec/changes/archive/2026-05-26-06-planes-de-estudio/tasks.md`
- [x] 2.3 Add db push deprecation warning to `openspec/changes/archive/2026-05-26-06-planes-de-estudio/design.md`

## Phase 3: Verification

- [x] 3.1 Run `pnpm test` — all 976 tests pass (domain 602 + api 284 + web 90)
- [ ] 3.2 Verify `seed-tenant.ts` runs twice without crash (idempotency check) — requires running DB; manual verification step
- [x] 3.3 grep archive files confirm warning present — 3/3 files have warning
