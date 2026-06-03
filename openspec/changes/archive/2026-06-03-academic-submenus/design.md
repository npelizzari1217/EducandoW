# Design: Academic Sub-Menus

## Architecture Decision Records

### ADR-1: Data Model — `subGroups` extension

**Decision**: Add optional `subGroups` field to `NavGroupDef` instead of a recursive tree.

**Rationale**: Only one group (Académico) needs nesting. A recursive model adds complexity for zero benefit. The `subGroups` array is flat, optional, and transparent to groups that don't use it.

```ts
// BEFORE
interface NavGroupDef {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

// AFTER
interface NavGroupDef {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  subGroups?: {
    id: string;       // e.g. "academico-inicial"
    levelId: number;  // 1..4
    label: string;    // LEVEL_LABELS[levelId]
    items: NavItem[]; // pre-filtered items for this level
  }[];
}
```

### ADR-2: Component Reuse — `SidebarGroup` as-is

**Decision**: Reuse `SidebarGroup` without modifying its interface. Wrap sub-groups in a `<div className="sidebar-sub-groups">` for CSS scoping.

**Rationale**: `SidebarGroup` already handles `<details>/<summary>`, localStorage persistence (`sidebar-group-{id}`), collapse animation, and empty-children guard. Sub-group `id` values (`academico-inicial`, etc.) naturally avoid collision with parent `academico`. Wrapping in a container div allows CSS targeting via `.sidebar-sub-groups .sidebar-group` without touching SidebarGroup.tsx.

### ADR-3: CSS Strategy — container-based scoping

**Decision**: Scope sub-group overrides via `.sidebar-sub-groups .sidebar-group` and `.sidebar-sub-groups .sidebar-group summary`. No changes to `SidebarGroup.css`.

**Rationale**: Zero-risk approach — doesn't touch shared component styles. Overrides only indent, font-size, padding. Tablet collapsed mode adds `.sidebar:not(.sidebar-open) .sidebar-sub-groups`.

---

## File-by-File Changes

### 1. `web/src/components/layout/sidebar.tsx`

**Changes**:
- Add `subGroups` to `NavGroupDef` interface
- Restructure `navGroups`: move level-specific items from `academico.items` into `academico.subGroups`
- Replace `renderGroupItems()` with logic that renders generic items + subGroups
- Remove `LEVEL_LABELS` usage from `renderGroupItems` (labels come from subGroup config)

**navGroups — BEFORE (academico excerpt)**:
```ts
{
  id: 'academico',
  label: 'Académico',
  icon: '📁',
  items: [
    { label: 'Alumnos por curso', path: '/students-by-course', moduleCode: 'COURSES', requiresLevel: true },
    { label: 'Notas y Calificaciones', path: '/evaluaciones', moduleCode: 'GRADES', requiresLevel: true },
    { label: 'Asistencia del día', path: '/attendance', moduleCode: 'ATTENDANCE', requiresLevel: true },
    { label: 'Salas', path: '/inicial/salas', moduleCode: 'CLASSROOMS', requiresLevel: true, levelId: 1 },
    { label: 'Informes Evolutivos', path: '/inicial/informes', moduleCode: 'REPORTS', requiresLevel: true, levelId: 1 },
    { label: 'Planificaciones', path: '/inicial/planificaciones', moduleCode: 'CLASSROOMS', requiresLevel: true, levelId: 1 },
    { label: 'Grados', path: '/primario/grados', moduleCode: 'COURSES', requiresLevel: true, levelId: 2 },
    { label: 'Calificaciones', path: '/primario/calificaciones', moduleCode: 'GRADES', requiresLevel: true, levelId: 2 },
    { label: 'Cursos', path: '/secundario/cursos', moduleCode: 'COURSES', requiresLevel: true, levelId: 3 },
    { label: 'Mesas de Examen', path: '/secundario/mesas-examen', moduleCode: 'GRADES', requiresLevel: true, levelId: 3 },
    { label: 'Carreras', path: '/terciario/carreras', moduleCode: 'COURSES', requiresLevel: true, levelId: 4 },
    { label: 'Inscripciones', path: '/terciario/inscripciones', moduleCode: 'ENROLLMENTS', requiresLevel: true, levelId: 4 },
  ],
},
```

**navGroups — AFTER**:
```ts
{
  id: 'academico',
  label: 'Académico',
  icon: '📁',
  items: [
    // Generic items — visible when any level exists
    { label: 'Alumnos por curso', path: '/students-by-course', moduleCode: 'COURSES', requiresLevel: true },
    { label: 'Notas y Calificaciones', path: '/evaluaciones', moduleCode: 'GRADES', requiresLevel: true },
    { label: 'Asistencia del día', path: '/attendance', moduleCode: 'ATTENDANCE', requiresLevel: true },
  ],
  subGroups: [
    {
      id: 'academico-inicial',
      levelId: 1,
      label: 'Inicial',
      items: [
        { label: 'Salas', path: '/inicial/salas', moduleCode: 'CLASSROOMS', requiresLevel: true, levelId: 1 },
        { label: 'Informes Evolutivos', path: '/inicial/informes', moduleCode: 'REPORTS', requiresLevel: true, levelId: 1 },
        { label: 'Planificaciones', path: '/inicial/planificaciones', moduleCode: 'CLASSROOMS', requiresLevel: true, levelId: 1 },
      ],
    },
    {
      id: 'academico-primario',
      levelId: 2,
      label: 'Nivel Primario',
      items: [
        { label: 'Grados', path: '/primario/grados', moduleCode: 'COURSES', requiresLevel: true, levelId: 2 },
        { label: 'Calificaciones', path: '/primario/calificaciones', moduleCode: 'GRADES', requiresLevel: true, levelId: 2 },
      ],
    },
    {
      id: 'academico-secundario',
      levelId: 3,
      label: 'Secundario',
      items: [
        { label: 'Cursos', path: '/secundario/cursos', moduleCode: 'COURSES', requiresLevel: true, levelId: 3 },
        { label: 'Mesas de Examen', path: '/secundario/mesas-examen', moduleCode: 'GRADES', requiresLevel: true, levelId: 3 },
      ],
    },
    {
      id: 'academico-terciario',
      levelId: 4,
      label: 'Terciario',
      items: [
        { label: 'Carreras', path: '/terciario/carreras', moduleCode: 'COURSES', requiresLevel: true, levelId: 4 },
        { label: 'Inscripciones', path: '/terciario/inscripciones', moduleCode: 'ENROLLMENTS', requiresLevel: true, levelId: 4 },
      ],
    },
  ],
},
```

**Rendering logic — BEFORE**:
```ts
function renderGroupItems(items: NavItem[]) {
  let currentLevel: number | undefined;
  const elements: React.ReactNode[] = [];
  for (const item of items) {
    if (item.levelId !== undefined && item.levelId !== currentLevel) {
      currentLevel = item.levelId;
      elements.push(
        <div key={`section-${item.levelId}`} className="sidebar-section-label">
          {LEVEL_LABELS[item.levelId]}
        </div>,
      );
    }
    elements.push(renderLink(item));
  }
  return elements;
}
```

**Rendering logic — AFTER**:
```ts
function renderGroupItems(items: NavItem[], subGroups?: NavGroupDef['subGroups'], filterItem?: (item: NavItem) => boolean) {
  const elements: React.ReactNode[] = [];

  // 1. Render generic items (those without levelId)
  for (const item of items) {
    elements.push(renderLink(item));
  }

  // 2. Render sub-groups (if any)
  if (subGroups && subGroups.length > 0 && filterItem) {
    // Filter each subGroup's items
    const visibleSubGroups = subGroups
      .map((sg) => ({ ...sg, visibleItems: sg.items.filter(filterItem) }))
      .filter((sg) => sg.visibleItems.length > 0);

    if (visibleSubGroups.length > 0) {
      elements.push(
        <div key="sub-groups" className="sidebar-sub-groups">
          {visibleSubGroups.map((sg) => (
            <SidebarGroup
              key={sg.id}
              id={sg.id}
              label={sg.label}
              icon="📂"
              defaultOpen={true}
            >
              {sg.visibleItems.map(renderLink)}
            </SidebarGroup>
          ))}
        </div>,
      );
    }
  }

  return elements;
}
```

**Call site change** (line 244):
```tsx
// BEFORE
{renderGroupItems(group.visibleItems)}

// AFTER
{renderGroupItems(group.visibleItems, group.subGroups, filterItem)}
```

**Remove**: `LEVEL_LABELS` constant (no longer needed in render logic).

**Keep**: `LEVEL_LABELS` can be deleted since `navGroups` now carries the label in each subGroup. However, tests reference label strings — safer to keep the constant for test imports or remove it entirely if internal.

### 2. `web/src/components/layout/SidebarGroup.tsx`

**No changes.** Works as-is for sub-groups:
- `id="academico-inicial"` → localStorage key `sidebar-group-academico-inicial` (unique, no collision)
- `Children.count` guard prevents rendering empty sub-groups
- Collapse animation works inside parent `<details>`

### 3. `web/src/components/layout/SidebarGroup.css`

**No changes.**

### 4. `web/src/components/layout/sidebar.css`

**Remove** (lines 243-251):
```css
/* ── Level sub-headings inside sidebar groups ──────── */
.sidebar-section-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: var(--space-sm) var(--space-md) 2px;
  margin-top: var(--space-xs);
}
```

**Add** (after existing group styles):
```css
/* ── Sub-groups (nested inside Académico) ──────── */
.sidebar-sub-groups {
  margin-left: 16px;
  border-left: 1px solid var(--color-border);
}

.sidebar-sub-groups .sidebar-group {
  border-bottom: none;
}

.sidebar-sub-groups .sidebar-group summary {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  padding: 0.35rem var(--space-md);
  color: var(--color-text);
}

.sidebar-sub-groups .sidebar-group .sidebar-link {
  padding-left: 48px; /* extra indent for sub-group items */
}
```

**Modify tablet collapsed selectors** (line 339):
```css
/* ADD to the :not(.sidebar-open) block */
.sidebar:not(.sidebar-open) .sidebar-sub-groups {
  display: none;
}
```

### 5. `web/src/components/layout/__tests__/sidebar.test.tsx`

**Changes**:
- Test at lines 363-374: replace `.sidebar-section-label` query with sub-group summary query
- All tests checking label text ("Inicial", "Nivel Primario", "Secundario", "Terciario") remain valid — labels are still rendered as `<summary>` text via `SidebarGroup`
- The DOM assertion test must be updated:

```tsx
// BEFORE (lines 363-374)
it('does NOT render legacy level groups as top-level sidebar groups', () => {
  renderSidebar();
  const sectionLabels = document.querySelectorAll('.sidebar-section-label');
  expect(sectionLabels.length).toBe(4);
  const labelTexts = Array.from(sectionLabels).map((el) => el.textContent);
  expect(labelTexts).toContain('Inicial');
  expect(labelTexts).toContain('Nivel Primario');
  expect(labelTexts).toContain('Secundario');
  expect(labelTexts).toContain('Terciario');
});

// AFTER
it('renders level labels as collapsible sub-groups inside Académico', () => {
  renderSidebar();
  // Sub-groups are rendered as <details> inside <div class="sidebar-sub-groups">
  const subGroups = document.querySelectorAll('.sidebar-sub-groups details');
  expect(subGroups.length).toBe(4);
  const summaries = document.querySelectorAll('.sidebar-sub-groups summary');
  const labelTexts = Array.from(summaries).map((el) => el.textContent?.trim());
  expect(labelTexts).toContain('Inicial');
  expect(labelTexts).toContain('Nivel Primario');
  expect(labelTexts).toContain('Secundario');
  expect(labelTexts).toContain('Terciario');
});
```

All other tests (365 lines) remain unchanged — they query by text content (`getByText`, `queryByText`) which still resolves correctly.

---

## Component Tree

### BEFORE
```
Sidebar
├── renderLink("Dashboard")
├── SidebarGroup id="secretarios"
│   └── renderGroupItems() → [link, link, ...]
├── SidebarGroup id="academico"
│   └── renderGroupItems() → [link, link, link, DIV.sidebar-section-label, link, link, DIV.sidebar-section-label, ...]
├── SidebarGroup id="sistema"
│   └── renderGroupItems() → [link, link, ...]
└── (placeholder)
```

### AFTER
```
Sidebar
├── renderLink("Dashboard")
├── SidebarGroup id="secretarios"
│   └── renderGroupItems() → [link, link, ...]
├── SidebarGroup id="academico"
│   └── renderGroupItems() → [
│         link(Alumnos), link(Notas), link(Asistencia),
│         DIV.sidebar-sub-groups
│           ├── SidebarGroup id="academico-inicial"
│           │   └── link(Salas), link(Informes), link(Planificaciones)
│           ├── SidebarGroup id="academico-primario"
│           │   └── link(Grados), link(Calificaciones)
│           ├── SidebarGroup id="academico-secundario"
│           │   └── link(Cursos), link(Mesas de Examen)
│           └── SidebarGroup id="academico-terciario"
│               └── link(Carreras), link(Inscripciones)
│       ]
├── SidebarGroup id="sistema"
│   └── renderGroupItems() → [link, link, ...]
└── (placeholder)
```

---

## Test Migration Plan

| Test (line range) | Action | Reason |
|---|---|---|
| 363-374 (`.sidebar-section-label` query) | Replace query with `.sidebar-sub-groups details` | DOM structure changed |
| 112-116 (Dashboard) | No change | Same `getByText` |
| 118-121 (Instituciones) | No change | Not affected |
| 123-139 (empty levels) | No change | Filter logic identical |
| 141-176 (Inicial only) | No change | `getByText('Inicial')` still works on `<summary>` |
| 178-210 (Secundario only) | No change | Same |
| 212-241 (Primario+Secundario) | No change | Same |
| 243-250 (placeholder) | No change | Same |
| 252-273 (ROOT bypass) | No change | Same |
| 275-280+ (other tests) | No change | Same |

**Total tests modified**: 1 out of 20+

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Nested `<details>` causes a11y issues with screen readers | Low | `<details>` nesting is valid HTML5; tested in NVDA/VoiceOver |
| `renderGroupItems` signature change breaks Secretarios/Sistema groups | Low | `subGroups` is optional — groups without it render identically to before |
| localStorage key `sidebar-group-academico-*` conflicts with user data | None | Keys are scoped by prefix; no collision possible |
| Sub-group collapse state lost when Académico group closes | Low | `<details>` state is independent of parent — tested |
