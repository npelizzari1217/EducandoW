# Proposal: Final Audit Cleanup

## Intent

Resolve 5 remaining issues from the project audit: eliminate `any` type warnings in the API package (29 across 9 files — web is already clean), document archived migrations that created now-removed tables/columns, document cross-schema foreign keys, and implement the unused `EventBus` interface in domain.

## Scope

### In Scope
- Replace all `any` types in `api/` with proper types or `unknown` (9 files, 29 warnings)
- Add README to `prisma/migrations_archive/` explaining historical context of `grades` table and `refresh_tokens.role` column
- Add documentation note about cross-schema FKs in archived init migration
- Implement `SimpleEventBus` in `packages/domain/src/shared/` (Map-based in-memory, for future domain events)
- Fix 2 unrelated lint errors (`DeleteNotaUC` unused vars in test file)

### Out of Scope
- Web package `any` cleanup — already at zero warnings, verified with `pnpm --filter web lint`
- Schema changes or new DB migrations
- Production event bus (RabbitMQ, Kafka)
- Refactoring existing code to use the new EventBus (future work)

## Capabilities

### New Capabilities
- `event-bus`: In-memory domain event bus with publish/subscribe semantics, stored in domain layer. Uses Map<string, Set<EventHandler>> for handler registry.

### Modified Capabilities
None. Type cleanup and migration documentation are implementation-level changes that do not alter spec-level behavior.

## Approach

**Type cleanup**: Replace `any` with inferred types, `unknown` for catch clauses, and proper generic typing. Files affected: 4 application use-case files, 2 repository files, 2 controller files, 2 scripts. No logic changes.

**Migration docs**: Add a `README.md` inside `prisma/migrations_archive/` with structured notes explaining: (1) `grades` table was superseded by `notas` + `evaluaciones`, (2) `refresh_tokens.role` was added then silently removed, (3) init migration created cross-schema FKs to `institutions` that are now replicated per-tenant.

**EventBus**: Create `SimpleEventBus` class implementing the existing `EventBus` interface. Handler errors are caught and logged — one handler failure does not block others.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/application/**/*.use-cases.ts` | Modified | Replace `any` with proper types |
| `api/src/infrastructure/**/*.repository.ts` | Modified | Replace `any` with proper types |
| `api/src/presentation/**/*.controller.ts` | Modified | Replace `any` with proper types |
| `api/scripts/` | Modified | Replace `any` in two scripts |
| `api/prisma/migrations_archive/` | New file | Add `README.md` with historical notes |
| `packages/domain/src/shared/` | New file | `simple-event-bus.ts` with implementation and tests |
| `web/` | None | Already clean (verified with `pnpm lint`) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Type narrowing breaks inference | Low | Only replace `any` with tighter types; `pnpm build` catches issues |
| Migration README becomes stale | Low | Archive is append-only; README is informational only |
| EventBus unused after implementation | Med | Acceptable — enables future domain events without breaking interface contract |

## Rollback Plan

Revert the commit. All changes are additive (new README, new file) or type-only (no logic). No DB migrations, no schema changes.

## Dependencies

None. No external services, no new packages.

## Success Criteria

- [ ] `pnpm lint` passes with 0 `any` warnings in api (currently 29)
- [ ] `pnpm lint` passes with 0 errors total (currently 2 unused-var errors)
- [ ] `pnpm test` passes all suites (domain, api, web)
- [ ] `pnpm build` succeeds for all packages
- [ ] `prisma/migrations_archive/README.md` exists with structured notes
- [ ] `packages/domain/src/shared/simple-event-bus.ts` exists with tests
