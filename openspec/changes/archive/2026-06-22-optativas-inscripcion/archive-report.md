# Archive Report: optativas-inscripcion

> Archived: 2026-06-22
> Verdict: PASS WITH WARNINGS (0 CRITICAL across all 3 PRs)
> Branch origin: feat/optativas-pr1, feat/optativas-pr2, feat/optativas-pr3-web (3 PRs merged to main)
> Archive branch: chore/archive-optativas-inscripcion
> Closes: deuda #3 of docente-ciclo-grupos ("Optativas: asignación de subconjunto de alumnos a materia")

---

## Summary

Change `optativas-inscripcion` introduced the `esOptativa` boolean flag on
`MateriaXCursoXCiclo` and the full enrollment-management model for elective subjects:
cascade exclusion, manual per-student add/remove, admin toggle via PATCH, and read
exposure in GET responses. All three PRs (backend domain, backend endpoints, web UI)
are merged to main. The change resolves deuda #3 from the `docente-ciclo-grupos`
archive and adds no new CRITICAL findings.

---

## PRs and Verify Verdicts

| PR | GitHub | Scope | Tasks | Verdict | CRITICAL | WARNING | SUGGESTION |
|----|--------|-------|-------|---------|----------|---------|------------|
| PR1 | #52 | Domain entity, Prisma schema/migration, cascade filter | T1.1–T1.10 | PASS (after fix) | 0 | 1 | 2 |
| PR2 | #53 | DELETE + PATCH endpoints, UC, authz, GET esOptativa | T2.1–T2.16 | PASS WITH WARNINGS | 0 | 2 | 1 |
| PR3 | #54 | Web UI: badge, toggle, modal add/remove | T3.1–T3.6 | PASS WITH WARNINGS | 0 | 1 | 1 |

### PR1 — note on initial verify

Initial sdd-verify for PR1 returned FAIL due to 11 TypeScript typecheck errors (CRITICAL C1):
7 existing test files had not received the new `setEsOptativa` / `removeStudent` vi.fn() stubs
after the port interfaces were extended in T1.3/T1.4. Fix was ~10 vi.fn() additions;
re-run passed all tests and typecheck. PR1 was merged as #52 after the fix.

### PR2 — WARNING-1: idempotent DELETE contract

`MGC-S22` originally drafted as "returns 404 when enrollment record not found". The
implementation used `deleteMany` (void, discards count), making DELETE fully idempotent:
non-existent bridge-row → no data modification → HTTP 204, no error. This was the
deliberate design choice (T2.1 explicitly specified idempotency). The spec was corrected
to reflect the final contract: **DELETE is idempotent, returns 204 for both existing and
non-existing enrollment records.** The canonical spec (MGC-R9 / MGC-S22) reflects the
corrected, production semantics.

### PR2 — WARNING-2: PATCH response enrichment

PATCH response carries `subjectName: subjectId` (UUID, not resolved name) and hardcoded
`alumnosCount: 0 / gruposCount: 0`. Clients MUST NOT use the PATCH response to update
local state — a full refetch of `GET .../materias` is required after toggle. PR3 was
informed and implements the refetch pattern (no optimistic update on toggle).

### PR3 — WARNING: toggle authz conservatism — RESOLVED in PR3

The verify pass found the toggle button gated by `isRoot` only, while the API guard is
`COURSE_CYCLES × UPDATE` (accessible to module admins too). This was FIXED within the same
PR3 before merge: the toggle now uses `canToggleOptativa = isRoot || can('COURSE_CYCLES', 'UPDATE')`
via the existing `useCan` hook (`web/src/hooks/use-can.ts`), matching the API authz. Tests
GGO-T8/T9 cover a module-permitted non-root admin seeing the toggle and a read-only user not.

---

## Idempotent-DELETE Contract Decision

**Decision recorded:** `DELETE /course-cycles/:ccId/materias/:materiaId/alumnos/:id`
(`AlumnosXMateriaXCursoXCiclo` enrollment-record id) is fully idempotent.

- Endpoint parameter: `:id` = `AlumnosXMateriaXCursoXCiclo.id` (the bridge-row id, not studentId)
- Behavior on missing record: no-op, HTTP 204
- Implementation: `deleteMany({ where: { id } })` in `PrismaAlumnosXMateriaRepository`
- Canonical requirement: MGC-R9 / MGC-S22

---

## Spec Merge Results

### Merged into existing canonical spec

| Delta | Canonical target | Requirements merged | Scenarios merged |
|-------|-----------------|---------------------|-----------------|
| `specs/materia-grupo-ciclo/delta.md` | `openspec/specs/materia-grupo-ciclo/spec.md` | MGC-R7, MGC-R8, MGC-R9, MGC-R10, MGC-R11, MGC-R12 | MGC-S14–MGC-S27 (14 scenarios) |

Canonical spec now contains MGC-R1–R12 / MGC-S1–S27 (was R1–R6 / S1–S13 before this change).

MGC-S22 lands in the canonical spec with the **corrected idempotent semantics** (HTTP 204,
no error on missing record) — the 404 version that appeared in an earlier draft is NOT
present in the canonical spec.

> Note on deferred item: `StudyPlanSubject.esOptativa` (a plan-level flag to pre-mark a
> subject as optativa at the study-plan definition stage) was explicitly discussed and
> deferred during design. It is NOT included in this change. A follow-up SDD change
> would be needed to implement it.

---

## Deploy Debt

| Item | Command | Target schema |
|------|---------|---------------|
| Prisma migration NOT yet applied | `pnpm --filter api prisma:migrate:tenant` | TENANT schema |

Migration file: `api/prisma_tenant/migrations/20260622000000_add_es_optativa_to_materia_x_curso_x_ciclo/migration.sql`

This adds `es_optativa BOOLEAN NOT NULL DEFAULT false` to the `materias_x_curso_x_ciclo`
table in the tenant schema. Must be applied to every tenant DB before the feature is
live in production.

---

## Debt Register (as of archive)

| # | Item | Source | Status |
|---|------|--------|--------|
| 3 | Optativas: asignación de subconjunto de alumnos a materia | docente-ciclo-grupos | **RESUELTO** por `optativas-inscripcion` (2026-06-22) |
| 4 | Tests de integración multi-tenant | docente-ciclo-grupos | **PENDIENTE** — F1-T4..T6, F2-T6..T8, F3-T9..T12, F4-T5..T7, F6-T8/T9; requieren contexto DB tenant real |
| — | `StudyPlanSubject.esOptativa` plan-level flag | optativas-inscripcion design | **DIFERIDO** explícitamente — follow-up SDD requerido |
| — | Toggle UI authz: exponer botón a COURSE_CYCLES UPDATE (non-root admins) | optativas-inscripcion PR3 WARNING | **RESUELTO** en PR3 (#54) — `useCan('COURSE_CYCLES','UPDATE')`, tests GGO-T8/T9 |
| — | Prisma migration apply (tenant schema) | optativas-inscripcion deploy | **PENDIENTE** — ver Deploy Debt above |

---

## Artifact Traceability

| Artifact | Location |
|----------|----------|
| Proposal | `openspec/changes/archive/2026-06-22-optativas-inscripcion/proposal.md` |
| Explore | `openspec/changes/archive/2026-06-22-optativas-inscripcion/explore.md` |
| Design | `openspec/changes/archive/2026-06-22-optativas-inscripcion/design.md` |
| Tasks | `openspec/changes/archive/2026-06-22-optativas-inscripcion/tasks.md` |
| Apply progress | `openspec/changes/archive/2026-06-22-optativas-inscripcion/apply-progress.md` |
| Verify report PR1 | `openspec/changes/archive/2026-06-22-optativas-inscripcion/verify-report-pr1.md` |
| Verify report PR2 | `openspec/changes/archive/2026-06-22-optativas-inscripcion/verify-report-pr2.md` |
| Verify report PR3 | `openspec/changes/archive/2026-06-22-optativas-inscripcion/verify-report-pr3.md` |
| Delta spec | `openspec/changes/archive/2026-06-22-optativas-inscripcion/specs/materia-grupo-ciclo/delta.md` |
| Canonical: materia-grupo-ciclo | `openspec/specs/materia-grupo-ciclo/spec.md` (MGC-R7–R12, MGC-S14–S27 added) |
| Engram: proposal | topic_key `sdd/optativas-inscripcion/proposal` (#1301) |
| Engram: verify PR1 | topic_key `sdd/optativas-inscripcion/verify-report` (#1308) |
| Engram: verify PR2 | topic_key `sdd/optativas-inscripcion/verify-report-pr2` (#1311) |
| Engram: verify PR3 | topic_key `sdd/optativas-inscripcion/verify-report-pr3` (#1314) |
