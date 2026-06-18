# Verify Report: evaluacion-terciario

> Phase: sdd-verify (re-run after C1 correction batch) · Date: 2026-06-18 · Branch: feat/evaluacion-terciario
> Tasks claimed: 35/35 complete + CRITICAL C1 fixed

## Verdict: PASS WITH WARNINGS

**0 CRITICAL · 3 WARNING · 2 SUGGESTION**

C1 is RESOLVED. No regressions. Archive may proceed.

---

## Test Suite Results

| Suite | Files | Tests | Status |
|---|---|---|---|
| `pnpm --filter @educandow/domain test` | 97 | 1092 | ALL PASS |
| `pnpm --filter api test` | 131 | 1259 | ALL PASS (+4 from C1 fix) |
| `pnpm --filter api typecheck` | — | — | Pre-existing errors only (study-plan/competency/course-cycle — unrelated to this change) |

---

## C1 — RESOLVED

**C1 — `intento` validation — was: dead code / missing field**

Status: **RESOLVED** (correction batch — commit 9c94c96)

Evidence:
- `RegistrarNotaFinalInput` now includes `intento: number`
  — `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` line 33
- `RegistrarNotaFinalSchema` now includes `intento: z.number().int().min(1).max(3)`
  — `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts` line 48
- `RegistrarNotaFinalUC.execute()` Step 5 validates range and returns `InvalidIntentoError`
  — same file, lines 151–154
- T27 tests: `intento=0 → Err(INVALID_INTENTO)` and `intento=4 → Err(INVALID_INTENTO)` — PASS
- T32 DTO tests: `intento:0 → parse fails` and `intento:4 → parse fails` — PASS
- Out-of-range `{ intento: 4 }` now correctly returns HTTP 422 `INVALID_INTENTO` (not HTTP 201)

---

## Findings

### WARNING

**W1 — TP guard blocks `DESAPROBADO`, spec allows it**

- **Spec** (marked `[SUPUESTO]`): "Un alumno MUST tener un slot TP registrado (con `condicion != AUSENTE`)". DESAPROBADO ≠ AUSENTE → should be allowed.
- **Implementation**: `tpSlot.condicion.get() !== 'APROBADO'` → blocks DESAPROBADO too.
- **Tests agree with implementation**, but diverge from spec text.
- **File**: `packages/domain/src/terciario/policies/final-eligibility-policy.ts` line 41
- **Action required before deploy**: validate against reglamento. If DESAPROBADO TP should allow sitting finals, change the guard to `=== 'AUSENTE'`.
- **Blocks archive?** No — the entire TP requirement is marked `[SUPUESTO]`.

**W2 — `nota-cursada-terciario.ts` entity: 66.66% line coverage in domain-only tests**

- Lines 45-56 (`updateNota`, `updateCondicion`, `updateFecha`) are not called from domain entity tests.
- These methods ARE exercised in `UpdateNotaCursadaSlotUC` tests in the API package.
- Overall domain package coverage: 89% (above 80%). This is a per-file gap, not a package-level gap.
- **File**: `packages/domain/src/terciario/entities/nota-cursada-terciario.ts`
- **Blocks archive?** No — 80% package threshold met.

**W3 — Migration SQL manually written, not applied to a database**

- Migration at `api/prisma_tenant/migrations/20260618000000_evaluacion_terciario/migration.sql` was hand-written because no local DB is available.
- FK reference `"inscripciones_materia"` matches Prisma schema `@@map` — structurally correct.
- Must run `pnpm --filter api prisma:migrate:tenant` against a real DB before deploy to validate.
- **Blocks archive?** No — this is a deploy prerequisite, not an implementation gap.

---

### SUGGESTION

**S1 — `RegistrarPromocionalUC` returns `CursadaNoConfirmadaError` for non-PROMOCIONAL students**

- Using the same error code as the "cursada not confirmed" guard is slightly misleading. A dedicated code (e.g. `ALUMNO_NO_PROMOCIONAL`) would improve client debuggability.
- Not blocking since it's a [SUPUESTO] path.

**S2 — `equals()` methods untested**

- `IntentoFinal.equals()` (line 22) and `SlotCursadaTerciario.equals()` (line 45) have no test coverage.
- Low risk (simple equality methods), but closes the coverage gap.

---

## What Is Correctly Implemented

- All 9 `DomainError` subclasses exist with correct `code` values ✓
- `AppExceptionFilter` registers all 9 codes with correct HTTP statuses (409/422) ✓
- `EstadoInscripcion` extended with `PROMOCIONAL` + `esRegular()`, `esLibre()`, `esPromocional()`, `esConfirmada()` ✓
- `RecuperatorioPolicy.check()`: duplicate check → prerequisite check (ADR-3 order) ✓
- `FinalEligibilityPolicy.check()`: guard order per design §5; `shouldTransitionToLibre()` correct ✓
- `RegistrarNotaFinalUC`: intento range validated (Step 5); `TenantTransactionRunner` used for atomic auto-LIBRE ✓
- ADR-2: `intento` assigned server-side (`intentosPrevios + 1`), not from client value ✓
- ADR-1: `condicion` payload maps to `InscripcionMateria.estado`; `PROMOCIONAL` added ✓
- `RegistrarNotaFinalInput` and `RegistrarNotaFinalSchema`: `intento` field present with correct Zod validation ✓
- Prisma tenant schema: `NotaCursadaTerciario` model, `intento` column, `@@unique`, FK ✓
- Migration SQL: `CREATE TABLE` + `ALTER TABLE ... DEFAULT 1` + idempotent `UPDATE` ✓
- `NivelTerciarioModule`: all new providers + controllers registered including `PrismaTenantTransactionRunner` ✓
- `Result<T,E>` pattern throughout; no throw in application layer ✓
- Zero-deps domain; Zod validation at all new controllers ✓
- `@Roles GRADES` + `@Levels TERCIARIO` on all new controllers ✓
- 3 `[SUPUESTO]` items marked in code ✓

---

## Archive Decision

No CRITICAL issues remain. 3 WARNINGs, all non-blocking:
- W1 is a `[SUPUESTO]` requirement needing external validation
- W2 is a per-file coverage gap, package threshold met
- W3 is a deploy prerequisite, not an implementation gap

**Archive may proceed.**
