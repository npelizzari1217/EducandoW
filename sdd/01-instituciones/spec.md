# SDD Spec: 01-instituciones

**Change**: Institutions — 25-Field Multi-Tenant  
**Status**: Ready for DESIGN  
**Date**: 2026-06-01  
**Level**: ALL

---

## Overview

This spec covers the delta requirements for the 7 capabilities modified by change `01-instituciones`. Each domain has a dedicated delta file under `openspec/changes/01-instituciones/specs/`. This document is the consolidated reference for the design phase.

Delta files:
- `openspec/changes/01-instituciones/specs/institution-branding/spec.md`
- `openspec/changes/01-instituciones/specs/institution-lifecycle/spec.md`
- `openspec/changes/01-instituciones/specs/institution-notifications/spec.md`
- `openspec/changes/01-instituciones/specs/institution-smtp/spec.md`
- `openspec/changes/01-instituciones/specs/multi-tenant-routing/spec.md`
- `openspec/changes/01-instituciones/specs/session-config/spec.md`
- `openspec/changes/01-instituciones/specs/tenant-database/spec.md`

---

## Architecture Rules Covered

| Rule | Description | Capability |
|------|-------------|-----------|
| R1 | Master DB: only auth + institutions | tenant-database |
| R2 | Tenant DB = 1 institution | tenant-database |
| R3 | No institutionId in tenant tables | tenant-database |
| R4 | JWT carries dbName for tenant routing | multi-tenant-routing |
| R7 | PrismaService = dynamic factory (Map) | multi-tenant-routing |
| R8 | Migrations per tenant | tenant-database |
| R10 | Registration = DB + migrations + admin | tenant-database |
| R11 | Institution in session (/me + InstitutionContext) | session-config |
| R12 | Dynamic CSS theme from branding colors | session-config |
| R13 | Conditional features: send_email, send_messages | institution-notifications, institution-smtp |
| R15 | active=false blocks login + tenant requests | institution-lifecycle, multi-tenant-routing |

---

## Specs Summary

### institution-branding

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | HexColor Value Object | 3 |
| MODIFIED | Branding Field Storage (adds VO enforcement) | 2 |
| MODIFIED | Branding Update (unchanged) | 2 |
| MODIFIED | Branding in Session Config (unchanged) | 2 |

Key change: color fields modelled as `HexColor` VO at domain layer. Rejection happens at entity construction, not only at DTO validation.

---

### institution-lifecycle

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | Extended Identity Fields (contact_email + 8 address fields) | 3 |
| MODIFIED | Create Institution (25-field) | 2 |
| MODIFIED | List Institutions (?active filter) | 4 |
| MODIFIED | Get Institution by ID (25-field response) | 3 |
| MODIFIED | Update Institution (cue restriction for ADMIN) | 6 |
| MODIFIED | Soft-Delete via active=false | 3 |
| MODIFIED | Session Blocked for Inactive | 3 |
| MODIFIED | Active Field in All Responses | 2 |

Key change: `email` → `contact_email` rename; 9 new identity/address fields; ADMIN MUST NOT change `cue`; `?active` query filter on list.

---

### institution-notifications

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | send_email as Notification Feature Flag | 3 |
| ADDED | Notification Fields Exposed via /me (all 4 together) | 1 |
| MODIFIED | Notification Toggle Fields (adds send_email to table) | 2 |
| MODIFIED | send_messages Controls WebSocket | 2 |
| MODIFIED | Notification Fields in Session Config (adds send_email) | 2 |

Key change: `send_email` ownership moves from institution-smtp into institution-notifications as a co-equal flag alongside `send_messages`.

---

### institution-smtp

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | SmtpConfig Value Object | 3 |
| MODIFIED | SMTP Field Storage (adds VO enforcement) | 2 |
| MODIFIED | SMTP Password Encryption Lifecycle (explicit bootstrap gate + key-length check) | 3 |
| MODIFIED | SMTP Conditional Feature Toggle (delegates send_email ownership to notifications) | 2 |

Key change: `SmtpConfig` VO; `ENCRYPTION_KEY` check is a bootstrap gate (before HTTP server binds), not deferred.

---

### multi-tenant-routing

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | TenantMiddleware Active-Status Gate | 3 |
| ADDED | Middleware Route Scoping | 2 |
| MODIFIED | JWT Includes dbName (+ active check at login) | 3 |
| MODIFIED | PrismaService Dynamic Resolution (+ lazy instantiation explicit) | 4 |
| MODIFIED | Master DB Repositories Remain Static | 1 |
| MODIFIED | Tenant Middleware (+ co-gate with active check) | 2 |

Key change: `TenantMiddleware` checks `active` on every request; route scoping is explicit; lazy `PrismaClient` instantiation specified.

---

### session-config

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | Dynamic CSS Theme from Branding Colors | 3 |
| ADDED | Full 25-Field Institution Form | 3 |
| MODIFIED | GET /institutions/me (all 25 fields enumerated) | 2 |
| MODIFIED | InstitutionContext (exposes all 25 fields + CSS theme) | 2 |
| MODIFIED | Active Levels Filter Navigation | 2 |

Key change: `/me` response and context now cover all 25 fields; CSS variables applied on context load; role-gated form sections.

---

### tenant-database

| Type | Requirement | Scenarios |
|------|-------------|-----------|
| ADDED | Cue Value Object | 3 |
| ADDED | Admin User Created on Institution Registration | 2 |
| MODIFIED | Automatic Tenant DB Creation (4-step + rollback on step 4) | 4 |
| MODIFIED | db_name Field | 2 |
| MODIFIED | Master DB Isolation | 1 |
| MODIFIED | Duplicate CUE Prevention (check before DB creation) | 2 |
| MODIFIED | Schema Separation | 2 |

Key change: institution creation is now 4 steps (master record → DB create → migrations → admin user); CUE check MUST happen before any DB creation; `Cue` VO at domain layer.

---

## Total Coverage

| Domain | Added | Modified | Scenarios |
|--------|-------|----------|-----------|
| institution-branding | 1 | 3 | 9 |
| institution-lifecycle | 1 | 7 | 26 |
| institution-notifications | 2 | 3 | 10 |
| institution-smtp | 1 | 3 | 10 |
| multi-tenant-routing | 2 | 4 | 15 |
| session-config | 2 | 3 | 12 |
| tenant-database | 2 | 5 | 16 |
| **TOTAL** | **11** | **28** | **98** |

- Happy paths: ✅ covered across all 7 domains
- Edge cases: ✅ covered (invalid VOs, null fields, inactive blocking, rollback on each step)
- Error states: ✅ covered (403, 404, 409, 500, bootstrap failure)

---

## Cross-Cutting Constraints

1. **Field rename**: `email` → `contact_email` — affects DTOs, entity, DB migration, and any test fixture using the old name.
2. **Value Objects**: `HexColor`, `SmtpConfig`, `Cue` — all must be constructed in domain layer, not in infrastructure/presentation.
3. **active gate**: Two enforcement points — `POST /v1/auth/login` (no JWT if inactive) and `TenantMiddleware` (every tenant-scoped request). ROOT bypasses both.
4. **ENCRYPTION_KEY check**: Must fail application bootstrap (before HTTP bind), not at first SMTP use.
5. **Atomicity**: Tenant DB creation is 4 steps; any failure MUST roll back all preceding steps including admin user.

---

## Next Step

→ **sdd-design** — Design the architecture approach, file changes, and implementation decisions for each of the 5 feature slices.
