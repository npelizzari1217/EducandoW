# Web Dependencies Specification

## Purpose

Establishes that `web` consumes types from `@educandow/domain` as the single source of truth, eliminating duplicated type definitions in the presentation layer.

## Requirements

### Requirement: Domain Package as Web Dependency

The `web` package MUST declare `@educandow/domain` as a workspace dependency in `web/package.json`. The TypeScript compiler MUST resolve imports from `@educandow/domain` without path hacks. Duplicate type definitions in `web/src/types/` MUST be replaced with re-exports or direct imports from the domain package.

#### Scenario: Domain types resolve at compile time

- GIVEN `@educandow/domain` is listed in `web/package.json` dependencies
- WHEN `pnpm install` runs at workspace root
- THEN `import { Level } from '@educandow/domain'` resolves without TypeScript errors in any web source file

#### Scenario: levels.ts uses domain catalog

- GIVEN `web/src/constants/levels.ts` previously defined a local `Level` catalog
- WHEN the integration is applied
- THEN `levels.ts` imports and re-exports the `Level` catalog from `@educandow/domain`
- AND no duplicate `Level` definition exists in the web package

#### Scenario: academic-cycle.ts uses domain types

- GIVEN `web/src/types/academic-cycle.ts` previously defined its own `AcademicCycle` shape
- WHEN the integration is applied
- THEN the file imports domain types where shapes are compatible
- AND no field defined in `@educandow/domain` is redeclared locally

#### Scenario: course-cycle.ts uses domain types

- GIVEN `web/src/types/course-cycle.ts` previously defined its own `CourseCycle` shape
- WHEN the integration is applied
- THEN the file imports domain types where shapes are compatible
- AND no field defined in `@educandow/domain` is redeclared locally

#### Scenario: pnpm install succeeds after adding dependency

- GIVEN `@educandow/domain` is added to `web/package.json`
- WHEN `pnpm install` runs at workspace root
- THEN the command exits with code 0 and no resolution errors are reported
