# Proposal: Institutions — 25-Field Multi-Tenant

## Intent

Upgrade Institutions from a basic 5-field single-DB implementation to the full 25-field multi-tenant architecture. Exploration found 14/15 architecture rules (R1-R15) have implementation gaps. This change closes them via 5 autonomous feature slices.

## Scope

### In Scope
- 25-field model: identity (10 fields), SMTP (5 + AES-256), branding (4 + hex validation), notifications (send_email, send_messages, socket_host/port), lifecycle (active, db_name)
- Rename `email` → `contact_email`
- Schema split: `schema_master.prisma` (Institution/User/RefreshToken) + `schema_tenant.prisma` (pedagogical, no institutionId)
- PrismaService dynamic factory (`Map<dbName, PrismaClient>`) resolved by JWT
- Tenant DB creation on POST with atomic rollback
- `GET /v1/institutions/me`, `PATCH /v1/institutions/:id`, soft-delete with session rejection
- InstitutionContext, dynamic CSS theming, sidebar level filter, feature flags

### Out of Scope
- Removing `institutionId` from 11 tenant tables (per-module deferred)
- Production data migration, modules 02+

## Capabilities

### New Capabilities
None — all 7 capability specs exist from prior proposal (archived 2026-05-25).

### Modified Capabilities
- `institution-branding`: extend to 25-field model, hex validation
- `institution-lifecycle`: soft-delete + session blocking, PATCH, active query filter
- `institution-notifications`: toggle fields in full model
- `institution-smtp`: AES-256-GCM startup check, 25-field integration
- `multi-tenant-routing`: PrismaService factory, TenantMiddleware, dbName in JWT
- `session-config`: InstitutionContext, GET /me, CSS variables from branding
- `tenant-database`: atomic creation with compensation, CUE uniqueness

## Approach

5 feature slices (exploration-recommended order):

| # | Slice | Scope |
|---|-------|-------|
| 1 | Schema + Domain | 25 fields, entity + VOs, repository, DTOs — additive, no breaking changes |
| 2 | Branding + SMTP + Notifications | HexColor/SmtpConfig VOs, AES-256, ENCRYPTION_KEY check |
| 3 | Multi-Tenant | Schema split, PrismaService factory, TenantMiddleware, dbName in JWT, tenant DB creation |
| 4 | Endpoints /me + Soft-Delete | GET /me, PATCH, active=false, login/session rejection |
| 5 | Frontend | InstitutionContext, 25-field form, dynamic theme, sidebar filter, feature flags |

Slices 1-2 are additive (merge quickly). Slice 3 is the architectural pivot — after domain is stable. Frontend last, consuming existing API.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/prisma/` | Split | `schema_master.prisma` + `schema_tenant.prisma`, PrismaService factory |
| `packages/domain/src/institution/` | Modified + New | Entity (25f), VOs (Cue, HexColor, SmtpConfig, Branding), repository |
| `api/src/presentation/institution/` | Modified | DTOs (25f), controller (+ /me, + PATCH, soft-delete) |
| `api/src/application/institution/` | Modified | Create (tenant DB), get-me, update, soft-delete use cases |
| `api/src/infrastructure/auth/` | Modified | JWT payload (+dbName), TenantMiddleware |
| `web/src/context/` + `pages/` + `layout/` | New + Modified | InstitutionContext, 25-field form, sidebar filter, CSS theming |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Prisma doesn't support dynamic multi-datasource natively | High | Factory with `Map<string, PrismaClient>`, lazy per-request |
| Tenant DB creation leaves inconsistent state | High | Atomic: master write → DB create → migrations. Rollback on catch |
| Singleton migration breaks existing repos | High | Legacy fallback; progressive per-slice migration |
| JWT `dbName` growth | Low | Single string — negligible |

## Rollback Plan

- **Schema**: `git revert` to single schema. Tenant DBs disposable (no production data).
- **PrismaService**: Factory wraps legacy singleton. Feature-flag env var bypass until stable.
- **Endpoints**: New endpoints additive — remove from controller if failing.
- **Frontend**: InstitutionContext returns safe defaults on error — degrades gracefully.

## Dependencies

- PostgreSQL `CREATEDB` privilege, `ENCRYPTION_KEY` (32 bytes), `MASTER_DATABASE_URL`
- Module 00-Auth: JWT already has `institutionId`; needs `dbName` addition

## Success Criteria

- [ ] POST creates tenant DB + migrations atomically → 201
- [ ] GET /me returns full config (branding, flags, levels) from JWT
- [ ] Soft-delete preserves tenant DB, login rejects inactive institutions (403)
- [ ] InstitutionContext loads on login; sidebar filters by `levels[]`
- [ ] `send_email=false` hides email UI; `send_messages=false` skips WebSocket
- [ ] All 15 architecture rules pass verification; coverage ≥ 80%

---

**Level**: ALL | **Status**: Ready for SPEC
