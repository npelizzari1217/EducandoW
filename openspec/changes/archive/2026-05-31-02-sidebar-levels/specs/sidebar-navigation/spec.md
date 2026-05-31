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

Level-specific items SHALL only appear when the institution's `config.levels` includes a composite code whose base level (`Math.floor(code / 10)`) matches the item's `requiresLevelCode`.

#### Scenario: Single level institution

- GIVEN institution has `config.levels = [10, 11]` (Inicial only) and user is NOT ROOT
- WHEN the sidebar renders
- THEN only "Inicial" sub-heading and its items appear
- AND Primario, Secundario, Terciario sub-headings do NOT appear

#### Scenario: All four levels active

- GIVEN institution `config.levels` covers base levels 1, 2, 3, and 4
- WHEN the sidebar renders
- THEN all four sub-headings and their items appear

#### Scenario: Institution with no levels

- GIVEN institution has `config.levels = []` and user is NOT ROOT
- WHEN the sidebar renders
- THEN no level sub-headings appear
- AND generic `requiresLevel` items do NOT appear

#### Scenario: Single non-Inicial level

- GIVEN institution has `config.levels = [30]` (Secundario only) and user is NOT ROOT
- WHEN the sidebar renders
- THEN only "Secundario" sub-heading and its items appear

### Requirement: ROOT Bypass

ROOT users MUST see all level-specific items and sub-headings regardless of institution `config.levels`.

#### Scenario: ROOT with no configured levels

- GIVEN institution has `config.levels = []` and user role is ROOT
- WHEN the sidebar renders
- THEN all four sub-headings and their items appear

#### Scenario: ROOT with partial levels

- GIVEN institution has `config.levels = [10]` and user role is ROOT
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
