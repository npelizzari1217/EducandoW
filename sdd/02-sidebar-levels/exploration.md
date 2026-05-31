# Exploration: Sidebar Reorganization + Level-Based Access Filtering

> **Fecha**: 2026-05-31 | **Fase**: EXPLORE | **Agente**: sdd-explore

---

## Current State

### Sidebar Structure (top-level groups)

```
Dashboard (always visible, outside groups)
├── Secretarios — Estudiantes, Docentes, Inscripciones, Legajos, Planes de Estudio, Usuarios
├── Terciario — Carreras, Inscripciones
├── Académico — Alumnos por curso, Calificaciones parciales, Asistencia del día
├── Nivel Primario — Grados, Calificaciones
├── Secundario — Cursos, Mesas de Examen
├── Inicial — Salas, Informes Evolutivos, Planificaciones
└── Sistema — Instituciones, Módulos, Configuración SMTP, WebSocket
```

**Problem 1: Structure.** The four pedagogical levels (Inicial, Primario, Secundario, Terciario) are separate top-level groups. This scatters level-specific navigation across the sidebar and creates an inconsistent mental model — "Académico" contains cross-cutting items, while each level has its own group at the same hierarchy level. The user wants them INSIDE Académico as sub-headings.

**Problem 2: Filtering.** The current filter only checks `hasLevels = config.levels.length > 0` — a binary "does the institution have ANY level?" check. A school with only "Inicial" configured still sees "Secundario", "Nivel Primario", and "Terciario" groups with their items. ROOT users bypass all checks (correct behavior, should be preserved).

### Filter chain

```
config.levels: number[] (composite codes from API, e.g. [10, 11, 20])
    ↓
hasLevels = config.levels.length > 0  ← binary: any level?
    ↓
makeFilterItem(user, hasLevels, sendEmail, sendMessages)
    ↓
if (item.requiresLevel && !hasLevels && user.role !== 'ROOT') return false;
    ↓
visibleGroups = navGroups mapped → filter items → skip empty groups
```

### Level Code System

The institution `levels` field returns **composite codes** (`10`, `20`, `30`, `40`, etc.) where:
- `Math.floor(code / 10)` = base level code (`1`=Inicial, `2`=Primario, `3`=Secundario, `4`=Terciario)
- `code % 10` = modality (`0`=Común, `1`=Talleres, `2`=Bilingüismo)

So `config.levels = [10, 11]` means the institution has Inicial (both Común and Talleres).

### Key types and constants available

| Source | Type/Export | Purpose |
|--------|------------|---------|
| `packages/domain/.../educational-level.ts` | `EducationalLevelCode` enum (1–4, 9) | Base level codes |
| `web/src/constants/levels.ts` | `LEVEL_CATALOG`, `LEVELS_BY_BASE`, `PEDAGOGICAL_LEVELS` | Frontend level metadata |
| `web/src/context/institution-context.tsx` | `InstitutionConfig.levels: number[]` | Composite codes from API |
| `web/src/components/layout/SidebarGroup.tsx` | `<details>/<summary>` collapsible group | Current group UI |

### Route Guards

`ProtectedRoute` only checks authentication + role (`roles: string[]`). There are NO level-based route guards. A user from an "Inicial only" institution can navigate to `/secundario/cursos` if they know the URL. The backend would likely return data scoped to their institution's levels, but the UX is inconsistent. **This is a related concern but was not explicitly requested.**

---

## Problem Statement

1. **Menu reorganization**: Move "Inicial", "Nivel Primario", "Secundario", and "Terciario" from top-level groups into sub-headings within the "Académico" group.

2. **Level-based filtering**: Show only the level sub-headings that match the institution's configured levels. ROOT users see everything. A school with `levels: [10, 11]` (only Inicial) should only see the "Inicial" sub-heading, not Primario, Secundario, or Terciario.

---

## Affected Areas

| File | Why affected |
|------|-------------|
| `web/src/components/layout/sidebar.tsx` | Main change: restructure `navGroups`, update `makeFilterItem`, derive level set from `config.levels` |
| `web/src/components/layout/sidebar.css` | New `.sidebar-subheading` styles for level sub-headings inside Académico |
| `web/src/components/layout/SidebarGroup.tsx` | May need `flatContent` prop to render non-link children without indentation |
| `web/src/components/layout/SidebarGroup.css` | Possible minor adjustment for sub-heading spacing inside group content |
| `web/src/constants/levels.ts` | Import `EducationalLevelCode` or `LEVELS_BY_BASE` for level lookup |
| `web/src/App.tsx` | (Future consideration) Level-based `ProtectedRoute` guards — out of scope for this change but worth noting |
| `web/src/components/layout/protected-route.tsx` | (Future consideration) Could accept `levelCode` prop — out of scope |

---

## Approaches

### Approach 1: Static nesting + level code on NavItem (RECOMMENDED)

Restructure `navGroups` to nest the four level groups as static sub-sections inside Académico. Add a `requiresLevelCode` field to `NavItem`. Derive a `Set<number>` of configured base levels from `config.levels` and filter level-specific items based on that set.

**Structure would become:**
```ts
{
  id: 'academico',
  label: 'Académico',
  icon: '📁',
  items: [
    // Cross-cutting items (shown whenever any level exists)
    { label: 'Alumnos por curso', path: '/students-by-course', requiresLevel: true },
    { label: 'Calificaciones parciales', path: '/grades', requiresLevel: true },
    { label: 'Asistencia del día', path: '/attendance', requiresLevel: true },
  ],
  subGroups: [   // ← NEW: level sub-headings rendered as flat labels, not collapsible
    { levelCode: 1, label: 'Inicial', items: [
        { label: 'Salas', path: '/inicial/salas', requiresLevelCode: 1 },
        { label: 'Informes Evolutivos', path: '/inicial/informes', requiresLevelCode: 1 },
        { label: 'Planificaciones', path: '/inicial/planificaciones', requiresLevelCode: 1 },
    ]},
    { levelCode: 2, label: 'Primario', items: [...] },
    { levelCode: 3, label: 'Secundario', items: [...] },
    { levelCode: 4, label: 'Terciario', items: [...] },
  ],
}
```

**Filter logic:**
```ts
// Derive configured base levels from composite codes
const configuredLevels = new Set(
  config.levels.map((code) => Math.floor(code / 10))
);

function hasLevelBase(item: NavItem): boolean {
  if (item.requiresLevelCode == null) return true;
  return configuredLevels.has(item.requiresLevelCode);
}
// ROOT bypass: if user.role === 'ROOT', skip all level checks
```

**Visual:**
```
Académico [collapsible]
├── Alumnos por curso
├── Calificaciones parciales
├── Asistencia del día
├── ────── INICIAL ──────  (sub-heading, non-collapsible, only if configured)
├── Salas
├── Informes Evolutivos
├── Planificaciones
├── ────── PRIMARIO ────── (only if configured)
├── Grados
├── Calificaciones
├── ────── SECUNDARIO ──── (only if configured)
├── Cursos
├── Mesas de Examen
└── ────── TERCIARIO ──── (only if configured)
    ├── Carreras
    └── Inscripciones
```

**Pros:**
- Clean, predictable structure — one look at `navGroups` and you understand the menu
- No dynamic generation complexity
- Level filtering is a simple set lookup (`configuredLevels.has(code)`)
- Existing `requiresLevel` flag continues to work for generic items
- Sub-headings are static labels, not another collapsible layer (avoids triple nesting)

**Cons:**
- Adds a `subGroups` concept to the `NavGroupDef` interface and `SidebarGroup` renderer
- Requires a new CSS class for sub-heading visual
- Still static — adding a new pedagogical level means editing `navGroups`

**Effort**: Low-Medium

---

### Approach 2: Dynamic generation from config.levels

Don't predefine level groups in `navGroups`. Instead, derive which level sub-groups to show dynamically from `config.levels` using `LEVELS_BY_BASE` or `LEVEL_CATALOG` from `web/src/constants/levels.ts`.

**Structure:**
```ts
const visibleLevelSubGroups = useMemo(() => {
  if (user?.role === 'ROOT') return ALL_LEVEL_SUB_GROUPS;
  const baseLevels = new Set(config.levels.map(c => Math.floor(c / 10)));
  return LEVEL_SUB_GROUP_DEFS.filter(g => baseLevels.has(g.levelCode));
}, [config.levels, user?.role]);
```

**Pros:**
- Fully dynamic — adding a new level code automatically shows up
- No `subGroups` concept needed in `NavGroupDef`
- Data-driven from the canonical level catalog

**Cons:**
- The render is less transparent — the final menu structure is computed, not declared
- Harder to customize per-level items (some items might be missing for certain levels)
- The mapping between level codes and specific nav items (paths, labels) still needs to exist somewhere — it's just moved to a different constant
- More complex to test

**Effort**: Medium

---

### Approach 3: Separate sidebars per level (not recommended)

Each level gets its own sidebar section that only appears when that level is active. Académico acts as a hub, and clicking a level opens a sub-sidebar.

**Pros:**
- Clean separation per bounded context
- Can add level-specific dashboard widgets

**Cons:**
- Major UX change — not what the user asked for
- Requires new navigation component, routing changes
- Over-engineered for the current requirement

**Effort**: High

---

## Recommendation

**Approach 1 (Static nesting + level code on NavItem)** is the right choice.

**Why:**
1. **Matches the user's mental model** — they want "Académico" to be the container for ALL pedagogical navigation. The sidebar declaration remains readable.
2. **Minimal complexity** — no dynamic generation, no computed menu trees. The structure is declared, the filter is a set lookup.
3. **Leverages existing patterns** — `requiresLevel` already exists; `requiresLevelCode` is its natural extension.
4. **ROOT bypass preserved** — one condition check: `user?.role === 'ROOT'`.
5. **The level catalog is stable** — 4 pedagogical levels isn't going to change. Dynamic generation is overkill.

### Implementation Strategy

**Phase 1: Data model**
- Add `requiresLevelCode?: number` to `NavItem` interface
- Add `subGroups?: NavSubGroupDef[]` to `NavGroupDef` interface (or flatten into items with a `sectionLabel` property)
- Restructure `navGroups` to nest level groups under Académico

**Phase 2: Filter logic**
- Compute `Set<number>` of configured base levels from `config.levels`
- ROOT bypass: if ROOT, skip all level checks
- Update `makeFilterItem` to check `requiresLevelCode` against the set
- For `subGroups`: filter out entire sub-group if the level isn't configured (unless ROOT)

**Phase 3: Render**
- Add sub-heading rendering inside `SidebarGroup` content for `subGroups` entries
- Add `.sidebar-subheading` CSS class (bold, small-caps, separator, non-collapsible)
- Ensure the `SidebarGroup` component can render mixed content (links + sub-headings)

**Phase 4: Cleanup**
- Remove the old top-level groups (inicial, nivel-primario, secundario, terciario) from `navGroups`
- Remove the `Terciario` top-level group — its items go inside Académico's subGroups

---

## Risks and Edge Cases

### R1: Triple nesting in collapsible groups
Académico is already a `<details>/<summary>`. Adding sub-headings inside means: details → sub-heading → links. This is two levels of nesting visually, which is fine. But we must NOT nest another `<details>` for sub-groups — that would create triple nesting (details → details → links), which is terrible UX.

**Mitigation**: Sub-headings are rendered as static labels (e.g., `<div class="sidebar-subheading">`), not as `<details>` elements.

### R2: Empty Académico group when no levels + no generic items visible
If ALL items inside Académico are filtered out (both generic `requiresLevel` items AND all sub-group items), the entire group should not render. The existing `visibleItems.length > 0` check handles this, but we need to ensure subGroup filtering feeds into that count.

**Mitigation**: Count both `visibleItems` and `subGroups[].visibleItems` when determining if Académico should render.

### R3: ROOT users should see everything
Currently ROOT bypasses `requiresLevel`. The new logic must also bypass `requiresLevelCode`. A ROOT user should see ALL four level sub-headings regardless of what's configured.

**Mitigation**: Add `if (user?.role === 'ROOT') return true;` at the top of the filter function.

### R4: Sub-heading visual consistency in collapsed tablet mode
In tablet collapsed mode (56px icon-only), sub-headings must also collapse. The existing CSS rules hide `.sidebar-group-label`, `.sidebar-link-text`, etc. Sub-headings need similar rules.

**Mitigation**: Add `.sidebar:not(.sidebar-open) .sidebar-subheading { display: none; }` to the tablet media query.

### R5: Items that span multiple levels
Currently no item spans multiple levels — each item is strictly tied to one level (e.g., "Salas" is only Inicial). If future items span levels, `requiresLevelCode` would need to accept an array.

**Mitigation**: Not a concern yet. The type can be widened to `number | number[]` if needed later.

### R6: Level-based route guards not implemented
A user from an "Inicial only" institution can still navigate to `/secundario/cursos` by typing the URL. The sidebar won't show the link, but the route exists and the page may render with empty/no data.

**Mitigation**: Out of scope for this change. Can be addressed in a future change by extending `ProtectedRoute` with a `levelCode` prop. Mentioned in the Next Steps section.

---

## Ready for Proposal

**Yes.** The exploration is complete:
- Current state fully analyzed (sidebar structure, filter chain, level code system, route guards)
- Two viable approaches evaluated with tradeoffs
- Approach 1 (static nesting + level code filtering) recommended
- All files identified
- Risks documented with mitigations

**Next recommended phase**: SDD-PROPOSE to formalize scope, approach, and acceptance criteria.
