# Delta for Sidebar Navigation

## ADDED Requirements

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

## MODIFIED Requirements

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
