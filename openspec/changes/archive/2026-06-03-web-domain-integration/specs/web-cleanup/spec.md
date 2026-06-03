# Web Cleanup Specification

## Purpose

Governs removal of dead code (empty directories) and reduction of TypeScript `any` warnings in the web package to maintain a clean, lintable codebase.

## Requirements

### Requirement: Empty Directory Removal

The directories `web/src/contexts/`, `web/src/institucional/`, `web/src/pedagogico/`, and `web/src/shared/` MUST be removed from the repository if they contain no source files. No import in the web package MAY reference these paths after cleanup.

#### Scenario: Empty directories are absent after change

- GIVEN the directories exist but contain no files
- WHEN the change is applied
- THEN `web/src/contexts/`, `web/src/institucional/`, `web/src/pedagogico/`, and `web/src/shared/` no longer exist in the file tree

#### Scenario: No broken imports after directory removal

- GIVEN the empty directories are removed
- WHEN `pnpm build` runs in the `web` package
- THEN the build exits with code 0 and reports no missing module errors

### Requirement: TypeScript any Warnings Below Threshold

The number of `any` type occurrences in `web/src/` MUST be fewer than 10 after applying domain types. `pnpm lint` in the `web` package MUST exit with 0 errors.

#### Scenario: Lint passes with zero errors

- GIVEN domain types replace previous `any` usages in hooks and type files
- WHEN `pnpm lint` runs in the `web` package
- THEN the command exits with 0 errors

#### Scenario: any count is below threshold

- GIVEN the refactoring replaces untyped API responses with domain types
- WHEN the TypeScript compiler checks `web/src/`
- THEN the total count of `any` type annotations is fewer than 10

#### Scenario: Test suite passes after cleanup

- GIVEN empty directories are removed and types are replaced
- WHEN `pnpm test` runs in the `web` package
- THEN all tests pass and no test references a deleted path
