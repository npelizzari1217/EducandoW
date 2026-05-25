# Tasks: System Modules CRUD

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~313 (6 new files + 3 modifications) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

> **Note**: Retroactive task creation — code already implemented. Tests pending.

## Phase 1: Application — Use Cases

- [ ] 1.1 Create `api/src/application/modules/use-cases/modules.use-cases.ts` with 4 `@Injectable()` classes: `ListModulesUseCase` (filter `active: true, deletedAt: null`, order by `code`), `CreateModuleUseCase` (trim + uppercase `code`, trim `name`), `UpdateModuleUseCase` (partial update, return `null` if not found), `DeleteModuleUseCase` (soft-delete: set `active: false` + `deletedAt`)
- [ ] 1.2 All use cases inject `PrismaService` and call `this.prisma.getMasterClient()` — no tenant context

## Phase 2: Presentation — Backend (DTOs, Controller, Module)

- [ ] 2.1 Create `api/src/presentation/modules/dto/create-module.dto.ts` — Zod schema: `code` (string, 1–50, required), `name` (string, 1–100, required); export `CreateModuleSchema` + `CreateModuleDTO` type
- [ ] 2.2 Create `api/src/presentation/modules/dto/update-module.dto.ts` — Zod schema: `code?`, `name?`, `active?` all optional; export `UpdateModuleSchema` + `UpdateModuleDTO` type
- [ ] 2.3 Create `api/src/presentation/modules/modules.controller.ts` — `@Controller('modules')` with `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('ROOT')` at class level; 4 endpoints: `GET /` → list, `POST /` → create (201), `PATCH /:id` → update (200, `{data: null}` if not found), `DELETE /:id` → soft-delete (204); use `ZodValidationPipe` on create/update bodies
- [ ] 2.4 Create `api/src/presentation/modules/modules.module.ts` — register `ModulesController`, provide `PrismaService`, `AuthGuard`, `RolesGuard`, and 4 use cases via `useFactory` injecting `PrismaService`
- [ ] 2.5 Modify `api/src/app.module.ts` — import and register `ModulesModule` in the root imports array

## Phase 3: Presentation — Frontend (Page, Route, Sidebar)

- [ ] 3.1 Create `web/src/pages/dashboard/modules.tsx` — React page with: `useApiList`/`useApiCreate`/`useApiUpdate`/`useApiDelete` hooks; inline form toggle (`showForm` state) with code (disabled on edit), name, active checkbox (edit-only); `Table` with columns code/name/active/actions; `@media print` CSS hiding all except `.print-friendly` and `.page-header`; print button calling `window.print()`
- [ ] 3.2 Modify `web/src/App.tsx` — add import for `ModulesPage` and route `<Route path="/modules" element={<ProtectedRoute roles={['ROOT']}><ModulesPage /></ProtectedRoute>} />`
- [ ] 3.3 Modify `web/src/components/layout/sidebar.tsx` — add nav item `{ label: 'Módulos', path: '/modules', roles: ['ROOT'] }`

## Phase 4: Testing (Pending)

- [ ] 4.1 Write unit tests for `CreateModuleSchema` and `UpdateModuleSchema` — verify Zod rejects missing fields, enforces max lengths, accepts valid input
- [ ] 4.2 Write integration tests for use cases with mocked `PrismaService` — verify create trims/uppercases, list filters active+non-deleted, delete sets `active: false` + `deletedAt`, update returns `null` for non-existent ID
- [ ] 4.3 Write E2E tests for controller — verify 403 for non-ROOT roles, 201 on create, 200 on list/update, 204 on delete, Zod validation rejects bad payloads
- [ ] 4.4 Write component tests for `modules.tsx` — verify form toggle, code field disabled on edit, active checkbox visible only in edit mode, print button present, table renders data
