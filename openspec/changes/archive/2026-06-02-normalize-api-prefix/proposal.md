# Proposal: Normalize API Prefix

## Intent

Fix double API version prefix (`/v1/v1/...`) caused by mixing `app.setGlobalPrefix('v1')` in `main.ts` with hardcoded `v1/` in 13 controller decorators and `/v1/` in 12 frontend API URLs. Error "Cannot POST /v1/profiles" was the symptom — profiles lacked the hardcoded prefix but other controllers had it, creating inconsistent routing. Additionally, `TenantMiddleware.isMasterRoute()` was missing `/profiles`, causing tenant-scope rules to incorrectly apply to profile endpoints.

## Scope

### In Scope
- Remove `v1/` from 13 controller `@Controller()` decorators
- Remove `/v1/` from 12 frontend API URL strings
- Add `/profiles` to `isMasterRoute()` in tenant middleware
- Verify all endpoints work post-fix (231 tests + smoke tests)

### Out of Scope
- Changing the API versioning strategy
- Adding a second API version
- CI/CD pipeline changes

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- **`multi-tenant-routing`**: `isMasterRoute()` now includes `/profiles` — profiles are master-level data (like users/modules), not tenant-scoped.

> Controller and frontend changes are pure implementation fixes. API contracts documented in specs remain unchanged — clients still hit `/v1/profiles`, `/v1/course-cycles`, etc. The fix only changes how the prefix is applied internally.

## Approach

Single-source-of-truth: `app.setGlobalPrefix('v1')` in `main.ts`. All controllers drop the version segment. All frontend API calls use relative paths (axios `baseURL: '/v1'` handles the prefix). Master routes are declared exhaustively in `TenantMiddleware.isMasterRoute()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| 13 API controllers | Modified | Removed `v1/` from `@Controller('v1/...')` decorators |
| 12 frontend files | Modified | Removed `/v1/` from axios/fetch URL strings |
| `tenant.middleware.ts` | Modified | Added `/profiles` to `isMasterRoute()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missed hardcoded prefix in undiscovered controller/frontend file | Low | 231 tests pass + manual endpoint smoke tests |
| Server not restarted after deploy (already occurred — fix committed Jun 1, server ran old code until Jun 2) | Med | Document as deploy requirement; CI/CD should handle restarts |
| Future controllers re-add hardcoded `v1/` | Low | Convention documented; ESLint rule candidate |

## Rollback Plan

1. Revert commit 84929cb
2. Re-add `v1/` to 13 controller decorators and `/v1/` to 12 frontend files
3. Remove `/profiles` from `isMasterRoute()`
4. Restart server

Rollback is low-risk — the original pattern (double prefix) was globally consistent except for profiles.

## Dependencies

None. Server restart required for changes to take effect.

## Success Criteria

- [ ] All 231 tests pass (`pnpm test`)
- [ ] `POST /v1/profiles` returns 201
- [ ] `GET /v1/profiles` returns 200
- [ ] `GET /v1/course-cycles` returns 200 (no double prefix)
- [ ] No `Cannot POST /v1/...` errors in server logs
- [ ] Frontend pages load data without 404s
