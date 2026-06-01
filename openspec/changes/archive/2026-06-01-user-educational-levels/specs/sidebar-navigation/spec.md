# Delta for Sidebar Navigation

## MODIFIED Requirements

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

## REMOVED Requirements

_(none — existing requirements for Level Sub-Sections, Sub-Heading Visibility, Generic Items Unaffected, and Test Suite Compatibility are unchanged and remain in the canonical spec.)_
