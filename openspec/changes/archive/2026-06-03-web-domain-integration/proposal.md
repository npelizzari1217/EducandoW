# Proposal: Web-Domain Integration

## Intent

The web frontend operates disconnected from `@educandow/domain`. Types are duplicated in `web/src/types/`, API responses lack an adapter layer, and token storage lacks namespacing. This causes silent domain-presentation drift and fragile assumptions. Integrate web with the domain package.

## Scope

Pedagogical level: **ALL**

### In Scope
- Add `@educandow/domain` as a web dependency
- Replace duplicated web types and `constants/levels.ts` with domain imports
- Add API adapter layer (`web/src/api/adapters.ts`)
- Namespace token key: `accessToken` → `educandow:accessToken`
- Remove empty dirs: `contexts/`, `institucional/`, `pedagogico/`, `shared/`
- Reduce `any` warnings below 10

### Out of Scope
- Refresh token rotation, API envelope changes, domain package changes, new features

## Capabilities

### New Capabilities
None

### Modified Capabilities
None

> Pure refactoring. No spec-level behavior changes.

## Approach

1. **Dependency**: Add `@educandow/domain` to `web/package.json` + `tsconfig.json` path
2. **Types**: Replace `web/src/types/` definitions and `constants/levels.ts` with domain imports; add lightweight wrappers where shapes differ
3. **Adapters**: Create `web/src/api/adapters.ts` with `unwrapList`, `unwrapSingle` functions; rewire `use-api.ts` 
4. **Token**: Namespace key with migration fallback (`accessToken` → `educandow:accessToken` on first read)
5. **Cleanup**: Delete empty dirs; fix `any` warnings with domain types

## Affected Areas

| Area | Impact |
|------|--------|
| `web/package.json`, `web/tsconfig.json` | Modified |
| `web/src/types/academic-cycle.ts`, `course-cycle.ts` | Modified (re-exports) |
| `web/src/constants/levels.ts` | Removed |
| `web/src/api/client.ts` | Modified (token namespacing) |
| `web/src/api/adapters.ts` | New |
| `web/src/hooks/use-api.ts`, `useAcademicCycles.ts`, `useCourseCycles.ts` | Modified |
| `web/src/contexts/`, `institucional/`, `pedagogico/`, `shared/` | Removed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Domain types differ from local, causing compile errors | Medium | Audit shape differences; add wrapper adapters |
| Stale domain dist | Low | `pnpm build` in packages/domain first |
| Token migration logs users out on first deploy | Medium | Fallback read from old key, then migrate |
| Component tests break | Low | Update mocks to use domain types; all tests must pass |

## Rollback Plan

`git revert` cleanly undoes all changes. If mixed with other commits, manually: (1) remove domain dependency, (2) restore types/constants from git, (3) revert `use-api.ts` to `res.data.data ?? []`, (4) revert token key. Users re-login.

## Dependencies

- Domain package must build: `pnpm build` in `packages/domain`
- `pnpm install` in root after adding workspace dependency

## Success Criteria

- [ ] `@educandow/domain` in `web/package.json`; `pnpm install` succeeds
- [ ] No duplicated types in `web/src/types/`; `constants/levels.ts` removed
- [ ] `web/src/api/adapters.ts` provides unwrap functions; hooks use them
- [ ] Token key `educandow:accessToken` with migration fallback
- [ ] Empty dirs removed
- [ ] `any` warnings < 10
- [ ] `pnpm lint` passes in `web/`
- [ ] `pnpm test` passes in `web/`
