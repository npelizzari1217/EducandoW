# Design: Final Audit Cleanup

## Technical Approach

Five independent work streams: (1) replace `any` with `unknown`/proper types across 10 API files (29 warnings), (2) fix 2 unused-var errors, (3) add migration archive README, (4) implement SimpleEventBus in domain, (5) verify with `pnpm lint && pnpm test && pnpm build`.

## Architecture Decisions

### Decision: `any` → `unknown` for catch clauses (scripts + institution UC)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep `any` | Lint warns, no runtime difference | ❌ |
| `unknown` + guard | Exact same runtime, lint passes | ✅ |
| Typed error class | Over-engineering for scripts | ❌ |

**Rationale**: Scripts already guard with `?.stderr`/`?.message`/`?.code`. Switching to `unknown` + narrowing changes nothing — lint already detects the guards are safe.

### Decision: `any` → `Record<string, boolean>` for profileToModuleAccess

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `as any` index access | Quick, warned | ❌ |
| `Record<string, boolean>` | Index signature safe, no cast | ✅ |
| `keyof ProfilePermissionRow` | Verbose array creation | ❌ |

**Rationale**: `ProfilePermissionRow` already exported with `canRead: boolean`, etc. Adding `[key: string]: boolean` index signature allows `ACTION_MAP` keys to access without cast.

### Decision: SimpleEventBus — in-memory, domain layer

| Option | Tradeoff | Decision |
|--------|----------|----------|
| In-memory Map-based | Zero deps, testable, synchronous | ✅ |
| EventEmitter2/NestJS | Overkill, ties to framework | ❌ |
| Remove interface | Loses future capability | ❌ |

**Rationale**: The interface already exists. Implementing a minimal version costs ~30 lines, enables future domain events, and satisfies the contract.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/scripts/create-tenant-db.ts` | Modify | 3x `catch(error: any)` → `unknown` |
| `api/scripts/diagnose-auth.ts` | Modify | 2x `catch(err: any)` → `unknown` |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | Modify | 3x `any` → proper types (updateData, planRef level/modality) |
| `api/src/application/profiles/use-cases/profiles.use-cases.ts` | Modify | 2x `as any` → index signature on `ProfilePermissionRow` |
| `api/src/application/users/use-cases/users.use-cases.ts` | Modify | 11x `any` → `number` (level/modality), Prisma types (createData), `ProfilePermissionRow[]` |
| `api/src/application/institution/use-cases/institution.use-cases.ts` | Modify | 1x `catch(error: any)` → `unknown` + `prefer-const` fix |
| `api/src/infrastructure/.../prisma-academic-cycle.repository.ts` | Modify | 2x `as any` → typed Prisma input types |
| `api/src/infrastructure/.../prisma-course-cycle.repository.ts` | Modify | 1x `as any` → proper type |
| `api/src/presentation/institution/institution.controller.ts` | Modify | 1x `body as any` → use `CreateInstitutionDTO` |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | Modify | 3x `c: any` → `AcademicCycle` type |
| `api/test/integration/evaluaciones.test.ts` | Modify | Remove 2 unused imports |
| `api/prisma/migrations_archive/README.md` | Create | Historical notes on grades, refresh_tokens.role, cross-schema FKs |
| `packages/domain/src/shared/simple-event-bus.ts` | Create | Map-based EventBus implementation |
| `packages/domain/src/shared/__tests__/simple-event-bus.test.ts` | Create | Unit tests for publish/subscribe/isolation |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Domain unit | EventBus publish, subscribe, multi-handler, error isolation | Vitest, `packages/domain/` |
| API integration | Existing tests must pass — no logic changed | `pnpm test --filter api` |
| Web | Already clean — verify no regression | `pnpm test --filter web` |

## Migration / Rollout

No migration required. All changes are type-only or additive. Rollback = revert commit.
