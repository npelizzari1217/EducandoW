# Design: System Modules CRUD

## Technical Approach

Thin CRUD layer over the `modules` master table. No domain layer — `Module` is a lookup entity (code + name) with no business invariants. Use cases inject `PrismaService` directly via `useFactory`, matching the pattern established by `01-instituciones` for simple master data (e.g., `users.use-cases.ts`). All endpoints gated behind `@Roles('ROOT')`.

## Architecture Decisions

### Decision 1: No domain repository interface

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `ModuleRepository` port + Prisma impl | Full Clean Arch purity | Rejected |
| `PrismaService` injected directly into use cases | Simpler, 2 fewer files | **Chosen** |

**Rationale**: `Module` has zero business rules — it's a string label with no invariants. A repository interface would add indirection without enabling testability (there's no logic to test). This matches the existing `users.use-cases.ts` pattern. The `institution` domain justifies a repository because it has Value Objects, validation, and business rules.

### Decision 2: Soft-delete via `active` + `deletedAt`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hard DELETE from master DB | Irreversible, simpler | Rejected |
| Soft-delete: set `active=false`, `deletedAt=timestamp` | Recoverable, query filters on `active=true` | **Chosen** |

**Rationale**: Even though the proposal initially scoped hard-delete as acceptable risk, the implementation chose soft-delete for safety. The `modules` table may gain FK references in future changes. List endpoint filters `WHERE active = true AND deletedAt IS NULL`, making deactivated modules invisible without data loss.

### Decision 3: `PrismaService.getMasterClient()` — no tenant context

**Choice**: All queries use `this.prisma.getMasterClient()` instead of tenant-scoped `this.prisma.getClient()`.

**Rationale**: The `modules` table lives in the master DB — it defines available system modules (shared across all institutions). Tenant middleware doesn't apply. ROOT role already gates access at the controller level.

### Decision 4: Inline form toggle (single-page CRUD)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Separate create/edit pages (`/modules/new`, `/modules/:id/edit`) | Cleaner URL, more code | Rejected |
| Modal dialog | Adds z-index/layer complexity | Rejected |
| Inline Card toggle above table | Minimal UI, fewer routes | **Chosen** |

**Rationale**: Only 3 fields (code, name, active). A separate page is overkill. The inline form toggles with `showForm` state — code field locks on edit, and the checkbox only appears in edit mode. Matches the proposal's "inline form" approach.

### Decision 5: Print via `@media print` CSS

**Choice**: Injected `<style>` tag with visibility toggling — hide everything except `.print-friendly` and `.page-header` during print.

**Rationale**: No server-side PDF generation needed for a lookup table. The `window.print()` button triggers the browser's native print dialog. The `@media print` block hides sidebar, navbar, and form controls — only the table and page title render. Simpler than a dedicated `/modules/print` endpoint or server-side PDF library (e.g., Puppeteer).

## Data Flow

```
Browser (React 19)               NestJS (Express)                PostgreSQL (master)
─────────────────               ─────────────────                ───────────────────
ModulesPage.tsx   ──GET──→  ModulesController  ──→  ListModulesUseCase  ──→  PrismaService.getMasterClient().module.findMany()
     │                          │
     │                   ZodValidationPipe
     │                   (CreateModuleSchema)
     │                          │
     └──POST──→  ModulesController  ──→  CreateModuleUseCase  ──→  PrismaService.getMasterClient().module.create({code, name})
     │                          │
     │                   ZodValidationPipe
     │                   (UpdateModuleSchema)
     │                          │
     └──PATCH──→ ModulesController  ──→  UpdateModuleUseCase  ──→  PrismaService.getMasterClient().module.update({code?, name?, active?})

DELETE: Controller → DeleteModuleUseCase → prisma.module.update({active: false, deletedAt})

Auth: AuthGuard → RolesGuard → @Roles('ROOT') — applies to ALL endpoints at class level.
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/presentation/modules/modules.controller.ts` | **Create** | Thin controller — delegates to 4 use cases, ROOT-only, Zod validation |
| `api/src/presentation/modules/modules.module.ts` | **Create** | NestJS wiring — registers controller + 4 use cases via `useFactory` |
| `api/src/presentation/modules/dto/create-module.dto.ts` | **Create** | Zod schema: `{code: string(1..50), name: string(1..100)}` |
| `api/src/presentation/modules/dto/update-module.dto.ts` | **Create** | Zod schema: `{code?, name?, active?}` — all optional |
| `api/src/application/modules/use-cases/modules.use-cases.ts` | **Create** | 4 use cases: List (filter active), Create, Update, Delete (soft) |
| `web/src/pages/dashboard/modules.tsx` | **Create** | React page — table + inline form + `@media print` + 4 API hooks |
| `api/src/app.module.ts` | **Modify** | +1 import, +1 `ModulesModule` in imports array |
| `web/src/App.tsx` | **Modify** | +1 import, +1 route: `/modules` gated with `<ProtectedRoute roles={['ROOT']}>` |
| `web/src/components/layout/sidebar.tsx` | **Modify** | +1 `navItem`: `{ label: 'Módulos', path: '/modules', roles: ['ROOT'] }` |

## Interfaces / Contracts

### REST API

| Method | Path | Auth | Request Body | Response |
|--------|------|------|-------------|----------|
| `GET` | `/modules` | ROOT | — | `{ data: Module[] }` |
| `POST` | `/modules` | ROOT | `{code, name}` | `{ data: Module }` (201) |
| `PATCH` | `/modules/:id` | ROOT | `{code?, name?, active?}` | `{ data: Module }` or `{ data: null }` |
| `DELETE` | `/modules/:id` | ROOT | — | 204 No Content |

**Module shape**: `{ id, code, name, active, createdAt, updatedAt }`

### Response wrapper

All responses follow `ResponseInterceptor`: `{ data: ... }` envelope. Errors use `AppExceptionFilter` for consistent `{ statusCode, message, error }` format.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **DTO validation** | Zod schema rejects missing `code`/`name`, enforces max length | Unit: `z.safeParse()` assertions |
| **Use cases** | Create/Update returns correct shape, Delete sets `active=false` + `deletedAt`, non-existent ID returns null/false | Integration: mock `PrismaService` via Vitest |
| **Controller** | 403 on non-ROOT, Zod rejects bad payload, 201 on create, 204 on delete | E2E: `supertest` with mocked `PrismaService` |
| **Frontend** | Form toggle, create reloads table, edit populates form, code field locked on edit, print button present | Component: `@testing-library/react` |
| **Auth guard** | Endpoint returns 403 for ADMIN, MANAGER, TEACHER roles | E2E: request with different role tokens |

**Current state**: No tests written. All layers need coverage to meet the `config.yaml` threshold of 80%.

## Migration / Rollout

No migration required — the `modules` table already exists in the master DB schema. Rollback per proposal: revert `app.module.ts`, `App.tsx`, and `sidebar.tsx` changes; delete the 6 new files.

## Open Questions

- [ ] Should the DELETE endpoint respond 204 (current) or 200 with `{ data: null }` for consistency with other CRUD endpoints?
- [ ] Should `ListModulesUseCase` include deactivated modules behind a query param (e.g., `?includeInactive=true`) for recovery scenarios?
