# Proposal: Sidebar Reorganization + Level-Based Access Filtering

> **Change**: 02-sidebar-levels | **Phase**: PROPOSE | **Status**: ready for SPEC

## Intent

Reorganize the sidebar so the four pedagogical levels (Inicial, Primario, Secundario, Terciario) are nested inside the "Académico" group as sub-headings instead of scattered as top-level groups. Replace the binary level check (`hasAnyLevel`) with filtering that shows only the level sub-sections matching the institution's configured levels. ROOT users see everything.

## Scope

### In Scope
- Nest Inicial, Primario, Secundario, and Terciario nav items inside the Académico group
- Render level sub-headings (`.sidebar-section-label`) as static labels between level-specific items — NOT as collapsible subgroups
- Filter level-specific items by `baseLevels` derived from `config.levels` (and user JWT levels when available)
- ROOT users bypass all level filters (preserved behavior)
- Tablet collapsed mode: hide sub-headings alongside links/icons

### Out of Scope
- Level-based route guards (`ProtectedRoute` with `levelCode`)
- Dynamic level generation from `LEVEL_CATALOG` (static declaration is sufficient for 4 stable levels)
- Collapsible sub-groups within Académico (avoids triple nesting)
- Changing the group structure of "Secretarios" or "Sistema"
- Backend changes

## Capabilities

### Modified Capabilities
- **sidebar-navigation**: Restructured to nest level-specific items inside Académico. Filtering upgraded from binary (`requiresLevel`) to level-aware (`levelId` matched against `baseLevels`). ROOT bypass preserved.

### New Capabilities
- None. This is a structural reorganization and filtering refinement of existing sidebar navigation.

## Approach

**Static nesting + `levelId` on NavItem** (Approach 1 from exploration).

1. **Data**: Level-specific items carry `levelId: 1|2|3|4` inside `navGroups.academico.items`. Cross-cutting items (Alumnos por curso, Calificaciones, Asistencia) keep `requiresLevel: true` without `levelId`.
2. **Derivation**: `baseLevels = Set<number>` computed from `config.levels.map(c => Math.floor(c / 10))`, with user JWT levels as primary source when present.
3. **Filter**: `makeFilterItem` checks `item.levelId` against `baseLevels`. ROOT users bypass all checks. Items without `levelId` that have `requiresLevel` are shown whenever any level exists.
4. **Render**: `renderGroupItems` injects `.sidebar-section-label` divs between items when `levelId` changes. Sub-headings are flat `<div>` elements — no nested `<details>`.
5. **CSS**: `.sidebar-section-label` styled as uppercase, muted, small text. Tablet-collapsed media query hides section labels.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/components/layout/sidebar.tsx` | Modified | Restructure `navGroups`, `levelId` on items, `baseLevels` + filter logic, `renderGroupItems` |
| `web/src/components/layout/sidebar.css` | Modified | `.sidebar-section-label` styles, tablet-collapsed hide rule |
| `web/src/components/layout/SidebarGroup.tsx` | None | No changes needed — section labels are children rendered by caller |
| `web/src/constants/levels.ts` | Reference | Consulted for level codes; no changes required |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Triple nesting if sub-headings become collapsible | Med | Sub-headings are flat `<div>` elements, never `<details>` |
| Empty Académico group when all items filtered | Low | Existing `visibleItems.length > 0` guard; section labels only render between visible items |
| Sub-heading visibility in tablet collapsed mode | Low | CSS rule `.sidebar:not(.sidebar-open) .sidebar-section-label { display: none }` already present |
| Items spanning multiple levels (future) | Low | Not a current concern; `levelId` can widen to `number \| number[]` later |

## Rollback Plan

1. Revert `navGroups` in `sidebar.tsx` to restore top-level level groups
2. Restore binary filter: replace `baseLevels` check with `hasLevels` boolean
3. Remove `.sidebar-section-label` CSS rules
4. No database or API changes to revert

## Dependencies

- `InstitutionConfig.levels: number[]` from `institution-context` (already available)
- `useAuth().user.levels` for JWT-based level filtering (already available)
- `LEVEL_LABELS` record from `constants/levels.ts` (already available)

## Success Criteria

- [ ] Sidebar only shows three top-level groups: Secretarios, Académico, Sistema
- [ ] Level-specific items appear inside Académico under their respective sub-headings
- [ ] Institution with `levels: [10, 11]` (Inicial only) shows only "INICIAL" sub-heading; Primario, Secundario, Terciario are hidden
- [ ] Institution with no levels shows generic Académico items (if any) but no level sections
- [ ] ROOT user sees ALL four level sub-headings regardless of institution config
- [ ] Sub-headings are visible on desktop, hidden in tablet collapsed mode (56px)
- [ ] No regression: Secretarios and Sistema groups are unchanged
- [ ] No regression: module-based filtering (`moduleCode`) and feature flags (`send_email`, `send_messages`) continue working
