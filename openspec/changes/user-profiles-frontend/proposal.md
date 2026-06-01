# Proposal: User Profiles Frontend

## Intent

Build the frontend UI for the User Profiles system. The backend exposes 7 REST endpoints for profile CRUD and permission matrix management. The frontend needs a management page (list/create/edit/delete profiles + permission editor) and a profile selector widget in the user creation/edit form that auto-fills the ModuleAccessGrid on selection.

## Scope

### In Scope
- **Profiles page** (`web/src/pages/dashboard/profiles.tsx`): table listing with CRUD forms
- **Permission matrix editor**: reuse `ModuleAccessGrid`, convert booleans ↔ `ModuleAccessItem[]`
- **Profile selector in users.tsx**: dropdown between "Rol" and "Módulos" sections; on select, fetch permissions → populate grid
- **Sidebar entry**: "Perfiles" under "Sistema" group (`sidebar.tsx`)
- **Route**: `/profiles` with `ProtectedRoute` in `App.tsx`

### Out of Scope
- Profile preview modal
- Bulk profile assignment
- Profile import/export

## Capabilities

### New Capabilities
- None (UI-only — no new spec capabilities)

### Modified Capabilities
- `sidebar-navigation`: Add "Perfiles" item to Sistema group
- `user-management`: Add profile selector to user creation/edit form (spec § Users UI Page)

## Approach

1. **Profiles page** follows existing page pattern: `PremiumHeader` + `Card(form)` + `Card(Table)`. Uses existing hooks (`useApiList`, `useApiCreate`, `useApiUpdate`, `useApiDelete`) for CRUD. Permission matrix saved via `apiClient.put` directly.
2. **ModuleAccessGrid** is reused as-is. Boolean→actions conversion: `canRead→READ`, `canCreate→CREATE`, `canEdit→UPDATE`, `canDelete→DELETE`, `canPrint→PRINT`. Reverse conversion on save.
3. **Profile selector** in `users.tsx`: positioned between "Rol" and "Módulos" sections. Fetches `GET /v1/profiles` for dropdown. On selection: `GET /v1/profiles/:id/permissions` → convert boolean matrix to `ModuleAccessItem[]` → `setModuleAccess()`. Body already sends `profileId`.
4. **Sidebar**: add `{ label: 'Perfiles', path: '/profiles', moduleCode: 'USERS' }` to Sistema group.
5. **Route**: add `<Route path="/profiles" element={<ProtectedRoute moduleCode="USERS" action="READ"><ProfilesPage /></ProtectedRoute>} />`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/profiles.tsx` | New | Profiles CRUD page + permission matrix editor |
| `web/src/pages/dashboard/users.tsx` | Modified | Add profile selector between Rol and Módulos |
| `web/src/components/layout/sidebar.tsx` | Modified | Add "Perfiles" to Sistema group |
| `web/src/App.tsx` | Modified | Add `/profiles` route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Boolean↔actions conversion bugs | Low | Existing conversion patterns validated by type safety; test with seed profiles |
| Permission matrix PUT replaces all rows | Low | Warn user with confirmation message; backend is transactional |
| Profile selector race condition on fast selections | Low | Abort previous fetch with `useEffect` cleanup (AbortController) |

## Rollback Plan

1. Remove `/profiles` route from `App.tsx`
2. Remove "Perfiles" from sidebar `navGroups`
3. Remove profile selector block from `users.tsx`
4. Delete `profiles.tsx` page file
5. All changes are additive and isolated — backend continues to work independently

## Dependencies

- Backend endpoints (`/v1/profiles/*`) — already deployed and tested
- `ModuleAccessGrid` component — already implemented at `web/src/components/users/module-access-grid.tsx`
- Existing API hooks (`useApiList`, `useApiCreate`, `useApiUpdate`, `useApiDelete`) — already implemented

## Success Criteria

- [ ] Profiles page renders list of profiles with module count
- [ ] Create/Edit/Delete profiles works end-to-end
- [ ] Permission matrix editor loads and saves via `PUT /v1/profiles/:id/permissions`
- [ ] Profile selector in users.tsx fetches and populates ModuleAccessGrid on selection
- [ ] User creation with `profileId` works — modules are derived from profile
- [ ] Sidebar shows "Perfiles" under Sistema for users with USERS:READ
- [ ] `/profiles` route is protected by `ProtectedRoute`
