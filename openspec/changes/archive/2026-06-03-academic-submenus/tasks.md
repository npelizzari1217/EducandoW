# Tasks: Academic Sub-Menus

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Presentation Logic (`sidebar.tsx`)

- [ ] 1.1 Extender `NavGroupDef` con `subGroups` y reestructurar `navGroups` — mover ítems con `levelId` desde `academico.items` hacia `academico.subGroups`, dejando solo genéricos
  - **Commit**: `feat(sidebar): extend NavGroupDef with subGroups, restructure academic entries`
  - **Verify**: `pnpm --filter web exec tsc --noEmit` compila sin errores de tipo
- [ ] 1.2 Reemplazar `renderGroupItems()` — items genéricos primero, luego sub-grupos como `<SidebarGroup>` dentro de `<div className="sidebar-sub-groups">`, filtrando sub-grupos vacíos con `filterItem`
  - **Commit**: `feat(sidebar): rewrite renderGroupItems with sub-group SidebarGroup rendering`
  - **Verify**: `pnpm --filter web exec tsc --noEmit` compila; inspección visual: sub-grupos colapsables visibles
- [ ] 1.3 Actualizar call site (línea 244) pasando `group.subGroups` y `filterItem`; eliminar constante `LEVEL_LABELS`
  - **Commit**: `refactor(sidebar): wire subGroups to renderGroupItems, remove LEVEL_LABELS`
  - **Verify**: `pnpm --filter web exec tsc --noEmit`; `rg "LEVEL_LABELS" web/src/components/layout/sidebar.tsx` no encuentra referencias

## Phase 2: Presentation Styles (`sidebar.css`)

- [ ] 2.1 Eliminar bloque `.sidebar-section-label` (líneas 242-251); agregar estilos `.sidebar-sub-groups` con indentación (`margin-left: 16px; border-left`), overrides de fuente y padding para `.sidebar-sub-groups .sidebar-group summary`
  - **Commit**: `style(sidebar): replace section-label with sub-groups indented styles`
  - **Verify**: inspección visual — sub-grupos indentados, fuente más chica que grupos top-level
- [ ] 2.2 Agregar `.sidebar:not(.sidebar-open) .sidebar-sub-groups { display: none; }` dentro del `@media` tablet (línea 339)
  - **Commit**: `style(sidebar): hide sub-groups in tablet collapsed mode`
  - **Verify**: viewport 768-1023px, sidebar colapsado (56px) no renderiza sub-grupos

## Phase 3: Verification (`__tests__/sidebar.test.tsx`)

- [ ] 3.1 Actualizar test líneas 363-374 — reemplazar `document.querySelectorAll('.sidebar-section-label')` por `document.querySelectorAll('.sidebar-sub-groups details')`, validar textos de `<summary>` en vez de `<div>` textContent
  - **Commit**: `test(sidebar): update DOM assertion for collapsible sub-groups`
  - **Verify**: `pnpm --filter web test -- sidebar.test` pasa el test modificado
- [ ] 3.2 Ejecutar suite completa `pnpm test` y confirmar que todos los tests pasan con las nuevas aserciones
  - **Commit**: N/A (verificación final)
  - **Verify**: output de `pnpm test` — 0 fallos, 20+ tests pasan
