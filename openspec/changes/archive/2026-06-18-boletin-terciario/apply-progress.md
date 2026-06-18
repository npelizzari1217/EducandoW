# Apply Progress: boletin-terciario (Fase C)

**Branch:** feat/boletin-terciario (stacked on feat/evaluacion-terciario)
**Commit:** 60bce83
**Date:** 2026-06-18
**Status:** DONE — all 6 tasks complete

---

## Tasks

- [x] TASK-0 — Verify schema field names [PREP]
  Schema confirmed exactly as designed. All fields match: InscripcionMateria (studentId, anioAcademico, estado String, cuatrimestre String, notaCursada Float?, notasCursada NotaCursadaTerciario[], materiaCarrera MateriaCarrera), MateriaCarrera (subject Subject, carrera Carrera), Carrera (name), ActaExamenNota (studentId, nota Float, condicion String, intento Int, acta ActaExamen), ActaExamen (materiaCarreraId, fecha DateTime, active Boolean). Estado is a plain String (not a Prisma enum).

- [x] TASK-T1 — Create failing test file [TEST-FIRST]
  Created `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts`
  24 tests: 21 Terciario scenarios (all spec scenarios) + 3 legacy path regression tests.
  Confirmed RED phase: 19/21 Terciario tests failing before implementation.

- [x] TASK-I1 — Add Terciario types to boletin.template.ts [IMPL]
  Added SlotCursadaBoletin, IntentoFinalBoletin, GrupoCuatrimestreBoletin interfaces.
  Extended MateriaBoletin with slotsCursada, notaCursadaConfirmada, condicionCursada, intentosFinales, cuatrimestre (all optional, backward-compatible).
  Extended DatosBoletin with carreraName and cuatrimestresTerciario (both optional).
  Added `import type { SlotCursadaTerciarioValue } from '@educandow/domain'`.

- [x] TASK-I2 — Implement buildMateriasTerciario() + dispatch + wire execute() [IMPL]
  Widened buildMaterias() enrollment param type (added grade?: string | null) and return type (added carreraName, cuatrimestresTerciario).
  Inserted decade-4 dispatch BEFORE legacy NotaTrimestral path.
  Implemented buildMateriasTerciario() with:
  - Q1: inscripcionMateria.findMany with include chain (notasCursada + materiaCarrera.{subject,carrera}), estado filter excluding LIBRE
  - Q2: actaExamenNota.findMany bulk by materiaCarreraId IN, short-circuited when 0 inscripciones
  - In-memory sort for R1 fallback (to-one orderBy may fail in some Prisma versions)
  - 5-slot assembly in canonical order from SLOT_ORDER constant
  - notaCursadaConfirmada = InscripcionMateria.notaCursada (ADR-3)
  - condicionCursada from CONDICION_LABEL record
  - intentosFinales from finalesByMC index
  - carreraName from Carrera.name → enrollment.grade → null (REQ-6)
  - cuatrimestresTerciario grouped in use case, sorted 1C→2C→ANUAL/other (ADR-5)
  Wired new fields in execute().

- [x] TASK-I3 — Rebuild boletin-terciario.hbs [IMPL]
  Replaced legacy promedio/valoracion table with transcript layout:
  - Title + header use {{#if carreraName}}...{{/if}} instead of {{grado}}
  - {{#if cuatrimestresTerciario}} guard for zero-inscripcion safety
  - {{#each cuatrimestresTerciario}} with section-title + grades table
  - 9 columns: Materia, Condición, Nota cursada, P1, P2, RP1, RP2, TP, Finales
  - intentosFinales rendered inline (intento: nota (condicion))
  - Kept attendance block and footer/signature-line unchanged

- [x] TASK-V1 — Run full test suite + verify coverage [VERIFY]
  - All 1283 tests pass (132 test files)
  - generate-boletin.use-case.ts: 85.6% statements / 87.64% lines (>80% ✓)
  - pnpm --filter api typecheck: only pre-existing errors (study-plan, competency, course-cycle)
  - No regressions in generate-boletin.inicial, generate-boletin.use-case, generate-boletin.docente-s2

---

## Files Changed

- `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts` (new, 24 tests)
- `api/src/application/reportes/templates/boletin.template.ts` (new Terciario types)
- `api/src/application/reportes/generate-boletin.use-case.ts` (new method + dispatch + execute wire)
- `api/src/infrastructure/reporting/html-templates/boletin-terciario.hbs` (rebuilt)
- `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` (updated Terciario regression)
- `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` (updated Terciario tests)

---

## Deferred

- Vencimiento de regularidad (no data model, out of scope per spec)
- BoletínTemplate class hierarchy (dead code, out of scope per spec)

---

## Test counts

- New tests: 24 (terciario.test.ts)
- Updated tests: 3 (in use-case.test.ts and docente-s2.test.ts)
- Total passing: 1283

---

## Known discoveries

- R1 (Prisma orderBy on to-one relation): implemented in-memory sort as mandatory fallback
- Legacy path coverage: 3 legacy path regression tests added to restore coverage after updating old level=40 tests
- actaExamenNota Q2 short-circuit: `materiaCarreraIds.length === 0 ? [] : await...` prevents unnecessary DB call
