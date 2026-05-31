# Proposal: Sidebar Reorganization + Level-Based Access Filtering

## Intent

Reorganize sidebar: move level sections (Inicial, Nivel Primario, Secundario, Terciario) inside "Académico" as sub-headings. Filter level-specific items based on institution `config.levels`. ROOT sees everything.

Pedagogical level: ALL.

## Scope

### In Scope
- Restructure `navGroups` to nest four level groups as `subGroups` inside Académico
- Add `requiresLevelCode?: number` to NavItem, `subGroups?: NavSubGroupDef[]` to NavGroupDef
- Derive configured base levels from `config.levels` composite codes, filter sub-groups and items
- Sub-heading CSS (non-collapsible `<div>`, bold) + tablet collapse rule
- Remove old top-level groups: `inicial`, `nivel-primario`, `secundario`, `terciario`

### Out of Scope
- Level-based route guards (manual URL navigation still reaches unfiltered routes)
- Backend/API/DB changes; dynamic level generation; role-based filter changes

## Capabilities

### New Capabilities
- `sidebar-navigation`: Sidebar structure with sub-headings; level-based visibility filtering via `config.levels` with ROOT bypass

### Modified Capabilities
- None

## Approach

**Approach 1 — Static nesting + level code on NavItem** (per exploration).

1. Derive `configuredLevels: Set<number>` from `config.levels` composite codes (`Math.floor(code / 10)`)
2. Add `requiresLevelCode` to NavItem, `subGroups` to NavGroupDef; restructure Académico
3. Filter: ROOT bypasses all checks. Others: hide items/subGroups not in configured set
4. Sub-headings as static `<div>` (not `<details>`) with `.sidebar-subheading` class
5. Tablet collapse: `display:none` for sub-headings when icon-only

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `sidebar.tsx` | Modified | Restructure `navGroups`, update filter, derive level set |
| `sidebar.css` | Modified | `.sidebar-subheading` styles + tablet collapse |
| `SidebarGroup.tsx` | Modified | Render `subGroups` as flat sub-headings |
| `SidebarGroup.css` | Modified | Sub-heading spacing |
| `web/src/constants/levels.ts` | Referenced | Level code constants |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Triple nesting (details→details→links) | Low | Sub-headings as `<div>`, not `<details>` |
| Empty Académico when all items filtered | Low | Count subGroup items in visibility check |
| Tablet mode leaks sub-headings | Low | `display:none` in tablet media query |
| `config.levels` empty for ROOT | None | ROOT bypasses all level checks |

## Rollback Plan

Revert `sidebar.tsx`, `sidebar.css`, `SidebarGroup.tsx`, `SidebarGroup.css` via git. No API, DB, or backend changes.

## Dependencies

- `packages/domain/.../educational-level.ts` — `EducationalLevelCode` enum (exists)
- `web/src/constants/levels.ts` — level labels/metadata (exists)
- `web/src/context/institution-context.tsx` — `config.levels` (exists)

## Success Criteria

- [ ] Level sections (Inicial/Primario/Secundario/Terciario) rendered as sub-headings inside Académico
- [ ] Institution with only Inicial (`levels: [10,11]`) sees only "Inicial" sub-heading + its items
- [ ] Institution with all levels sees all four sub-headings
- [ ] ROOT sees everything regardless of `config.levels`
- [ ] Sub-headings are non-collapsible `<div>` (not `<details>`)
- [ ] Tablet collapsed mode hides sub-headings
- [ ] Zero TypeScript errors, existing tests pass
