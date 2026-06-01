# Design: Sidebar Reorganization + Level-Based Access Filtering

> **Change**: 02-sidebar-levels | **Phase**: DESIGN | **Status**: ready for TASKS

## Technical Approach

The sidebar already has sub-headings, `renderGroupItems` flattening, and user-level-based baseLevels derivation. The single behavioral change: **remove the `config.levels` fallback** so `effectiveBaseLevels` comes exclusively from `user.levels` (JWT). All other machinery — NavItem interface, `makeFilterItem`, `renderGroupItems`, CSS, `SidebarGroup` — stays structurally identical but shifts from institution-level-aware to user-level-aware.

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | **NavItem level fields** | `requiresLevel: boolean` (broad) + `levelId: number` (narrow, serves as `requiresLevelCode`) | Already in use. `levelId` implicitly carries the `requiresLevel` constraint; the filter evaluates both independently. No rename needed — the spec term `requiresLevelCode` maps to `levelId`. |
| 2 | **baseLevels source** | `user?.levels` only, no fallback to `config.levels` | Spec requirement: "If the user's `levels` array is empty, no level sub-headings SHALL appear for non-ROOT users." The fallback masked the user's own level assignment. |
| 3 | **Empty Académico guard** | Group removed when `visibleItems.length === 0` after filter | Already implemented. After removing the fallback, an ADMIN with empty JWT levels will have zero visible Académico items → group hidden. The `hasLevels` flag becomes `userBaseLevels.size > 0` (no institution bypass). |
| 4 | **Sub-heading element** | `<div className="sidebar-section-label">`, inside `<div className="sidebar-group-content">` | Spec mandates flat `<div>`, never `<details>`. Already implemented in `renderGroupItems`. No nesting change needed. |
| 5 | **Flattening strategy** | Sequential scan in `renderGroupItems` — insert sub-heading div when `item.levelId` changes | Already implemented. Items are declared ordered (generic → Inicial → Primario → Secundario → Terciario). The scan emits `{.sidebar-section-label}` before the first item of each level block. |
| 6 | **Tablet collapse** | `.sidebar-section-label { display: none }` inside `:not(.sidebar-open)` media query | Already in `sidebar.css` line 339. No changes needed. |
| 7 | **Old top-level groups** | Already removed — `navGroups` has only `secretarios`, `academico`, `sistema` | No legacy cleanup required. The spec's "no level group appears as a top-level sidebar group" is already satisfied. |
| 8 | **Placeholder visibility** | `!hasLevels && role === 'ADMIN'` | After change, `hasLevels` = `userBaseLevels.size > 0` (no fallback). ADMIN with empty JWT levels → placeholder renders + no Académico group. ROOT is never ADMIN, so ROOT bypass is unaffected. |

---

## Data Flow

```
JWT token (user.levels: number[])
        │
        ▼
  Math.floor(code / 10) per composite code
        │
        ▼
  Set<number> baseLevels  ──── no fallback to config.levels
        │
        ├── hasLevels = baseLevels.size > 0
        │
        ▼
  makeFilterItem(user, modules, hasLevels, baseLevels, flags)
        │
        ├─ requiresLevel check: hidden if !hasLevels && !root
        ├─ levelId check:      hidden if !root && !baseLevels.has(levelId)
        ├─ moduleCode check:   hidden if !root && no READ permission
        └─ featureFlag check:  hidden if flag is false
        │
        ▼
  navGroups → map(filter items) → filter(groups with visibleItems.length > 0)
        │
        ▼
  SidebarGroup (details/summary) → renderGroupItems() → links + sidebar-section-label divs
```

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/layout/sidebar.tsx` | **Modify** | Remove `institutionBaseLevels` + fallback line. `effectiveBaseLevels` = `userBaseLevels` directly. Update `hasLevels` derivation. |
| `web/src/components/layout/sidebar.css` | **No change** | `.sidebar-section-label` and tablet collapse rule already present (lines 243–251, 339). |
| `web/src/components/layout/SidebarGroup.tsx` | **No change** | Already renders `children` inside `.sidebar-group-content`. Sub-heading divs are passed as children. |
| `web/src/components/layout/SidebarGroup.css` | **No change** | Existing indent rule (line 76) applies to `.sidebar-section-label` naturally. |
| `web/src/constants/levels.ts` | **No change** | Imported for `LEVEL_LABELS`; catalog and helpers unchanged. |
| `web/src/components/layout/__tests__/sidebar.test.tsx` | **Modify** | Tests must set `mockUser.levels` instead of relying on `mockLevels` (institution config). For non-ROOT users, `mockLevels` no longer provides fallback visibility. |

---

## Filter Function — makeFilterItem

Current signature stays. The only behavioral change is WHAT `baseLevels` contains:

```ts
// BEFORE (sidebar.tsx ~line 135-138):
const institutionBaseLevels = new Set(config.levels.map((code) => Math.floor(code / 10)));
const effectiveBaseLevels = userBaseLevels.size > 0 ? userBaseLevels : institutionBaseLevels;

// AFTER:
const effectiveBaseLevels = userBaseLevels;
```

Filter logic unchanged:
```
filter(item):
  if item.moduleCode && !root && !hasModulePermission(userModules, item.moduleCode) → HIDE
  if item.path === '/modules' && !root → HIDE
  if item.requiresLevel && !hasLevels && !root → HIDE
  if item.levelId !== undefined && !root && !baseLevels.has(item.levelId) → HIDE
  if item.featureFlag === 'send_email' && !sendEmail → HIDE
  if item.featureFlag === 'send_messages' && !sendMessages → HIDE
  → SHOW
```

---

## Render Logic — group rendering with sub-headings

```
renderGroupItems(visibleItems):
  currentLevel = undefined
  for item in visibleItems:
    if item.levelId !== undefined AND item.levelId !== currentLevel:
      currentLevel = item.levelId
      emit <div class="sidebar-section-label">{LEVEL_LABELS[currentLevel]}</div>
    emit renderLink(item)
```

Sub-headings are **flattened** into the items array — no separate sub-group structure. The `SidebarGroup` component receives them as plain `children` and renders them inside `.sidebar-group-content` alongside link elements.

**Empty-group guard** (already in sidebar.tsx line 148):
```
visibleGroups = navGroups
  .map(group => ({ ...group, visibleItems: group.items.filter(filterItem) }))
  .filter(group => group.visibleItems.length > 0)
```
`visibleItems.length` counts ALL items including sub-heading divs. Since sub-headings are only emitted when at least one level-specific item survives the filter, they never inflate the count. A group with zero visible items is removed.

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `makeFilterItem` with user-level-only baseLevels | Vitest — verify each filter gate (ROOT bypass, requiresLevel, levelId match, module permissions) |
| Component | Sidebar rendering with various JWT `levels` arrays | Existing test suite (sidebar.test.tsx) — update mocks to set `user.levels` instead of relying on `mockLevels` |
| Component | Empty Académico group hidden when user.levels=[] | Assert `Académico` group label not in DOM |
| Component | Placeholder visibility for ADMIN with empty levels | Assert placeholder text visible; assert no Académico items |
| Component | ROOT sees all 4 sub-headings regardless of levels | Existing test (line 404) already covers this |

---

## Migration / Rollout

No migration required. The change is a pure frontend filter shift. Backend already sends `user.levels` in the JWT payload (`auth-context.tsx` line 4). No API changes, no new routes, no database changes.

## Open Questions

None.

---

**Ready for**: `sdd-tasks`
