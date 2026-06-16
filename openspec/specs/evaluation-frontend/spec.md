# Evaluation Frontend Specification

> **RETIRED** — All requirements in this spec are superseded by change `retiro-evaluaciones-legacy-s1` (archived 2026-06-16).
> The four legacy grading pages (EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage) and their backing endpoints have been removed from the application surface. Data is preserved in the DB schema (SubjectAssignment, Evaluacion, NotaTrimestral models intact; no migration). Boletin PDF generation is unaffected (reads via raw Prisma client, not these pages/endpoints).
> Remaining work: S2 (boletin lookup migration to DocenteXCiclo), S3 (data archival + schema drop) — see umbrella `openspec/changes/retiro-teacher-legacy/explore.md`.

## Purpose

Replaces broken GradesPage with four pages on existing endpoints.

## Requirements

| Page | MUST use endpoints | Actions |
|------|--------------------|---------|
| EvaluacionesPage | GET/POST/DELETE `/evaluaciones` | List, create (form), delete (confirm) |
| NotasPage | GET/POST `/notas` | Grade grid by evaluacion; entry per student |
| PeriodosPage | GET/POST/DELETE `/periodos` | List, create (form), delete (confirm) |
| NotasTrimestralesPage | GET/POST `/notas-trimestrales` | View/save consolidated grades |

### Requirement: EvaluacionesPage

MUST list, create, and delete evaluaciones. Delete requires confirmation.

#### Scenario: CRUD evaluaciones
- GIVEN user on `/evaluaciones`
- WHEN page loads / form submitted / delete confirmed
- THEN GET/POST/DELETE called respectively; table updated

### Requirement: NotasPage

MUST render grade grid (students as rows). Entry MUST call `POST /notas` with `{ evaluacionId, studentId, value }`.

#### Scenario: Load grid and enter grade
- GIVEN evaluacion selected
- THEN one row per student; submitted grade calls POST

### Requirement: PeriodosPage

MUST support full CRUD via GET/POST/DELETE `/periodos`.

#### Scenario: CRUD periodos
- GIVEN user on `/periodos`
- THEN same GET/POST/DELETE pattern as EvaluacionesPage

### Requirement: NotasTrimestralesPage

MUST load `GET /notas-trimestrales?periodoId` and save via `POST /notas-trimestrales`.

#### Scenario: View consolidated grades
- GIVEN period with notas → consolidated grid shown on open

### Requirement: Sidebar and Route Update

MUST remove `/grades`; MUST add `/evaluaciones`, `/periodos`, `/notas-trimestrales` in App.tsx and sidebar.

#### Scenario: Routes updated
- GIVEN sidebar renders → no `/grades`; new links resolve without 404
