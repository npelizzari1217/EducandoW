# Proposal: Academic Sub-Menus

## Intent

Replace static `<div>` level sub-headings inside the "Académico" sidebar group with collapsible sub-menus. Currently "Inicial", "Nivel Primario", "Secundario", and "Terciario" are inert labels — users scroll through long lists. Collapsible sub-groups reduce visual noise and improve scannability.

## Scope

### In Scope
- Convert level labels into nested `<details>`/`<summary>` sub-groups within Académico, reusing `SidebarGroup`
- Each sub-group collapses/expands independently with localStorage persistence
- Tablet collapsed mode (56px) hides sub-group content (matching current `.sidebar-section-label` behavior)
- Update tests to reflect new DOM structure

### Out of Scope
- Applying sub-menus to Secretarios or Sistema groups
- Changing filter logic (filterItem, ROOT bypass, requiresLevel)
- Animation changes — reuse existing `SidebarGroup` max-height transition

## Capabilities

### Modified Capabilities
- `sidebar-navigation`: Requirement "Level Sub-Sections in Académico" changes — sub-headings become collapsible `<details>` sub-groups instead of static `<div>`. All existing filtering scenarios remain valid; DOM assertions change from `.sidebar-section-label` queries to sub-group `<summary>` queries.

## Approach

1. Extend `navGroups` with a `subGroups?: { id, label, icon, items }[]` field on the Académico entry only. Move level-specific items into their respective subGroups. Generic items (Alumnos por curso, Notas, Asistencia) stay at the top level.
2. Modify `renderGroupItems()` to render generic items first, then map each subGroup into a `<SidebarGroup>` instance with the sub-group's id, label, and pre-filtered items.
3. Add `.sidebar-sub-group` CSS for nested `<details>`: reduced padding, smaller chevron, indent (48px), and `max-height` transition inherited from `.sidebar-group-content`.
4. Extend tablet collapsed selectors to hide `.sidebar-sub-group` content.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web/src/components/layout/sidebar.tsx` | Modified | Extend `NavGroupDef`, restructure `navGroups`, rewrite `renderGroupItems` |
| `web/src/components/layout/SidebarGroup.tsx` | Unchanged | Reused as-is for sub-groups |
| `web/src/components/layout/sidebar.css` | Modified | Remove `.sidebar-section-label`, add `.sidebar-sub-group` styles |
| `web/src/components/layout/SidebarGroup.css` | Unchanged | No changes needed |
| `web/src/components/layout/__tests__/sidebar.test.tsx` | Modified | Replace `.sidebar-section-label` queries with sub-group `<summary>` queries |
| `openspec/specs/sidebar-navigation/spec.md` | Modified | Update sub-heading requirement to allow `<details>` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| localStorage key collision with Académico group key | Low | Sub-group keys use pattern `sidebar-group-academico-inicial` — unique |
| Nested `<details>` rendering bugs in Safari | Low | Test in Safari; `<details>` nesting is well-supported in all modern browsers |
| Test breakage from DOM assertion changes | Med | Full test suite run before merge; update all `.sidebar-section-label` assertions |

## Rollback Plan

Revert `sidebar.tsx` to flat items + `renderGroupItems` with static divs. Remove sub-group CSS. The `sidebar-navigation` spec can revert the "collapsible" clause. No DB or API changes involved.

## Dependencies

None. Uses existing `SidebarGroup` component and CSS variables.

## Success Criteria

- [ ] Level labels become collapsible sub-groups inside Académico
- [ ] Each sub-group expands/collapses independently with persisted state
- [ ] ROOT users see all four sub-groups; non-ROOT sees only matching levels
- [ ] Tablet collapsed mode hides sub-group content
- [ ] All existing sidebar tests pass with updated DOM assertions
- [ ] No visual regression: same colors, spacing, typography
