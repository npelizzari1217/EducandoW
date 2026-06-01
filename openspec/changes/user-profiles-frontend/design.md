# Design: User Profiles Frontend

## Technical Approach

Single-page CRUD in `profiles.tsx` following the `users.tsx` pattern: `PremiumHeader` + toggleable `Card(form)` + `Card(Table)`. Reuses existing hooks (`useApiList`, `useApiCreate`, `useApiUpdate`, `useApiDelete`), `ModuleAccessGrid`, and direct `apiClient.put` for the permissions endpoint that has no corresponding hook.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Permissions PUT | `apiClient.put()` directly | New `useApiPut` hook | One-off use case. A 3-line hook adds indirection without reuse. Follows `useApiCreate/Update` pattern: the hook composition exists; PUT is trivially `apiClient.put(url, body)`. |
| Delete confirmation | `window.confirm()` inline | New `ConfirmModal` component | No modal component exists in the codebase. Creating one for a single delete button is premature abstraction. `window.confirm()` is native, zero-dependency, and the existing `users.tsx` has NO confirmation at all — this is an improvement. |
| Conversion functions | Module-level helpers in `profiles.tsx` | Exported utils file | Functions are tightly coupled to profile page types (`PermissionRow`, `ModuleAccessItem`). No reuse across pages. Keeping them local avoids premature abstraction. |
| Module list for grid | Reuse `/v1/modules` via `useApiList<ModuleInfo>` | Fetch from profiles endpoint | Modules endpoint already returns `{ code, name, actions }` exactly matching `ModuleAccessGrid`'s `ModuleInfo` contract. No transformation needed. |

## Data Flow

```
profiles.tsx
  ├─ useApiList<Profile>('/profiles') ──→ Table rows
  ├─ useApiList<ModuleInfo>('/modules') ──→ ModuleAccessGrid (availableModules)
  │
  ├─ Form flow:
  │   ├─ NEW: POST /v1/profiles  (useApiCreate) → reload list
  │   ├─ EDIT: GET /v1/profiles/:id (apiClient) → populate form + convert perms
  │   │         PATCH /v1/profiles/:id (useApiUpdate)
  │   │         PUT /v1/profiles/:id/permissions (apiClient.put)
  │   └─ DELETE: DELETE /v1/profiles/:id (useApiDelete) → reload list
  │
  ├─ Profile selector (users.tsx):
  │     GET /v1/profiles → dropdown options
  │     onSelect: GET /v1/profiles/:id/permissions → booleansToModuleAccess → setModuleAccess()
  │
  └─ Conversion pipe:
        PermissionRow[] ──→ booleansToModuleAccess() ──→ ModuleAccessItem[]
        ModuleAccessItem[] ──→ moduleAccessToBooleans() ──→ PermissionUpdate[]
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/profiles.tsx` | **Create** | Full CRUD page: PremiumHeader, form Card (name + ModuleAccessGrid), table Card (name, module count, actions), delete via `window.confirm()`. All states: loading/empty/error/success. |
| `web/src/pages/dashboard/users.tsx` | **Modify** | Add `profileId` to form state, fetch profiles on mount, insert `<select>` between Rol radio buttons and ModuleAccessGrid. On selection: fetch permissions → convert → populate grid. |
| `web/src/components/layout/sidebar.tsx` | **Modify** | Add `{ label: 'Perfiles', path: '/profiles', moduleCode: 'USERS' }` to `sistema` group items array. |
| `web/src/App.tsx` | **Modify** | Import `ProfilesPage`, add route `<Route path="/profiles" element={<ProtectedRoute moduleCode="USERS" action="READ"><ProfilesPage /></ProtectedRoute>} />` inside `<DashboardLayout>` wrapper. |

## Interfaces

```typescript
// API response types (profiles.tsx)
interface Profile {
  id: string; name: string; institutionId: string | null;
  _count?: { permissions: number };
  createdAt: string; updatedAt: string;
}

interface PermissionRow {
  moduleId: string; moduleCode: string; moduleName: string;
  canRead: boolean; canCreate: boolean; canEdit: boolean;
  canDelete: boolean; canPrint: boolean;
}

interface PermissionUpdate {
  moduleId: string;
  canRead: boolean; canCreate: boolean; canEdit: boolean;
  canDelete: boolean; canPrint: boolean;
}

// Conversion signatures
function booleansToModuleAccess(permissions: PermissionRow[]): ModuleAccessItem[];
function moduleAccessToBooleans(items: ModuleAccessItem[], codeToId: Map<string, string>): PermissionUpdate[];
```

`moduleCodeToId` mapping is built from the `ModuleInfo[]` response (`/v1/modules`) via `new Map(moduleList.map(m => [m.code, m.id]))`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `booleansToModuleAccess` — all-boolean permutations produce correct actions array | Vitest unit in `profiles.test.tsx` or dedicated test file |
| Unit | `moduleAccessToBooleans` — reverse conversion fidelity | Same test file |
| Component | Profile form toggle (show/hide) | React Testing Library |
| Component | Profile selector in users.tsx populates ModuleAccessGrid correctly on selection | Mock `GET /v1/profiles/:id/permissions` response |
| Integration | Full CRUD cycle (create → list → edit → delete) | Mock API, assert reload calls |

## Migration / Rollout

No migration required. All changes are additive frontend-only: new page, new route, new sidebar item, optional selector in existing form. Rollback: remove route, sidebar item, selector block, delete `profiles.tsx`.

## Open Questions

- [ ] Should the profile selector in users.tsx clear on "Sin perfil" selection or preserve last state? (Design choice: clear the grid.)
