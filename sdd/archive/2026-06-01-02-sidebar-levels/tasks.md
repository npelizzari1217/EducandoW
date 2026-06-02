# Tasks: Sidebar Reorganization + Level-Based Filtering

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 50–100 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Core Logic Change

- [ ] 1.1 Remove `institutionBaseLevels` variable and fallback ternary in `web/src/components/layout/sidebar.tsx` — `effectiveBaseLevels` = `userBaseLevels` directly
- [ ] 1.2 Update `hasLevels` derivation to use `userBaseLevels.size > 0` (no institution config fallback)

## Phase 2: Test Updates

- [ ] 2.1 Update sidebar test mocks in `web/src/components/layout/__tests__/sidebar.test.tsx` — set `mockUser.levels` instead of relying on `mockLevels` (institution config)
- [ ] 2.2 Add test: empty `user.levels` → no Académico group for non-ROOT
- [ ] 2.3 Add test: ADMIN with empty levels → placeholder visible, no Académico items
- [ ] 2.4 Verify existing test: ROOT sees all 4 sub-headings regardless of levels

## Phase 3: Verification

- [ ] 3.1 Run `pnpm test --filter=web` to verify all sidebar tests pass
- [ ] 3.2 Run `pnpm build --filter=web` to verify no compilation errors
- [ ] 3.3 Manual check: login as ROOT → all 4 level sub-headings visible; login as Initial-only user → only Inicial sub-heading visible
