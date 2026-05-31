# Design: Sidebar Reorganization + Level-Based Access Filtering

## Technical Approach

Flatten the four level groups (Inicial, Nivel Primario, Secundario, Terciario) into Académico's `items` array, annotating each item with `levelId`. Derive `configuredLevels: Set<number>` from composite codes via `Math.floor(code / 10)`. Filter level-specific items by set membership (ROOT bypasses). Inject `.sidebar-section-label` sub-headings during render when `levelId` changes between consecutive visible items. SidebarGroup component stays unchanged. No API or backend changes.

## Architecture Decisions

### Decision: Flat `levelId` on NavItem vs subGroups on NavGroupDef

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `subGroups?: NavSubGroupDef[]` on NavGroupDef | Requires SidebarGroup.tsx changes; new group-level abstraction; proposal's approach | ✗ |
| `levelId?: number` on NavItem + render-time detection | No new interfaces; SidebarGroup unchanged; sub-headings injected by render function | ✓ |

**Rationale**: `levelId` is a natural extension of the existing `requiresLevel` flag. Keeps changes minimal — only NavItem interface, filter logic, and render function in `sidebar.tsx`. The render function detects `levelId` transitions in the flat item list and inserts `<div>` sub-headings — no component nesting or new props.

### Decision: Filter by base level extracted from composite codes

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Match exact composite code (`config.levels.includes(levelId)`) | `levelId` (1–4) never matches composite codes (10–49); wrong semantic | ✗ |
| `Math.floor(code / 10)` to extract base level into `Set<number>` | Correct semantic — a school with `[10, 11]` (Inicial Común + Talleres) should see ALL Inicial items | ✓ |

**Rationale**: A single item covers all modalities within a level (e.g., "Salas" for all Inicial modalities). Checking against the derived base level set is the correct abstraction — one set lookup per item.

### Decision: Generic `requiresLevel` items keep their existing behavior

**Choice**: Items like "Alumnos por curso", "Calificaciones parciales", "Asistencia del día" retain `requiresLevel: true` without `levelId`.

**Rationale**: These cross-cutting items should be visible whenever the institution has ANY level configured. Their existing filter logic (`hasLevels`) is unchanged and independent of the new level-specific filter.

## Data Flow

```
config.levels: number[]        user.role
        │                           │
        ▼                           ▼
configuredLevels:             bypass = role === 'ROOT'
  Set<number>                        │
  (Math.floor(code/10))              │
        │                           │
        └───────────┬───────────────┘
                    ▼
          makeFilterItem(item)
              │           │
  levelId set?│           │requiresLevel?
        │     │           │
        ▼     │           ▼
  bypass ||  │    bypass || hasLevels
  set.has(id)│
        │     │
        └──┬──┘
           ▼
     visibleItems[]
           │
           ▼
renderWithSubHeadings(items)
  — detects levelId transitions
  — inserts <div class="sidebar-section-label">
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/layout/sidebar.tsx` | Modify | Add `levelId` to NavItem; define `LEVEL_LABELS` constant; derive `configuredLevels` from composite codes; update `makeFilterItem` with level check; flatten 4 level groups into Académico items; add `renderWithSubHeadings` function replacing `group.visibleItems.map(renderLink)` |
| `web/src/components/layout/sidebar.css` | Modify | Add `.sidebar-section-label` — subtle muted style; add `display: none` in tablet collapsed media query |
| `web/src/components/layout/__tests__/sidebar.test.tsx` | Modify | Change mock levels from `[1,2,3,4]` to composite codes `[10,20,30,40]`; add tests: single-level filtering, ROOT sees all level items, sub-heading rendering, tablet collapse |

## Interfaces

```ts
// NavItem — one new optional field
interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  requiresLevel?: boolean;
  levelId?: number;  // NEW: 1=Inicial, 2=Primario, 3=Secundario, 4=Terciario
  featureFlag?: 'send_email' | 'send_messages';
}
// NavGroupDef unchanged — old level groups absorbed into Académico.items
```

## Key Constants

```ts
const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial', 2: 'Nivel Primario', 3: 'Secundario', 4: 'Terciario',
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — Filter | Institution with only Inicial (`levels: [10, 11]`) shows only `levelId: 1` items | Assert Secundario/Terciario items absent |
| Unit — Filter | ROOT with empty `config.levels` sees all level items | Assert all 4 sub-headings + items rendered |
| Unit — Filter | Generic `requiresLevel` items hidden when `levels: []` (non-ROOT) | Existing test — update assertions |
| Unit — Render | Sub-headings `<div>` inserted between level groups in Académico | Query `.sidebar-section-label` elements |
| Unit — Render | Tablet collapsed mode hides `.sidebar-section-label` | CSS rule test via media query |
| Unit — Render | All existing tests pass after restructure | Run full suite |

## Migration / Rollout

No migration required. No API, DB, or backend changes. Pure presentation-layer refactor. Rollback: revert `sidebar.tsx`, `sidebar.css`, and test file via git.

## Open Questions

- [ ] Sub-heading label format: confirm (1→'Inicial', 2→'Nivel Primario', 3→'Secundario', 4→'Terciario') match UX expectations. Current top-level groups use 'Inicial' and 'Nivel Primario' — the sub-headings mirror those.
- [ ] `.sidebar-section-label` style: match existing `.sidebar-group summary` style (uppercase, muted, no cursor) or be visually distinct?
