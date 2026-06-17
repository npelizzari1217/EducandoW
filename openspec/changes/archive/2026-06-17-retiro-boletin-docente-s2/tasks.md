# Tasks: retiro-boletin-docente-s2

> Phase: sdd-tasks · Store: hybrid · 2026-06-17
> S2 de `retiro-teacher-legacy`. Approach B (student-scoped, bulk IN). Single PR.

---

## Scope reminder (DO NOT regress)

- S2 removes every read of the **`Teacher` TABLE** from the boletín — not all `SubjectAssignment` reads.
- Legacy Inicial/Terciario branch KEEPS its `SubjectAssignment` query (subject list + `NotaTrimestral.assignmentId` join key) — only drops `include: { teacher }`.
- Primario/Secundario: set `docente=''` and REMOVE their `SubjectAssignment` query entirely (it was teacher-only).
- **Terciario**: does NOT render docente → `docente=''`. New-model resolver applies to **Inicial ONLY**.
- Tenant client for the 5 model queries; master `PrismaService.getMasterClient().user` for names. No client mixing.
- NO schema change, NO template change, NO new DI.

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines | ~200 (55 resolver + ~20 legacy edits + ~-26 Primario/Secundario deletions + ~180 test file) |
| 400-line budget risk | **Low** |
| Chained PRs recommended | **No** |
| Decision needed before apply | **No** |

---

## Files affected

| File | Change type |
|---|---|
| `api/src/application/reportes/generate-boletin.use-case.ts` | Edit — 7 sites + 1 new private method |
| `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` | Create — ~180 lines |

---

## Dependency graph

```
T1 ──┬── T2 ── T3 ──────────────┬── T8 ── T9 ──┐
     ├── T4 ── T5 (‖ T6)        │              ├── T11
     └── T7 ────────────────────┘              │
T10 ───────────────────────────────────────────┘
```

---

## Task list

### [x] T1 — Create test file + shared mock factories
**Sequential. No deps.**

Create `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts`.

Provide only shared factory helpers (no `it()` blocks yet):

```ts
// makeTenantClient(overrides: Partial<...>): mocked TenantPrismaClient
//   — overrides per model (materiaXCursoXCiclo, alumnosXMateriaXCursoXCiclo,
//     alumnosXGrupoXCursoXMateriaXCiclo, grupoXCursoXMateriaXCiclo,
//     docenteXCiclo, subjectAssignment, courseCycle, periodoEvaluacion, notaTrimestral)
//   — default: all findMany return []

// makeMasterClient(users: Array<{id, firstName, lastName}>): mocked master client
//   — user.findMany returns the given users filtered by where.id.in

// makeUC(tenantClient, masterClient): constructs GenerateBoletinUseCase
//   — PdfGenerator + PdfStorage are minimal stubs
//   — TenantContext.getClient() → tenantClient (vi.spyOn or module mock)
```

**Satisfies:** D6 (test strategy prerequisite — shared infrastructure).

---

### [x] T2 — Write failing tests: `resolveDocentesForStudentCC` (SC-1, SC-2, SC-3)
**Sequential. Depends on T1. Write BEFORE T3.**
**Parallel with T4, T7.**

In `describe('resolveDocentesForStudentCC')`, add 4 `it()` blocks. All MUST FAIL before T3 is implemented.

1. **SC-1 single docente** — resolver chain returns exactly 1 DocenteXCiclo for the student's grupo; master User has `firstName='Ana'`, `lastName='Gomez'`. Assert `map.get(subjectId) === 'Gomez, Ana'`.

2. **SC-2a co-docencia 2 distinct docentes** — 2 grupos for the same subject, each mapping to a different `docenteXCicloId` and different master User. Assert result is `'${lastName1}, ${firstName1} / ${lastName2}, ${firstName2}'` ordered alphabetically by last name.

3. **SC-2b dedup — same `docenteXCicloId` in 2 grupos** (covers D3 / dropped `@@unique`) — 2 grupos map to the SAME `docenteXCicloId`. Assert the result contains only one name (not duplicated). Satisfies D3 / R3.

4. **SC-3 zero results (empty MateriaXCursoXCiclo)** — `materiaXCursoXCiclo.findMany` returns `[]`. Assert resolver returns `new Map()` (empty). Caller falls back to `''`. Assert no error thrown (INV-5).

**Satisfies:** SC-1, SC-2, SC-3, INV-5 (no throw on 0 results), D6 (cases 1-4).

---

### [x] T3 — Implement `resolveDocentesForStudentCC` private method
**Sequential. Depends on T2 (tests must exist and fail).**

Add after `resolveSubjectsForCC` in `generate-boletin.use-case.ts`:

```ts
/**
 * Resolves docente display names for ONE student within ONE CourseCycle,
 * via the new model (DocenteXCiclo → master User). Student-scoped (Approach B).
 * Co-docencia → names joined " / " alphabetically. docenteXCicloId deduped.
 * Returns subjectId → "Apellido, Nombre[ / ...]". Absent key = no docente found.
 * 5 tenant IN-queries + 1 master IN-query. Zero per-subject queries (no N+1).
 */
private async resolveDocentesForStudentCC(
  client: TenantPrismaClient,
  studentId: string,
  courseCycleId: string,
): Promise<Map<string, string>>
```

Chain (in order):
1. `client.materiaXCursoXCiclo.findMany({ where: { courseCycleId }, select: { id, subjectId } })` → empty ⇒ return `new Map()`
2. `client.alumnosXMateriaXCursoXCiclo.findMany({ where: { materiaXCursoXCicloId: { in: [...materiaIds] }, studentId }, select: { id, materiaXCursoXCicloId } })` → empty ⇒ return `new Map()`
3. `client.alumnosXGrupoXCursoXMateriaXCiclo.findMany({ where: { alumnosXMateriaXCursoXCicloId: { in: [...alumnoMateriaIds] } }, select: { grupoId, alumnosXMateriaXCursoXCicloId } })` → empty ⇒ return `new Map()`
4. `client.grupoXCursoXMateriaXCiclo.findMany({ where: { id: { in: [...grupoIds] } }, select: { id, docenteXCicloId } })`
5. **Dedup `docenteXCicloId`** before query 5. `client.docenteXCiclo.findMany({ where: { id: { in: [...dedupedDocIds] } }, select: { id, userId } })`
6. `this.prisma.getMasterClient().user.findMany({ where: { id: { in: [...dedupedUserIds] } }, select: { id, firstName, lastName } })` → `` `${lastName}, ${firstName}` ``

Assembly (in-memory):
- Build `subjectId → Set<docenteXCicloId>` via the chain T3→T2→T1 linkage.
- For each `subjectId`: map docIds → userId → name, drop nullish, **sort alphabetically** (stable PDF output), `join(' / ')`. Only set map entry if non-empty string.

**Satisfies:** SC-1, SC-2, SC-3, INV-4, INV-5, INV-6, D2, D3, D5.

---

### [x] T4 — Write failing tests: Primario (SC-4) + Secundario (SC-5)
**Sequential. Depends on T1. Write BEFORE T5/T6.**
**Parallel with T2, T7.**

Two `describe` blocks. Both MUST FAIL before T5/T6 are implemented.

`describe('buildMateriasPrimario — SC-4 docente blank, no SubjectAssignment query')`:
- Wire `subjectAssignment.findMany` spy (returns `[]` or any value).
- Call `buildMateriasPrimario` with a valid Primario enrollment stub (mock `courseCycle`, `studyPlanCourse`, `studyPlanSubject`, `gradingPeriodTemplateItem` returning synthetic data).
- Assert every `materias[i].docente === ''`.
- Assert `client.subjectAssignment.findMany` was **never called** (spy call count = 0).
- Assert `client.materiaXCursoXCiclo.findMany` was **never called** (the new resolver must NOT run for Primario).

`describe('buildMateriasSecundario — SC-5 docente blank, no SubjectAssignment query')`:
- Same assertions mirrored for Secundario.

**Satisfies:** SC-4, SC-5, INV-1 (partial — no Teacher read in Primario/Secundario), D6 (cases 5-6).

---

### [x] T5 — Remove SubjectAssignment teacher query from `buildMateriasPrimario`
**Sequential. Depends on T4 (failing tests must exist).**
**Parallel with T6.**

Two changes in `buildMateriasPrimario` (`generate-boletin.use-case.ts`):

**Change 5a — DELETE teacher lookup block (~lines 323–336):**
```ts
// DELETE the entire block:
// "// 3. Teacher lookup (bulk, no N+1)"
// const assignments = await client.subjectAssignment.findMany({
//   where: { courseSectionId: cc.courseId, active: true },
//   select: {
//     subjectId: true,
//     teacher: { select: { firstName: true, lastName: true } },
//   },
// });
// const teacherBySubjectId = new Map(
//   assignments.map((a) => [
//     a.subjectId,
//     a.teacher as { firstName: string; lastName: string },
//   ]),
// );
```

**Change 5b — REPLACE docente resolution (~lines 429–431):**
```ts
// DELETE:
// // 6e. Teacher name (legacy required field)
// const teacher = teacherBySubjectId.get(subjectId);
// const docente = teacher ? `${teacher.lastName}, ${teacher.firstName}` : '';
// REPLACE WITH:
const docente = '';
```

**Satisfies:** SC-4, INV-1 (no SubjectAssignment/teacher query in Primario), D1, D4 (edit sites 4 + 5).

---

### [x] T6 — Remove SubjectAssignment teacher query from `buildMateriasSecundario`
**Sequential. Depends on T4 (failing tests must exist).**
**Parallel with T5.**

Mirror of T5 for `buildMateriasSecundario`:

**Change 6a — DELETE teacher lookup block (~lines 524–537):**
```ts
// DELETE the "// 4. Teacher lookup (bulk, no N+1)" block
// (same structure as Primario: subjectAssignment.findMany + teacherBySubjectId Map)
```

**Change 6b — REPLACE docente resolution (~lines 627–629):**
```ts
// DELETE:
// // 7e. Teacher name
// const teacher = teacherBySubjectId.get(subjectId);
// const docente = teacher ? `${teacher.lastName}, ${teacher.firstName}` : '';
// REPLACE WITH:
const docente = '';
```

**Satisfies:** SC-5, INV-1 (no SubjectAssignment/teacher query in Secundario), D1, D4 (edit sites 6 + 7).

---

### [x] T7 — Write failing tests: Terciario branch + INV-1 no-Teacher guard
**Sequential. Depends on T1. Write BEFORE T8.**
**Parallel with T2, T4.**

Two `describe` blocks. MUST FAIL before T8.

`describe('legacy branch — Terciario (SC-6 partial)')`:
- Wire a Terciario enrollment (level 40).
- Assert `result.materias[i].docente === ''` for all subjects.
- Assert `client.materiaXCursoXCiclo.findMany` was **never called** (resolver does NOT run for Terciario).
- Assert `client.subjectAssignment.findMany` **WAS called** (subjects+notas backbone preserved).
- Assert the call to `subjectAssignment.findMany` had `include` that does **NOT contain the key `teacher`** (inspect the spy's `mock.calls[0][0].include` — must be `{ subject: true }` only).

`describe('INV-1 — no Teacher-table read in any branch (SC-6 full guard)')`:
- For each level (10/Inicial, 20/Primario, 30/Secundario, 40/Terciario): spy on `client.subjectAssignment.findMany`.
- After execution, collect all call args; assert none of them has `include.teacher` or `select.teacher` as a truthy key.
- This is the authoritative test for the `retiro-teacher-legacy` invariant.

**Satisfies:** INV-1, SC-6, D6 (cases 7-8).

---

### [x] T8 — Modify legacy Inicial/Terciario branch (3 change sites)
**Sequential. Depends on T3 (resolver impl) + T7 (failing tests exist).**

Three changes in the legacy path inside `buildMaterias` (`generate-boletin.use-case.ts`):

**Change 8a — Drop `teacher` include from `subjectAssignment.findMany` (~line 225):**
```ts
// BEFORE:
include: { subject: true, teacher: true },
// AFTER:
include: { subject: true },
```

**Change 8b — Add `isInicial` gate + resolver call block (after courseCycles fetch ~line 215, before materia loop ~line 251):**
```ts
const isInicial = Math.floor(enrollment.level / 10) === 1;
const docenteBySubjectId = new Map<string, string>();
if (isInicial) {
  for (const cc of courseCycles) {
    const m = await this.resolveDocentesForStudentCC(client, enrollment.studentId, cc.uuid);
    for (const [sid, name] of m) docenteBySubjectId.set(sid, name);
  }
}
```

> Note: `courseCycles` is fetched with `include: { course: true }` which returns all scalar fields including `uuid`. Verify that `cc.uuid` is accessible in the existing query result shape before applying; no code change to the courseCycles query should be needed.

**Change 8c — Replace docente line in materia loop (~line 275):**
```ts
// BEFORE:
docente: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}`,
// AFTER:
docente: docenteBySubjectId.get(assignment.subjectId) ?? '',
```

**Satisfies:** INV-1, INV-4, INV-6, SC-1 (Inicial resolver integration), SC-6 (Terciario path: resolver not called, subjectAssignment kept without teacher), D1, D4 (edit sites 1-3), D5 (no N+1).

---

### [x] T9 — Write regression tests: legacy branch content preserved (INV-2 code-level)
**Sequential. Depends on T8 (impl complete).**

In the same test file, add `describe('legacy branch — subjects + notas regression')`:

**Inicial regression:**
- Wire an Inicial enrollment (level 10) with synthetic `subjectAssignment` (no teacher field), `periodoEvaluacion`, and `notaTrimestral` records.
- Call `buildMaterias` (via reflection or expose a test-only accessor).
- Assert `materias[0].nombre === assignment.subject.name` (subject list backbone intact).
- Assert `materias[0].notas` has the correct period entries from `notaTrimestral`.
- Assert `materias[0].promedio` is computed from the grades.
- Assert `materias[0].docente` equals whatever the resolver returns (or `''` if resolver mock returns empty).

**Terciario regression:**
- Same as Inicial but level 40; assert `nombre`, `notas`, `promedio`, `valoracion`, `aprobado` are all correct.
- Assert `materias[0].docente === ''` (Terciario never gets the resolver).

**Satisfies:** INV-2 (behavior — SubjectAssignment backbone preserved), SC-7 (data intact), design risk R-EPIC mitigation (subjects+grades still flow).

---

### [x] T10 — Schema drift verification (pre-merge checklist)
**Independent. No code deps. Can run at any time.**

Non-code gate. Run and record output:

```bash
# From repo root
git diff --stat -- '*.prisma'
# Expected: empty output (no Prisma file changed)

# Verify no new migration file for SubjectAssignment
ls api/prisma_tenant/migrations/ | tail -5
# Expected: no migration named *subject_assignment*, *teacher*, or *drop* appears after S2 changes
```

Document result as a pre-merge checklist item in the PR description.

**Satisfies:** INV-2, SC-7, proposal OUT scope ("NO tocar schema.prisma").

---

### [x] T11 — Full test suite + typecheck gate
**Sequential. Depends on T3, T5, T6, T8, T9, T10.**

```bash
pnpm --filter api test        # All tests pass, coverage ≥ 80%
pnpm --filter api typecheck   # 0 TypeScript errors
```

Verify the new test file contributes to coverage on `generate-boletin.use-case.ts`.

**Satisfies:** All INV + SC (integration gate). D7 (single PR, no budget breach).

---

## Parallel execution summary

| Group | Tasks | Can run together? |
|---|---|---|
| A | T2, T4, T7 | Yes — all depend only on T1 |
| B | T5, T6 | Yes — both depend on T4 |
| C | T1, T10 | Yes — T1 has no deps; T10 is independent |

Critical path: **T1 → T2 → T3 → T8 → T9 → T11**

---

## Spec traceability

| Task | Spec INV | Spec SC | Design decision |
|---|---|---|---|
| T1 | — | — | D6 |
| T2 | INV-5 | SC-1, SC-2, SC-3 | D2, D3, D6 |
| T3 | INV-4, INV-5, INV-6 | SC-1, SC-2, SC-3 | D2, D3, D5 |
| T4 | INV-1 (partial) | SC-4, SC-5 | D1, D6 |
| T5 | INV-1 | SC-4 | D1, D4 (sites 4-5) |
| T6 | INV-1 | SC-5 | D1, D4 (sites 6-7) |
| T7 | INV-1 | SC-6 | D1, D6 |
| T8 | INV-1, INV-4, INV-6 | SC-1, SC-6 | D1, D4 (sites 1-3), D5 |
| T9 | INV-2 | SC-7 | D1 (no regression) |
| T10 | INV-2, INV-3 | SC-7 | Proposal OUT scope |
| T11 | ALL | ALL | D7 (budget/PR gate) |

---

## Risks

- **R1 (HIGH — deploy, not code):** Inicial blank if materia-grupo backfill not run per tenant. Mitigated by T9 (regression catches blank with empty resolver), but operational precondition must be verified before prod deploy.
- **R3 (MEDIUM — dedup):** `@@unique([materiaXCursoXCicloId, docenteXCicloId])` was dropped. T2 case SC-2b is the explicit regression guard.
- **R-courseCycle-uuid (LOW):** `include: { course: true }` in the legacy courseCycles query returns all scalars including `uuid`. If this assumption is wrong (e.g., the model uses `id` not `uuid`), T8 will break at typecheck. T7 would surface this early.
- **R-EPIC (HIGH — framing, not S2 code):** S3 cannot drop `SubjectAssignment`. S3 scope must be corrected to "drop `Teacher` table + `SubjectAssignment.teacherId` FK" only.
