# Proposal: System Modules CRUD

## Intent

Provide a ROOT-only administration interface to manage system modules (`modules` table in master DB). Operators need to list, create, update, and deactivate modules without direct DB access.

## Scope

### In Scope
- REST API at `/v1/modules`: GET all, GET by id, POST create, PATCH update, DELETE
- All endpoints `@Roles('ROOT')` exclusively
- Direct PrismaService CRUD on master DB (no tenant context)
- React page at `/modules` with table (code, name, active) + inline form
- Print button with `@media print` CSS
- Sidebar item + route (ROOT-visible only)

### Out of Scope
- Soft-delete: DELETE is hard delete
- Audit trail, pagination, mobile layout

## Capabilities

### New Capabilities
- `system-modules-crud`: ROOT-only backend API + frontend UI to manage the `modules` master table

### Modified Capabilities
None — `modules` table had no prior API or UI surface.

## Approach

Thin CRUD layer following existing patterns from `01-instituciones`:
- Backend: NestJS controller → PrismaService directly (no domain layer)
- Frontend: single-page React component with inline modal form and print styles

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/src/presentation/modules/` | New | Controller, module, DTOs |
| `api/src/application/modules/use-cases/` | New | CRUD use cases |
| `api/src/app.module.ts` | Modified | Register ModulesModule |
| `web/src/pages/dashboard/modules.tsx` | New | CRUD page |
| `web/src/App.tsx` | Modified | Add `/modules` route |
| `web/src/components/layout/sidebar.tsx` | Modified | Add Módulos item (ROOT only) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hard DELETE loses data irreversibly | Low | Lookup data, no FK deps. Manual DB restore if needed |
| No audit trail on changes | Low | Acceptable for v1. Add audit-log in future change |

## Rollback Plan

1. Remove `ModulesModule` from `app.module.ts`
2. Delete `api/src/presentation/modules/` and `api/src/application/modules/use-cases/`
3. Revert `App.tsx` route and sidebar item
4. `git revert` merge commit — no data migration needed

## Dependencies

- PrismaService with master DB connection (existing)
- ROOT role guard from auth module (existing)
- Shared UI patterns: DataTable, Modal, form patterns (existing)

## Success Criteria

- [ ] `GET /v1/modules` returns modules from master DB
- [ ] `POST /v1/modules` creates module and returns 201
- [ ] `PATCH /v1/modules/:id` updates fields and returns 200
- [ ] `DELETE /v1/modules/:id` removes record and returns 200
- [ ] Non-ROOT users receive 403 on all `/v1/modules` endpoints
- [ ] Page at `/modules` shows CRUD table with code, name, active
- [ ] Print button renders clean output via @media print
- [ ] Sidebar item visible only for ROOT users
