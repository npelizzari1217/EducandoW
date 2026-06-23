# Spec: asistencia-desde-alumnos-curso

**Pedagogical level:** level-agnostic — attendance is per CourseCycle across all levels (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO).

**RFC 2119 keywords apply throughout this document.**

---

## Overview

This spec governs two self-contained but co-deployed changes:

- **Part A** — Navigation shortcut: a button inside `AlumnosCursoCicloPanel` that routes to `/asistencia-mensual?ccId=<ccId>`.
- **Part B** — Student name enrichment: attendance responses (general and por-materia) expose `studentName` in "Apellido, Nombre" format; the grid renders names instead of raw UUIDs, sorted alphabetically.

---

## Naming Inconsistency Note (informational — NOT a defect)

The existing `findByCourseCycleEnriched` helper in `prisma-alumnos-x-curso-x-ciclo.repository.ts` returns student names in `"firstName lastName"` order. This change intentionally uses `"Apellido, Nombre"` (lastName-first) as mandated by `Student.fullName` (`${lastName}, ${firstName}`) and Argentine administrative convention. Reviewers MUST NOT treat this divergence as a defect.

---

## Part A — Navigation Button

### REQ-A1: Attendance button in AlumnosCursoCicloPanel

The component `AlumnosCursoCicloPanel` (file: `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`) SHALL render a button that, when activated, navigates the user to `/asistencia-mensual?ccId=<ccId>`, where `<ccId>` is the `courseCycleId` prop received by the panel.

### REQ-A2: Permission gate on the button

The attendance button SHALL be rendered only when the current user holds the `ATTENDANCE READ` permission, evaluated via the existing `useCan` hook. When the permission is absent, the button MUST NOT appear in the DOM (hidden, not disabled).

### REQ-A3: Query-param pre-selection on asistencia-mensual

The page `asistencia-mensual.tsx` (file: `web/src/pages/dashboard/asistencia-mensual.tsx`) SHALL:

1. On mount, read the `ccId` query parameter via `useSearchParams`.
2. If `ccId` is present, pre-select the corresponding course-cycle in the selector.
3. Default the attendance mode to GENERAL (per-course) regardless of any previous selection stored in component state.
4. If the course-cycle list is not yet loaded at the time the query param is read, defer the pre-selection until the list is available and apply it as soon as the list resolves (effect dependency on list + param).

### REQ-A4: No regression without ccId param

When the page is loaded without a `ccId` query parameter, it SHALL behave identically to the current behavior: no course-cycle is pre-selected, no mode is forced.

---

## Part B — Student Name Enrichment

### REQ-B1: studentName field in general attendance response

`AsistenciaGeneralResponse` SHALL include a `studentName: string` field formatted as `"${lastName}, ${firstName}"` (comma-space separated, lastName first).

### REQ-B2: studentName field in subject attendance response

`AsistenciaMateriaResponse` SHALL include a `studentName: string` field with the same `"${lastName}, ${firstName}"` format.

### REQ-B3: Backend enrichment — no N+1

Both `prisma-asistencia-general.repository.ts` and `prisma-asistencia-materia.repository.ts` SHALL retrieve the student's `firstName` and `lastName` in a **single** Prisma query using `include: { student: { select: { firstName: true, lastName: true } } }`. No secondary query or batch loader is permitted.

### REQ-B4: Alphabetical ordering

Both repositories SHALL order results by `[{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`. The previous `orderBy: { studentId: 'asc' }` ordering MUST be removed.

### REQ-B5: No DB migration

The enrichment MUST rely on the existing `student` relation already present in the `asistenciaXAlumnoXCursoXCiclo` Prisma model. No schema change and no new migration is permitted.

### REQ-B6: Domain entity stays ID-only

The domain entity `AsistenciaXAlumnoXCursoXCiclo` MUST NOT acquire `studentName` or any other student fields. The name enrichment is performed exclusively at the repository-to-DTO mapping boundary (controller mapper / response builder).

### REQ-B7: Grid renders studentName — general mode

In GENERAL mode the attendance grid SHALL render `row.studentName` in the student column. The previous `row.studentId` (raw UUID) MUST NOT be displayed.

### REQ-B8: Grid renders studentName — por-materia mode

In POR-MATERIA mode the attendance grid SHALL render `row.studentName` in the student column. The previous `row.studentId` (raw UUID) MUST NOT be displayed.

### REQ-B9: No new permissions

The existing authorization guards on the attendance endpoints SHALL remain unchanged. No new permission, role, or guard is introduced.

---

## Acceptance Scenarios

### Scenario A1-1: Authorized user sees the button

```
Given  the user holds ATTENDANCE READ permission
And    AlumnosCursoCicloPanel is rendered for courseCycleId = "cc-abc"
When   the panel mounts
Then   a button labelled with attendance intent SHALL be visible in the panel
And    the button's href or click handler targets "/asistencia-mensual?ccId=cc-abc"
```

### Scenario A1-2: Unauthorized user does not see the button

```
Given  the user does NOT hold ATTENDANCE READ permission
And    AlumnosCursoCicloPanel is rendered for courseCycleId = "cc-abc"
When   the panel mounts
Then   no attendance navigation button SHALL appear in the DOM
```

### Scenario A3-1: Pre-selection with ccId param — list already loaded

```
Given  the course-cycle list is already loaded (non-empty)
And    the user navigates to "/asistencia-mensual?ccId=cc-xyz"
When   the page mounts
Then   the course-cycle selector SHALL show "cc-xyz" as the selected value
And    the attendance mode SHALL be GENERAL
```

### Scenario A3-2: Pre-selection with ccId param — async list load

```
Given  the user navigates to "/asistencia-mensual?ccId=cc-xyz"
And    the course-cycle list is initially empty (loading)
When   the list resolves with an entry whose id = "cc-xyz"
Then   the course-cycle selector SHALL update to show "cc-xyz" as the selected value
And    the attendance mode SHALL remain GENERAL
```

### Scenario A3-3: Pre-selection with ccId param — ccId not in list

```
Given  the user navigates to "/asistencia-mensual?ccId=cc-unknown"
And    the course-cycle list resolves but contains no entry with id = "cc-unknown"
When   the list settles
Then   no course-cycle SHALL be pre-selected (selector shows placeholder/empty state)
And    no error SHALL be thrown
```

### Scenario A4-1: No ccId param — no regression

```
Given  the user navigates to "/asistencia-mensual" (no query params)
When   the page mounts
Then   the page behavior SHALL be identical to the pre-change behavior
And    no course-cycle SHALL be pre-selected by default
And    the attendance mode SHALL default to its prior initial value
```

### Scenario B1-B2-1: studentName included in general response

```
Given  the general attendance query returns rows for courseCycleId "cc-abc"
When   the API responds with AsistenciaGeneralResponse[]
Then   each item SHALL have a "studentName" field
And    the value SHALL be formatted "Apellido, Nombre" (lastName comma space firstName)
```

### Scenario B1-B2-2: studentName included in subject response

```
Given  the subject attendance query returns rows for courseCycleId "cc-abc" and materiaId "mat-1"
When   the API responds with AsistenciaMateriaResponse[]
Then   each item SHALL have a "studentName" field formatted "Apellido, Nombre"
```

### Scenario B4-1: Rows ordered alphabetically

```
Given  students with names: "Zelaya, Ana", "García, Luis", "García, Ana"
When   the attendance endpoint returns results
Then   the order SHALL be: "García, Ana" → "García, Luis" → "Zelaya, Ana"
```

### Scenario B7-1: Grid shows name — general mode

```
Given  the attendance grid is in GENERAL mode
And    the API returns rows with studentName = "Pérez, Juan" and studentId = "uuid-xxxx"
When   the grid renders
Then   the student cell SHALL display "Pérez, Juan"
And   "uuid-xxxx" SHALL NOT appear anywhere in the student cell
```

### Scenario B8-1: Grid shows name — por-materia mode

```
Given  the attendance grid is in POR-MATERIA mode
And    the API returns rows with studentName = "Pérez, Juan" and studentId = "uuid-xxxx"
When   the grid renders
Then   the student cell SHALL display "Pérez, Juan"
And   "uuid-xxxx" SHALL NOT appear anywhere in the student cell
```

### Scenario B5-1: No migration required

```
Given  the existing Prisma schema has asistenciaXAlumnoXCursoXCiclo.student relation
When   the change is applied
Then   no new Prisma migration file SHALL exist in api/prisma_tenant/migrations/
```

### Scenario B6-1: Domain entity unchanged

```
Given  the domain entity AsistenciaXAlumnoXCursoXCiclo in packages/domain
When   the change is applied
Then   the entity class SHALL NOT contain a studentName property or any student-name-derived field
```

---

## Files Affected

### Frontend
| File | Change |
|------|--------|
| `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | Add attendance button (permission-gated) |
| `web/src/pages/dashboard/asistencia-mensual.tsx` | Add useSearchParams; pre-select ccId; fix grid cell (~line 543) from studentId → studentName in both modes |

### Backend
| File | Change |
|------|--------|
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts` | Add student include; change orderBy |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts` | Add student include; change orderBy |
| `api/src/presentation/asistencia/dto/asistencia.dto.ts` | Add `studentName: string` to response DTOs |
| `api/src/presentation/asistencia/asistencia.controller.ts` | Update mappers to populate studentName |

### Domain (no change)
| File | Status |
|------|--------|
| `packages/domain/src/personnel/entities/student.ts` | Read-only; `fullName` getter used as format reference |
| `packages/domain/src/asistencia/entities/asistencia-x-alumno-x-curso-x-ciclo.ts` | MUST NOT change |

### Migrations
| Path | Status |
|------|--------|
| `api/prisma_tenant/migrations/` | NO new files |

---

## Out of Scope (explicit non-requirements)

- Changing the "Nombre Apellido" display elsewhere in `AlumnosCursoCicloPanel` (unrelated concern).
- Creating a new route (reuse `/asistencia-mensual` with query param).
- Any DB migration (student relation already exists in schema).
- Modifying domain entity `AsistenciaXAlumnoXCursoXCiclo`.
- Adding or removing permissions on any attendance endpoint.
