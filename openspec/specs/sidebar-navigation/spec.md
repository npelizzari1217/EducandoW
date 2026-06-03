# Sidebar Navigation Specification

## Purpose

Defines how the sidebar renders pedagogical level sub-sections within Académico and filters visibility based on institution `config.levels`.

## Requirements

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

### Requirement: Level Filtering by Institution Config

Level-specific items SHALL only appear when the authenticated user's `levels` array (from JWT) includes a composite code whose base level (`Math.floor(code / 10)`) matches the item's `requiresLevelCode`. If the user's `levels` array is empty, no level sub-headings SHALL appear for non-ROOT users.

(Previously: filtering used institution `config.levels` array — user's own level was ignored entirely.)

#### Scenario: User with matching level sees sub-heading

- GIVEN a non-ROOT user with JWT `levels: [20]` (Primario)
- WHEN the sidebar renders
- THEN only the "Nivel Primario" sub-heading and its items appear
- AND Inicial, Secundario, Terciario sub-headings do NOT appear

#### Scenario: User with multiple levels sees multiple sub-headings

- GIVEN a non-ROOT user with JWT `levels: [10, 30, 31]` (Inicial + two Secundario modalities)
- WHEN the sidebar renders
- THEN "Inicial" and "Secundario" sub-headings appear
- AND Primario and Terciario sub-headings do NOT appear

#### Scenario: User with no levels sees no level sub-headings

- GIVEN a non-ROOT user with JWT `levels: []`
- WHEN the sidebar renders
- THEN no level sub-headings appear
- AND generic `requiresLevel` items do NOT appear

#### Scenario: Single non-Inicial level

- GIVEN a non-ROOT user with JWT `levels: [30]` (Secundario only)
- WHEN the sidebar renders
- THEN only "Secundario" sub-heading and its items appear

#### Scenario: All four base levels covered

- GIVEN a non-ROOT user with JWT `levels: [10, 20, 30, 40]`
- WHEN the sidebar renders
- THEN all four sub-headings and their items appear

### Requirement: ROOT Bypass

ROOT users MUST see all level-specific items and sub-headings regardless of their own `levels` array or the institution `config.levels`.

(Previously: ROOT bypassed institution `config.levels`; now also bypasses user `levels` — behavior identical, source clarified.)

#### Scenario: ROOT with empty levels array sees all sub-headings

- GIVEN a ROOT user with JWT `levels: []`
- WHEN the sidebar renders
- THEN all four sub-headings and their items appear

#### Scenario: ROOT always sees all sub-headings

- GIVEN a ROOT user with any `levels` value
- WHEN the sidebar renders
- THEN all four sub-headings and their items appear

### Requirement: Sub-Group Visibility

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

### Requirement: Generic Items Unaffected

Generic Académico items (Alumnos por curso, Calificaciones parciales, Asistencia del día) MUST continue using existing `requiresLevel` logic — they appear when ANY level is present, with no `levelId` constraint.

#### Scenario: Generic items with any level

- GIVEN a non-ROOT user with `baseLevels = {3}` (Secundario)
- WHEN Académico renders
- THEN generic `requiresLevel` items appear
- AND only "Secundario" sub-heading appears

#### Scenario: Generic items hidden without levels

- GIVEN a non-ROOT user with `baseLevels` empty
- WHEN Académico renders
- THEN generic `requiresLevel` items do NOT appear

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

### Requirement: Test Suite Compatibility

The existing sidebar test suite SHALL continue to pass after restructure, with appropriate test updates to reflect the new DOM structure. `App.test.tsx` MUST use ES module imports only — `require()` calls are prohibited and MUST be replaced with named `import` statements.

(Previously: only required updating selectors from `.sidebar-section-label` to `<summary>`; now also requires replacing `require('react-router-dom')` with ES module import in `App.test.tsx`.)

#### Scenario: Tests pass with updated structure

- GIVEN sidebar code is restructured with `<details>/<summary>` sub-groups
- WHEN the test suite runs
- THEN all tests pass with updated assertions targeting `<summary>` instead of `.sidebar-section-label`

#### Scenario: App.test.tsx uses ES module import

- GIVEN `App.test.tsx` previously contained `require('react-router-dom')` at line 44
- WHEN the test file is corrected
- THEN the `require` is replaced with a named ES import
- AND `pnpm --filter web lint` reports 0 errors for this file

### Requirement: ESLint Compliance in Web Package

`App.test.tsx` MUST use ES module `import` syntax only. `require()` calls inside ES modules are prohibited by the project's ESLint config. Running `pnpm lint` in the web package MUST exit with 0 errors.

#### Scenario: App.test.tsx uses import instead of require

- GIVEN `App.test.tsx` at line 44 previously used `require('react-router-dom')`
- WHEN the file is inspected after the fix
- THEN the `require` call is replaced with `import { Outlet } from 'react-router-dom'` (or equivalent named import)
- AND no `require` call exists anywhere in `App.test.tsx`

#### Scenario: pnpm lint passes in web package

- GIVEN the web package source files are unchanged except for the import fix
- WHEN `pnpm --filter web lint` runs
- THEN the command exits with code 0
- AND no ESLint errors are reported

#### Scenario: Import fix does not break existing test assertions

- GIVEN `App.test.tsx` tests that relied on the `Outlet` symbol
- WHEN the `require` is replaced with an ES import
- THEN all existing test cases in `App.test.tsx` continue to pass
- AND no new type errors are introduced

#### Scenario: Other test files are unaffected

- GIVEN only `App.test.tsx` line 44 is modified
- WHEN the full test suite runs with `pnpm --filter web test`
- THEN all previously passing tests continue to pass

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

### Requirement: No Dead Navigation Links

The sidebar MUST NOT contain links pointing to routes that have no corresponding route definition in the React Router tree. `/students-by-course`, `/smtp-config`, and `/websocket-config` MUST be either removed from the sidebar or replaced with a route-guarded placeholder that renders correctly. A link is considered dead if navigating to it produces a 404 or blank page.

#### Scenario: Dead links removed from sidebar

- GIVEN the sidebar renders with default navigation items
- WHEN a user inspects the sidebar DOM
- THEN no `<a>` or `<Link>` element points to `/students-by-course`, `/smtp-config`, or `/websocket-config`

#### Scenario: Navigation to previously dead routes does not 404

- GIVEN routes have been defined for the previously missing paths (if added) OR the nav items have been removed
- WHEN a user clicks every visible sidebar link
- THEN each link navigates to a rendered component
- AND no blank page or React Router "No match" state appears

#### Scenario: Removing a dead link does not break layout

- GIVEN the sidebar has 3 fewer items after dead link removal
- WHEN the sidebar renders
- THEN all remaining items retain their correct order, indentation, and styling
- AND no empty group containers are left visible

#### Scenario: ROOT sees no dead links

- GIVEN a ROOT user is authenticated
- WHEN the sidebar renders with all admin-level items visible
- THEN none of the visible links points to an unregistered route
