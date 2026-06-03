# Delta for Sidebar Navigation

## MODIFIED Requirements

### Requirement: Level Sub-Sections in Académico

The sidebar MUST render level-specific items under collapsible sub-groups (Inicial, Nivel Primario, Secundario, Terciario) within the Académico group. Level sub-groups SHALL NOT appear as separate top-level sidebar groups. Sub-groups SHALL be `<details>/<summary>` elements using the `SidebarGroup` component pattern — never static `<div>` elements. Each sub-group MUST collapse and expand independently. Collapse state MUST persist in localStorage using a unique key per sub-group (e.g., `sidebar-group-academico-inicial`). These keys MUST NOT collide with the parent Académico group key.

(Previously: sub-headings were static `<div>` elements with `.sidebar-section-label` class — `<details>` was explicitly prohibited.)

#### Scenario: Level items nested under Académico as collapsible sub-groups

- GIVEN the sidebar is rendered
- WHEN Académico is expanded
- THEN each visible level sub-group renders as a `<details>/<summary>` element nested inside Académico
- AND no level group appears as a top-level sidebar group

#### Scenario: Sub-group toggle on click

- GIVEN Académico is expanded and a level sub-group is visible
- WHEN the user clicks the sub-group's `<summary>`
- THEN the sub-group collapses, hiding its level-specific items
- AND clicking again expands it, showing those items

#### Scenario: Collapse state persists across page reloads

- GIVEN a level sub-group has been collapsed by the user
- WHEN the page is reloaded
- THEN that sub-group remains collapsed
- AND other sub-groups retain their own independent state

#### Scenario: localStorage key isolation per sub-group

- GIVEN multiple level sub-groups are visible
- WHEN each sub-group's collapse state is persisted
- THEN each sub-group writes to a distinct localStorage key (e.g., `sidebar-group-academico-inicial`, `sidebar-group-academico-primario`)
- AND none of these keys matches the parent Académico group's localStorage key

#### Scenario: Generic items render before sub-groups

- GIVEN Académico is expanded with both generic items and level sub-groups
- WHEN the sidebar renders
- THEN generic items (Alumnos por curso, Notas, Asistencia) appear before any sub-group
- AND no generic item is nested inside a sub-group

### Requirement: Sub-Heading Visibility

A level sub-group MUST only appear when at least one visible item exists for that level after all filters are applied.

(Previously: "Sub-Heading Visibility" used the same logic but referred to static `<div>` sub-headings; now applies to `<details>/<summary>` sub-groups.)

#### Scenario: Empty sub-group hidden

- GIVEN institution has only Inicial configured and user is NOT ROOT
- WHEN Académico renders
- THEN the "Inicial" `<details>` sub-group appears
- AND Primario, Secundario, Terciario `<details>` sub-groups do NOT appear

#### Scenario: All items filtered removes sub-group

- GIVEN all items for a level are filtered by module or level access rules
- WHEN Académico renders
- THEN that level's `<details>` sub-group does NOT appear

### Requirement: Test Suite Compatibility

The existing sidebar test suite SHALL continue to pass after restructure, with appropriate test updates to reflect the new DOM structure.

(Previously: tests queried `.sidebar-section-label` elements; now MUST query `<summary>` elements or `<details>` containers.)

#### Scenario: Tests pass with updated structure

- GIVEN sidebar code is restructured with `<details>/<summary>` sub-groups
- WHEN the test suite runs
- THEN all tests pass with updated assertions targeting `<summary>` instead of `.sidebar-section-label`

### Requirement: Tablet Collapsed Mode Hides Sub-Groups

`<details>` sub-group elements inside Académico MUST be hidden in tablet collapsed mode (56px icon-only state). The CSS selector MUST target the new `<details>` elements within `.sidebar:not(.sidebar-open)`.

(Previously: targeted `.sidebar-section-label` static `<div>` elements; now MUST target `<details>` sub-groups instead.)

#### Scenario: Tablet collapse hides sub-groups

- GIVEN the sidebar is in tablet collapsed (56px icon-only) mode
- WHEN level sub-groups are present in the DOM
- THEN `<details>` sub-group elements are not visible (`display: none`)

#### Scenario: Tablet expanded shows sub-groups

- GIVEN the sidebar is in tablet expanded (240px) mode
- WHEN Académico is open and level sub-groups are present
- THEN `<details>` sub-group elements are visible

## ADDED Requirements

### Requirement: Sub-Group Styling

Level sub-groups inside Académico MUST be visually distinct from top-level sidebar groups. Sub-groups MUST be indented (48px left indent), use a smaller font size than top-level groups, and display no icon or a smaller chevron. Sub-groups MUST NOT be styled to look like top-level `SidebarGroup` entries.

#### Scenario: Sub-group is visually indented

- GIVEN a level sub-group is visible inside Académico
- WHEN the sidebar renders
- THEN the sub-group's `<summary>` has 48px left indentation
- AND its font size is smaller than a top-level sidebar group label

#### Scenario: Sub-group has no icon or a reduced chevron

- GIVEN a level sub-group is visible
- WHEN the sidebar renders
- THEN the sub-group displays no icon, or a chevron smaller than the parent group's chevron
- AND the sub-group is not visually mistakable for a top-level sidebar group

### Requirement: localStorage Key Isolation

Each level sub-group MUST use a unique, predictable localStorage key in the format `sidebar-group-academico-{level}` (e.g., `sidebar-group-academico-inicial`, `sidebar-group-academico-primario`, `sidebar-group-academico-secundario`, `sidebar-group-academico-terciario`). These keys MUST NOT collide with each other or with the parent Académico group key.

#### Scenario: Each level has a unique key

- GIVEN all four level sub-groups are visible
- WHEN each sub-group's open/closed state is stored
- THEN localStorage contains four distinct keys, one per level
- AND none matches the Académico parent key

#### Scenario: No collision with parent key

- GIVEN the Académico group stores its own collapse state under a key (e.g., `sidebar-group-academico`)
- WHEN a level sub-group stores its state
- THEN the sub-group's key differs from the parent key
- AND writing the sub-group state does NOT overwrite the parent state
