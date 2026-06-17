# Archive Report: retiro-boletin-docente-s2

> Phase: sdd-archive · Store: hybrid · 2026-06-17
> Stage: S2 of the retiro-teacher-legacy epic
> Verdict on entry: PASS WITH SUGGESTIONS (0 CRITICAL, 0 WARNING, 3 SUGGESTION)

---

## What changed

`generate-boletin.use-case.ts` no longer reads the `Teacher` table in any code path.

Specifically:

- **INICIAL branch (legacy):** the `subjectAssignment.findMany` call retains `include: { subject: true }` but the `teacher` relation has been removed. After fetching `SubjectAssignment` rows, the new private method `resolveDocentesForStudentCC` resolves the docente name via DocenteXCiclo → master `User` (Approach B, student-scoped bulk IN). The resolved value is `"Apellido, Nombre"` (last name first, comma-space). Co-docencia (N ≥ 2) produces names joined with `" / "` in alphabetical order, deduplicated by `docenteXCicloId`.
- **PRIMARIO branch:** the previous teacher query inside `buildMateriasPrimario` was removed. `docente = ""` directly — no SubjectAssignment query, no resolver call.
- **SECUNDARIO branch:** same pattern as Primario. `docente = ""` directly inside `buildMateriasSecundario`.
- **TERCIARIO branch:** shares the legacy Inicial/Terciario `buildMaterias` else-branch. `SubjectAssignment` is still queried (see "what is preserved" below), but `include: { teacher: true }` was removed. No resolver call is issued for Terciario (template does not render `docente`). Docente falls back to `""` for Terciario.

Files changed (from verified diff):

| File | Change |
|---|---|
| `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` | +429 lines (new file, 9 tests) |
| `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` | +2 lines |
| `api/src/application/reportes/generate-boletin.use-case.ts` | +164 / -37 lines |

No schema files (`.prisma`) or template files (`.hbs`) were modified.

---

## What is preserved (intentionally NOT changed)

- **Prisma schema:** `SubjectAssignment` model, its columns, foreign keys, and migration history are untouched. No migration was applied in S2.
- **Handlebars templates:** no template change. `MateriaBoletin.docente` remains `string`.
- **`SubjectAssignment` as Inicial/Terciario backbone:** the legacy `buildMaterias` else-branch still queries `SubjectAssignment` to build the subject list AND as the join key to `NotaTrimestral` grades (`NotaTrimestral.assignmentId → SubjectAssignment.id`; `NotaTrimestral` has no `subjectId`). Removing `SubjectAssignment` from this branch would erase all materias and grades for Inicial/Terciario — this is deferred to a later stage that must first migrate Inicial/Terciario grading off `NotaTrimestral`.
- **`NotaTrimestral` data:** untouched. Legacy grade join key intact.
- **`Teacher` tenant records and data:** the table is still present and populated; S2 only removes reads from the boletín use case. The Teacher table itself will be dropped in a later stage (S3, after homeroom migration).

---

## Verify result

Test suite: **1211 / 1211 PASS** (128 files, 29.49 s). New `generate-boletin.docente-s2.test.ts` suite: 9 tests, all pass.

Build: **PASS** — 0 TSC issues, SWC compiled 420 files.

Typecheck: 11 pre-existing errors (pedagogy/course-cycle files not in S2 diff; confirmed zero overlap with changed files).

Schema + template drift: `git diff main -- '*.prisma' '*.hbs'` → **empty**.

All 11 tasks (T1–T11) marked complete. All 6 invariants (INV-1–INV-6) and all 7 scenarios (SC-1–SC-7) verified PASS.

---

## Non-blocking suggestions (not fixed)

Three dead-mock-data items were identified and intentionally left for a follow-up cleanup. Tests pass; these are cosmetic:

1. **SUGGESTION-1:** `makeFullMockClient()` in `generate-boletin.use-case.test.ts` (~line 418) still wires a `subjectAssignment.findMany` mock with a `teacher` field. Primario never calls this. Dead data.
2. **SUGGESTION-2:** `makeSecClient()` (~line 775) wires the same pattern for Secundario. Also never called. Dead data.
3. **SUGGESTION-3:** Terciario regression test (~line 707) returns `teacher: { ... }` in the `subjectAssignment` mock response. The query IS issued for Terciario (subject backbone), but `include: { teacher: true }` was removed — production would never return this field. Mock returns it but code ignores it.

These can be cleaned up in a dedicated test-factory housekeeping PR at any time.

---

## Deploy precondition (operational)

**Before deploying S2 to production for any tenant:** verify that the materia-grupo backfill (`DocenteXCiclo` / grupo chain) has run successfully for that tenant. If the backfill is incomplete, the Inicial boletín will show an empty `docente` field (`""`) — a silent degradation, not a crash (SC-3 / INV-5). The Primario, Secundario, and Terciario boletines are unaffected by the backfill state.

---

## Corrected remaining roadmap (retiro-teacher-legacy)

The original roadmap underestimated the structural role of `SubjectAssignment`. The design phase (STOP-and-report finding) established the correct framing. The roadmap is updated accordingly:

### What S2 unblocked

S2 removed every read of the `Teacher` table from the boletín pipeline. This is the last live reader of `Teacher` in the application's report-generation layer. As a result:

- **Dropping the `Teacher` table** is now unblocked (pending homeroom migration — S3).
- **Dropping `SubjectAssignment.teacherId` FK** is now unblocked (pending homeroom migration — S3, same PR).

### What S2 did NOT unblock

- **Dropping `SubjectAssignment` itself** is NOT unblocked. The legacy Inicial/Terciario boletín branch queries `SubjectAssignment` as its subject-list source and as the sole join key to `NotaTrimestral` grades. Removing `SubjectAssignment` from this branch would eliminate all materias and grades for Inicial/Terciario students. This cannot proceed until a new prerequisite stage migrates Inicial/Terciario grading off `NotaTrimestral`.

### Remaining stages

| Stage | Description | Depends on | Status |
|---|---|---|---|
| S3 | Migrate homeroom to AsignacionCursoXCiclo (rol=TITULAR); drop `Teacher` table and `SubjectAssignment.teacherId` FK; decide /teachers page fate. Requires Fase 4 homeroom backfill verified per tenant. | S2 (done) + Decisions #2/#3 | PENDING |
| S3-pre (NEW) | Migrate Inicial/Terciario grading off `NotaTrimestral` → new grade model so the backbone dependency on `SubjectAssignment` is removed. Requires product decision on Evaluacion/NotaTrimestral historical data (Decision #1). | S3 + Decision #1 | PENDING (new stage) |
| S4 | Drop `SubjectAssignment` table + `Evaluacion` archival. Drop MesaExamen/ActaExamen `presidenteId` FK or migrate to User/DocenteXCiclo (Decision #2). Schema cleanup. | S3-pre + Decisions #1/#2 | PENDING |

Product decisions still open (unchanged from explore.md):
1. **Evaluacion / NotaTrimestral** historical data: borrar, archivar, o conservar `SubjectAssignment` permanentemente para niveles legacy?
2. **MesaExamen / ActaExamen** `presidenteId`: migrar a User/DocenteXCiclo, o mantener `Teacher` como registro permanente solo para mesas?
3. **Página /teachers**: retirar (reemplazada por gestión basada en User) o mantener como vista legacy?

---

## Engram artifact IDs (traceability)

| Artifact | Engram ID |
|---|---|
| proposal | #1058 |
| spec | #1059 |
| design | #1060 |
| tasks | #1061 |
| verify-report | #1063 |
| archive-report | (saved after this file) |
