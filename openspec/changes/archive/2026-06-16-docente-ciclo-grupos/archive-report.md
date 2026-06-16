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

### Deferred — resolved 2026-06-16

#### DEFERRED-1: asistencia/delta.md — RESOLVED

**Decision**: new canonical spec created at `openspec/specs/attendance-recording/spec.md`.
The `attendance-types/spec.md` out-of-scope bullet for "toma de asistencia diaria" has been
updated to a cross-reference pointing to the new spec.

Requirements canonicalized: ATR-R1 (ausentes por materia, group-scoped), ATR-R2 (presente
diario, CursoXCiclo-scoped via ACC-R1), ATR-R3 (three-door access model including
SECRETARIO/DIRECTOR/ADMIN/ROOT bypass on both read and write).

Source delta: `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/specs/asistencia/delta.md`

#### DEFERRED-2: user-persona/spec.md — RESOLVED

**Decision**: new standalone canonical spec created at `openspec/specs/user-persona/spec.md`.
UP-R1 and UP-R3 are the active ongoing requirements. UP-R2 is included but clearly marked
as a completed/historical migration — not ongoing behavior.

Requirements canonicalized: UP-R1 (persona fields on User, nullable), UP-R2 (historical
migration from Teacher — completed), UP-R3 (User as authoritative source post-migration).

Source spec: `openspec/changes/archive/2026-06-16-docente-ciclo-grupos/specs/user-persona/spec.md`

---

## Debt register (as of archive)

| # | Item | Status |
|---|---|---|
| 1 | Migrar GET de notas a authz grupo-based (F5-A2 + F5-T8/T9) | **RESUELTO** por `notas-get-authz-grupo` (2026-06-16). Unit tests closed. |
| 2 | Retiro de `Teacher` y `SubjectAssignment` (D5) | **PENDIENTE** — SDD posterior requerido |
| 3 | Optativas: asignación de subconjunto de alumnos a materia | **PENDIENTE** — diferido explícitamente |
| 4 | Tests de integración multi-tenant (F1-T4..T6, F2-T6..T8, F3-T9..T12, F4-T5..T7, F6-T8/T9) | **PENDIENTE** — requieren contexto DB tenant real. F5-T8/T9 cerrados a nivel unit. |
| 5 | Asistencia delta — mergear al canonical spec correcto | **RESUELTO** — `openspec/specs/attendance-recording/spec.md` (ATR-R1..R3) creado 2026-06-16 |
| 6 | User persona — mergear al canonical spec correcto | **RESUELTO** — `openspec/specs/user-persona/spec.md` (UP-R1..R3) creado 2026-06-16 |

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
| Canonical: attendance-recording | `openspec/specs/attendance-recording/spec.md` (NEW — DEFERRED-1 resolved) |
| Canonical: user-persona | `openspec/specs/user-persona/spec.md` (NEW — DEFERRED-2 resolved) |
