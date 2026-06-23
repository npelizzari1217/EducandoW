# Proposal: asistencia-desde-alumnos-curso

**Pedagogical level:** level-agnostic — attendance is per CourseCycle and applies across all levels.

## Intent

**Problem.** From the students panel of a course-cycle (`AlumnosCursoCicloPanel`, opened from `/course-cycles`), there is no way to jump to that course-cycle's monthly attendance: the user must navigate manually and re-select the course-cycle. Separately, the monthly attendance grid (`asistencia-mensual.tsx` ~line 543) renders the raw `studentId` UUID instead of the student name, in BOTH modes (general and por-materia), making the grid unreadable.

**Why now.** Both issues block real attendance-taking workflows. The data fix is cheap: the Prisma attendance models already carry a `student` relation, so no migration is needed.

**Success looks like.** From the panel, an attendance-permitted user clicks one button and lands on `/asistencia-mensual?ccId=…` with that course-cycle pre-selected in general mode. The grid shows "Apellido, Nombre" for every row, sorted alphabetically, in both modes.

## Scope

**In scope**
- Part A: Button inside `AlumnosCursoCicloPanel.tsx` → navigate to `/asistencia-mensual?ccId=${ccId}` in general mode. Button hidden unless ATTENDANCE READ (via `useCan`).
- `asistencia-mensual.tsx`: read `?ccId=` (useSearchParams) on mount, pre-select course-cycle, default to general mode.
- Part B: Backend enrichment in `prisma-asistencia-general.repository.ts` and `prisma-asistencia-materia.repository.ts` — `include: { student: { select: { firstName, lastName } } }`, reorder `orderBy` to `[{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`.
- Add `studentName: string` to `AsistenciaGeneralResponse` / `AsistenciaMateriaResponse`; update `toGeneralResponse` / `toMateriaResponse` mappers (format `${lastName}, ${firstName}`).
- Frontend: add `studentName` to row interfaces; render `row.studentName` instead of `row.studentId` in both modes.

**Out of scope**
- The "Nombre Apellido" display used ELSEWHERE in `AlumnosCursoCicloPanel` — do NOT touch it (separate concern).
- No new route; reuse `/asistencia-mensual`.
- No DB migration (student relation already exists).
- Domain entity `AsistenciaXAlumnoXCursoXCiclo` stays ID-only.

## Approach & rationale

- **Backend enrichment, not per-student frontend fetch.** ATTENDANCE-only users lack COURSE_CYCLES READ → the frontend approach would 403. Enrich in a single Prisma query (no N+1) at the repo boundary; keep domain entity ID-only (clean-arch).
- **"Apellido, Nombre"** = `Student.fullName` (Argentine standard), built in the controller mapper, keeping controllers thin.
- **Navigation via query string `?ccId=`** — simplest, shareable, no new route, no router state coupling.
- **Permission gate via `useCan`** — reuse existing hook; button absent when unauthorized (ui-patterns).

## Next phases
`sdd-spec` and `sdd-design` can run in parallel.
