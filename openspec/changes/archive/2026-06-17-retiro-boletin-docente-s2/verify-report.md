# Verify Report: retiro-boletin-docente-s2

> Phase: sdd-verify · Store: hybrid · 2026-06-17
> Verdict: **PASS WITH SUGGESTIONS** — 0 CRITICAL, 0 WARNING, 3 SUGGESTION

---

## Test Suite

```
pnpm --filter api test
Tests:  1211 passed (1211)
Files:  128 passed (128)
Duration: 29.49s
```

All tests pass including the new `generate-boletin.docente-s2.test.ts` suite (9 tests).

```
pnpm build (turbo)
TSC: Found 0 issues. SWC: Successfully compiled 420 files. PASS.
```

```
pnpm --filter api typecheck
11 errors — all pre-existing baseline (pedagogy, course-cycle, infrastructure test files).
None are in generate-boletin.use-case.ts or generate-boletin.docente-s2.test.ts.
git diff confirms zero overlap with S2 changed files.
```

```
git diff main --stat -- '*.prisma' '*.hbs'
(empty — PASS)
```

---

## Files changed in S2 (git diff main --stat)

| File | Lines |
|---|---|
| `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` | +429 (new) |
| `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` | +2 |
| `api/src/application/reportes/generate-boletin.use-case.ts` | +164 / -37 |

---

## Spec requirement checks

### INV-1 — No Teacher-table reads

PASS. `rg "teacher|Teacher" generate-boletin.use-case.ts` → zero hits.
- `buildMaterias` (legacy Inicial/Terciario): `subjectAssignment.findMany` uses `include: { subject: true }` only. No `teacher` relation.
- `buildMateriasPrimario`: `const docente = '';` directly. No subjectAssignment query.
- `buildMateriasSecundario`: `const docente = '';` directly. No subjectAssignment query.
- `resolveDocentesForStudentCC`: queries DocenteXCiclo chain + master User. No Teacher table.

### INV-2 — SubjectAssignment data preserved

PASS.
- Legacy branch still queries `client.subjectAssignment.findMany({ ..., include: { subject: true } })` (lines 234-237).
- `notaTrimestral.findMany` still uses `assignmentId: { in: assignmentIds }` join key.
- No schema migration. `git diff main -- '*.prisma'` empty.

### INV-3 — MateriaBoletin.docente unchanged

PASS. `docente: string` in all branches. No template change. `git diff main -- '*.hbs'` empty.

### INV-4 — Tenant/master client separation

PASS.
- 5-step chain (materiaXCursoXCiclo → alumnosXMateriaXCursoXCiclo → alumnosXGrupoXCursoXMateriaXCiclo → grupoXCursoXMateriaXCiclo → docenteXCiclo): all use tenant `client`.
- Name lookup: `this.prisma.getMasterClient().user.findMany(...)`. No client swap.

### INV-5 — No error on zero docentes

PASS. SC-3 test passes. Empty MateriaXCursoXCiclo → `new Map()`. Caller uses `?? ''`. No throw.

### INV-6 — Name from master User

PASS. `${u.lastName}, ${u.firstName}` from master User. No Teacher tenant record read.

### SC-1 — Single docente "Apellido, Nombre"

PASS. SC-1 test: `map.get('subj-1') === 'Gomez, Ana'`. Verified.

### SC-2 — Co-docencia

PASS.
- SC-2a: 2 distinct docentes → `'Alves, Xavier / Ferreira, Bruno'` (alphabetical). Verified.
- SC-2b: same docenteXCicloId in 2 grupos → single name (Set dedup). Verified.

### SC-3 — Zero docentes

PASS. Empty Map returned. Caller maps to `''`. No error.

### SC-4 — Primario blank, no query

PASS. `const docente = ''` at line 428. No subjectAssignment call. No resolver call. SC-4 test asserts both spy counts = 0.

### SC-5 — Secundario blank, no query

PASS. `const docente = ''` at line 612. SC-5 test asserts both spy counts = 0.

### SC-6 — Integration guard

PASS.
- Terciario test: `subjectAssignment.findMany` called once; `include` has `subject: true` only, NO `teacher`.
- INV-1 full guard test: iterates all 4 levels, asserts no `include.teacher` or `select.teacher` in any subjectAssignment call.

### SC-7 — SubjectAssignment data integrity

PASS. No migration files added. `git diff main -- '*.prisma'` empty.

### T10 — Schema drift

PASS. No Prisma schema changes.

### T11 — Full suite gate

PASS. 1211/1211 tests. Build clean.

---

## Task completeness

All 11 tasks marked `[x]` in tasks.md. Code state matches:
- T1 ✓ shared factories in docente-s2.test.ts
- T2 ✓ 4 resolver tests (SC-1/2a/2b/3)
- T3 ✓ `resolveDocentesForStudentCC` private method implemented
- T4 ✓ Primario + Secundario failing tests written
- T5 ✓ SubjectAssignment teacher block removed from buildMateriasPrimario
- T6 ✓ Same for buildMateriasSecundario
- T7 ✓ Terciario + INV-1 guard tests
- T8 ✓ 3-change legacy branch modification (8a drop teacher include, 8b isInicial gate + resolver loop, 8c docente line)
- T9 ✓ Regression tests for Inicial + Terciario
- T10 ✓ Schema drift = empty
- T11 ✓ All tests pass

---

## Suggestions (non-blocking)

### SUGGESTION-1 — Dead mock data in PR7-T2 (Primario tests)
`makeFullMockClient()` in `generate-boletin.use-case.test.ts` (~line 418) still includes:
```ts
subjectAssignment: {
  findMany: vi.fn().mockResolvedValue([
    { subjectId: SUBJECT_ID, teacher: { firstName: 'Juan', lastName: 'López' } },
  ]),
},
```
Primario no longer calls `subjectAssignment.findMany`. This mock is dead and the `teacher` data is never accessed. Tests pass. Clean up in a follow-up.

### SUGGESTION-2 — Dead mock data in PR6-T2 (Secundario tests)
Same pattern: `makeSecClient()` (~line 775) has `subjectAssignment` mock with `teacher: { firstName: 'Ana', lastName: 'García' }`. Secundario never calls this. Tests pass.

### SUGGESTION-3 — Dead `teacher` field in Terciario regression mock (~line 707)
The Terciario regression test wires `teacher: { firstName: 'María', lastName: 'Rodríguez' }` on the subjectAssignment mock response. The subjectAssignment IS called for Terciario (subject backbone), but `include: { teacher: true }` was removed — so production would never return that field. Mock returns it anyway but code ignores it. Harmless. Worth removing for clarity.

---

## Risk assessment

| Risk | Status |
|---|---|
| R1 (Inicial blank if backfill not run) | Deploy precondition — not a code issue. SC-3 + T9 cover degradation gracefully. |
| R3 (dedup mandatory) | Mitigated. SC-2b test explicitly guards the dropped @@unique. |
| R-courseCycle-uuid (cc.uuid accessible) | CONFIRMED OK. TypeCheck passes and T8 uses `cc.uuid` in the Inicial gate. |
| R-EPIC (S3 scope correction) | Framing risk — not S2 code. S3 must only drop Teacher + teacherId FK, not SubjectAssignment. |

---

## Verdict

**PASS WITH SUGGESTIONS**

- CRITICAL: 0
- WARNING: 0
- SUGGESTION: 3 (dead mock data cleanup in old test file — all harmless, tests pass)

Siguiente Paso Recomendado: **sdd-archive**
