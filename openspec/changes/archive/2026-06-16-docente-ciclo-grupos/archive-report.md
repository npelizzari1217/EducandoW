# Archive Report: docente-ciclo-grupos

> Archived: 2026-06-16
> Veredicto original: PASS WITH WARNINGS (0 CRITICAL · 3 WARNING · 5 SUGGESTION)
> Branch origin: feat/docente-ciclo-fase7 (7 PRs merged to main)
> Archive branch: chore/archive-docente-ciclo-grupos

---

## Summary

Change `docente-ciclo-grupos` introduced the DocenteXCiclo entity and the full group
model (fases 1–7), replacing the legacy Teacher/SubjectAssignment authz model for grading
and attendance writes. All core tasks are complete; integration tests remain deferred.

---

## WARNINGs fixed before archive

### WARNING-2 (smart-course-creation/delta.md stale vs D1) — FIXED

Two superseded scenarios were removed from `specs/smart-course-creation/delta.md`:
- "Re-generating with no linked data replaces subject rows" (stale — D1 is additive, not replace)
- "Re-generation blocked when graded data exists" (stale — D1 never blocks)

Replaced with a single D1-compliant scenario: "Re-generating a CursoXCiclo is always additive."
Both the archived delta.md and the merged canonical spec reflect the additive behavior.

### WARNING-3 (isPreceptor signature) — FIXED

`tasks.md` updated at two locations (lines F4-D2 and F6-A2) from:
  `isPreceptor(userId, courseCycleId)` → `isPreceptor(docenteXCicloId, courseCycleId)`
The canonical `asignacion-curso-ciclo/spec.md` carries an implementation note explaining
the signature and the use-case resolution pattern (userId → DocenteXCiclo → isPreceptor).

### WARNING-1 (GET notas authz legacy) — RESOLVED BY FOLLOW-UP

Already resolved by `notas-get-authz-grupo` (archived 2026-06-16). SPG-R10 and SFG-R11
are in the canonical specs. F5-T8/F5-T9 are closed at unit level.

---

## Spec merge results

### Merged into existing canonical specs

| Delta / Spec | Canonical target | Requirements added | Notes |
|---|---|---|---|
| `specs/notas/delta.md` (read scope) | `subject-period-grades/spec.md` | SPG-R10 already present (notas-get-authz-grupo) | No action needed |
| `specs/notas/delta.md` (read scope) | `subject-final-grades/spec.md` | SFG-R11 already present (notas-get-authz-grupo) | No action needed |
| `specs/notas/delta.md` (co-docencia) | `subject-period-grades/spec.md` | SPG-R11 (co-docencia shared record), SPG-S14 | New — write semantics |
| `specs/notas/delta.md` (co-docencia) | `subject-final-grades/spec.md` | SFG-R12 (co-docencia shared record), SFG-S16 | New — write semantics |
| `specs/notas/delta.md` (write authz) | `subject-period-grades/spec.md` | SPG-R12, SPG-S15..S17 | Security bug closed |
| `specs/notas/delta.md` (write authz) | `subject-final-grades/spec.md` | SFG-R13, SFG-S17..S19 | Security bug closed |
| `specs/smart-course-creation/delta.md` | `smart-course-creation/spec.md` | CursoXCiclo Generation requirement + Student Enrollment requirement | WARNING-2 fixed |

### New canonical specs created

| Change spec | Canonical location | Capability |
|---|---|---|
| `specs/docente-ciclo/spec.md` (DC-R1..R5) | `openspec/specs/docente-ciclo/spec.md` | NEW — DocenteXCiclo entity |
| `specs/materia-grupo-ciclo/spec.md` (MGC-R1..R6) | `openspec/specs/materia-grupo-ciclo/spec.md` | NEW — Subject/group model |
| `specs/asignacion-curso-ciclo/spec.md` (ACC-R1..R5) | `openspec/specs/asignacion-curso-ciclo/spec.md` | NEW — CursoXCiclo preceptor/titular assignment |

### Deferred (STOP-and-report — human resolution required)

#### DEFERRED-1: asistencia/delta.md — no suitable canonical target

The delta header claims base spec `openspec/specs/attendance-types/spec.md`, but that
spec explicitly places "toma de asistencia diaria" OUT OF SCOPE (see its Alcance section).
The delta defines new behavior (subject-level absences and daily presence recording by
group/preceptor) that does not fit into the AttendanceType CRUD spec.

**Resolution needed**: Either (a) create a new canonical spec `openspec/specs/attendance-recording/spec.md`
for the recording behavior and merge the delta there, or (b) extend `attendance-types/spec.md`
scope and merge. The delta content is preserved verbatim in the archive.

Requirements affected: Ausencias por Materia, Presente Diario, Three-Door access for attendance.

#### DEFERRED-2: user-persona/spec.md — canonical home ambiguous

UP-R1 (persona fields on User) and UP-R3 (User as authoritative source) belong in a User
entity spec, but `user-management/spec.md` is CRUD-focused and does not have a persona
fields section. UP-R2 (migration from Teacher) is a one-time historical migration that has
already executed and does not belong in a permanent active spec.

**Resolution needed**: Either (a) add UP-R1 and UP-R3 as a new "Persona Fields" section
in `user-management/spec.md` (drop UP-R2 as historical), or (b) create a new
`openspec/specs/user-persona/spec.md` capability spec. The spec content is preserved
verbatim in the archive.

---

## Debt register (as of archive)

| # | Item | Status |
|---|---|---|
| 1 | Migrar GET de notas a authz grupo-based (F5-A2 + F5-T8/T9) | **RESUELTO** por `notas-get-authz-grupo` (2026-06-16). Unit tests closed. |
| 2 | Retiro de `Teacher` y `SubjectAssignment` (D5) | **PENDIENTE** — SDD posterior requerido |
| 3 | Optativas: asignación de subconjunto de alumnos a materia | **PENDIENTE** — diferido explícitamente |
| 4 | Tests de integración multi-tenant (F1-T4..T6, F2-T6..T8, F3-T9..T12, F4-T5..T7, F6-T8/T9) | **PENDIENTE** — requieren contexto DB tenant real. F5-T8/T9 cerrados a nivel unit. |
| 5 | Asistencia delta — mergear al canonical spec correcto | **PENDIENTE** — ver DEFERRED-1 above |
| 6 | User persona — mergear al canonical spec correcto | **PENDIENTE** — ver DEFERRED-2 above |

---

## Artifact traceability

| Artifact | Location |
|---|---|
| Proposal | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/proposal.md` |
| Design | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/design.md` |
| Decisions | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/decisions.md` |
| Tasks | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/tasks.md` |
| Verify report | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/verify-report.md` |
| Delta specs | `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/specs/` |
| Canonical: subject-period-grades | `openspec/specs/subject-period-grades/spec.md` (SPG-R11, SPG-R12 added) |
| Canonical: subject-final-grades | `openspec/specs/subject-final-grades/spec.md` (SFG-R12, SFG-R13 added) |
| Canonical: smart-course-creation | `openspec/specs/smart-course-creation/spec.md` (generation + enrollment added) |
| Canonical: docente-ciclo | `openspec/specs/docente-ciclo/spec.md` (NEW) |
| Canonical: materia-grupo-ciclo | `openspec/specs/materia-grupo-ciclo/spec.md` (NEW) |
| Canonical: asignacion-curso-ciclo | `openspec/specs/asignacion-curso-ciclo/spec.md` (NEW) |
