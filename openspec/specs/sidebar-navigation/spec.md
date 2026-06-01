# Sidebar Navigation Specification

## Purpose

Defines how the sidebar renders pedagogical level sub-sections within Académico and filters visibility based on institution `config.levels`.

## Requirements

### Requirement: Level Sub-Sections in Académico

The sidebar MUST render level-specific items under sub-headings (Inicial, Nivel Primario, Secundario, Terciario) within the Académico group. Level sub-headings SHALL NOT appear as separate top-level groups. Sub-headings SHALL be static `<div>` elements with `.sidebar-subheading` class — never `<details>`.

#### Scenario: Level items nested under Académico

- GIVEN the sidebar is rendered
- WHEN Académico is expanded
- THEN level-specific items appear under their sub-headings inside Académico
- AND no level group appears as a top-level sidebar group

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

### Requirement: Sub-Heading Visibility

A level sub-heading MUST only appear when at least one visible item exists for that level.

#### Scenario: Empty sub-group hidden

- GIVEN institution has only Inicial configured and user is NOT ROOT
- WHEN Académico renders
- THEN "Inicial" sub-heading appears (items exist)
- AND Primario/Secundario/Terciario sub-headings do NOT appear (no visible items)

#### Scenario: All items filtered removes sub-heading

- GIVEN all items for a level are filtered by additional access rules
- WHEN Académico renders
- THEN that level's sub-heading does NOT appear

### Requirement: Generic Items Unaffected

Generic Académico items (Alumnos por curso, Calificaciones parciales, Asistencia) MUST continue using existing `requiresLevel` logic — visible when ANY level exists.

#### Scenario: Generic items with any level

- GIVEN institution has `config.levels = [30]` and user is NOT ROOT
- WHEN Académico renders
- THEN generic `requiresLevel` items appear
- AND only "Secundario" sub-heading appears

#### Scenario: Generic items hidden without levels

- GIVEN institution has `config.levels = []` and user is NOT ROOT
- WHEN Académico renders
- THEN generic `requiresLevel` items do NOT appear

### Requirement: Test Suite Compatibility

The existing sidebar test suite SHALL continue to pass after restructure, with appropriate test updates.

#### Scenario: Tests pass with updated structure

- GIVEN sidebar code is restructured with subGroups
- WHEN the test suite runs
- THEN all tests pass with updated assertions for Académico sub-headings

#### Scenario: Tablet collapse hides sub-headings

- GIVEN sidebar is in tablet collapsed (icon-only) mode
- WHEN sub-headings are present
- THEN sub-headings are hidden via `display: none`
