# Design — reporting-errors-reclassification

> Architecture-level HOW for reclassifying the 11 reporting error codes into the layered error model
> (`DomainError` / `InfrastructureError`). Consumer of `application-error-handling` (Change 1, merged).
> Satisfies RER-R1..R8. Clean-arch direction: `api/application` → `@educandow/domain`.

## 0. Ground truth (verified against merged `main`)

Confirmed by reading the real code (not the explore snapshot):

- **`DomainError`** (`packages/domain/src/shared/errors/domain-error.ts`): abstract, `constructor(message, code)`, **NO `httpStatus`**. Status is resolved by `DOMAIN_STATUS[code] ?? 400` in the filter.
- **`NotFoundError`** (`.../not-found-error.ts`): `constructor(entity, id)` **hardcodes `code = 'NOT_FOUND'`**. It cannot carry a specific code → the 4 NOT_FOUND reporting codes MUST extend `DomainError` DIRECTLY (mirrors `CourseCycleClosedError`, which extends `DomainError` with its own code — see `course-cycle/errors/index.ts`).
- **`InfrastructureError`** (`api/src/application/shared/errors/infrastructure-error.ts`): abstract, **fixed `httpStatus = 500`**, `constructor(message, code)`. Already exists.
- **`TenantClientUnavailableError`** + **`TemplateNotFoundError`** already exist in `api/src/application/shared/errors/infrastructure-errors.ts` (Change 1). `TemplateNotFoundError`'s code is deliberately `'TEMPLATE_NOT_FOUND'` — reusable verbatim.
- **`exception.filter.ts`** ALREADY has an `instanceof DomainError` branch (lines 103-105) using `DOMAIN_STATUS[code] ?? 400`. **We only ADD 8 map entries — no new filter branch.** The `InfrastructureError` branch (lines 99-102) already handles `TenantClientUnavailableError` / `TemplateNotFoundError` / the new `InstitutionNotFoundError` at 500.
- **`unwrapResultOrThrow.ts`**: has `ApplicationError` and `InfrastructureError` re-throw branches but **NO `DomainError` branch**, and its generic bound is `E extends { httpStatus: number; code: string; message: string }` — which `DomainError` does NOT satisfy (no `httpStatus`). This is the single load-bearing shared edit (RER-R4).
- None of the 8 DomainError codes currently exist in `DOMAIN_STATUS` (verified: `USER_NOT_FOUND` exists but is distinct; there is NO generic `STUDENT_NOT_FOUND`/`COURSE_CYCLE_NOT_FOUND`/`AXCC_NOT_FOUND`). **All 8 entries are additive, zero dupes.**
- **Module locality of the 3 old classes** (drives deletion timing):
  - `AsistenciaReportingError` — defined in its own file `asistencia-reporting.errors.ts`, referenced ONLY by the asistencia module → deletable in Slice 1.
  - `ConstanciaError` — defined inline in `templates/constancia.template.ts`, referenced ONLY by constancia → deletable in Slice 3.
  - `BoletinError` — defined inline in `generate-boletin.use-case.ts`, referenced by BOTH `generate-boletin.use-case.ts` AND `generate-boletin-batch.use-case.ts` → deletable only once BOTH are migrated (Slice 2).

### Build-resolution gotcha (verified — CRITICAL, refines the explore note)

- **Vitest** aliases `@educandow/domain` → `../packages/domain/src` (SOURCE) (`api/vitest.config.ts:37`). Unit tests see new domain exports **immediately, no rebuild**.
- **`tsc --noEmit`** (`pnpm --filter api typecheck`) has **NO path alias** for `@educandow/domain` (`api/tsconfig.json` only maps `@/*`) → it resolves through `node_modules` to the **BUILT dist**. So typecheck/build read STALE dist until rebuilt.
- **Rule:** after touching `packages/domain`, run `pnpm --filter @educandow/domain build` BEFORE `pnpm --filter api typecheck` / `pnpm build`. Skipping it yields a **false RED** on typecheck ("`AxccNotFoundError` has no exported member") even though vitest is green — the classic split-brain that makes you distrust a correct change. Sequence per slice: domain build → api typecheck → vitest.

## 1. Architecture approach

**Pattern:** per-code concrete error subclasses in the correct tier, with codes preserved. No behavioral change beyond the tenant wire-code fix (RER-R3). This is a compilation-gated reclassification — the type system forces every call site and return-type union to be updated together.

**Layering / boundaries:**
- **Tier 1 `DomainError`** (invariants + NOT_FOUND with specific codes) → new module `packages/domain/src/reportes/errors/`. Home in the domain package because these are semantic invariants of the reporting read-model, and `api/application` legitimately imports them (clean-arch inward dependency).
- **Tier 3 `InfrastructureError`** (dependency/artifact failures, always 500) → `api/src/application/shared/errors/infrastructure-errors.ts` (co-located with the existing infra classes; no new dir). Reuse `TenantClientUnavailableError` + `TemplateNotFoundError`; add `InstitutionNotFoundError`.
- **Boundary mapping** stays exactly where it is today: `AppExceptionFilter` (DomainError → `DOMAIN_STATUS`, InfrastructureError → fixed 500) and `unwrapResultOrThrow` (re-throw identity-preserving so the filter maps the original instance).

## 2. New DomainError subclasses — `packages/domain/src/reportes/errors/index.ts`

All extend `DomainError` **directly** (NOT `NotFoundError`, which would force `code='NOT_FOUND'`). Constructor takes `message: string` so each call site preserves its EXACT current Spanish string (RER-R6 — identical body). Barrel mirrors `course-cycle/errors`.

```ts
import { DomainError } from '../../shared/errors/domain-error';

/** Reporting NOT_FOUND / invariant errors — specific codes preserved (RER-R1). */

export class AxccNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'AXCC_NOT_FOUND');
  }
}

export class ReporteStudentNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_FOUND');
  }
}

export class ReporteCourseCycleNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'COURSE_CYCLE_NOT_FOUND');
  }
}

export class MateriaXCursoXCicloNotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND');
  }
}

export class StudentNotPrintableError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_PRINTABLE');
  }
}

export class StudentNotEligibleError extends DomainError {
  constructor(message: string) {
    super(message, 'STUDENT_NOT_ELIGIBLE');
  }
}

export class BoletinLevelUnknownError extends DomainError {
  constructor(message: string) {
    super(message, 'BOLETIN_LEVEL_UNKNOWN');
  }
}

export class BatchAllFailedError extends DomainError {
  constructor(message: string) {
    super(message, 'BATCH_ALL_FAILED');
  }
}
```

**Naming rationale:** `Reporte`-prefix on `ReporteStudentNotFoundError` / `ReporteCourseCycleNotFoundError` disambiguates from the pre-existing generic `CourseCycleNotFoundError` (code `NOT_FOUND`) and any future `StudentNotFoundError`; the other 6 codes are reporting-unique so keep their natural names. All 8 classes are cross-module-shareable within reporting (Boletin + Constancia both throw `AXCC_NOT_FOUND` / `STUDENT_NOT_FOUND` / `COURSE_CYCLE_NOT_FOUND` → one class each, no per-module duplication).

**Barrel + package export (mirror `course-cycle`):**
- New `packages/domain/src/reportes/index.ts`:
  ```ts
  export {
    AxccNotFoundError,
    ReporteStudentNotFoundError,
    ReporteCourseCycleNotFoundError,
    MateriaXCursoXCicloNotFoundError,
    StudentNotPrintableError,
    StudentNotEligibleError,
    BoletinLevelUnknownError,
    BatchAllFailedError,
  } from './errors';
  ```
- Edit `packages/domain/src/index.ts` — add (near the other error exports, ~line 8):
  ```ts
  export {
    AxccNotFoundError,
    ReporteStudentNotFoundError,
    ReporteCourseCycleNotFoundError,
    MateriaXCursoXCicloNotFoundError,
    StudentNotPrintableError,
    StudentNotEligibleError,
    BoletinLevelUnknownError,
    BatchAllFailedError,
  } from './reportes';
  ```
Consumers import from the package root: `import { AxccNotFoundError } from '@educandow/domain'`.

## 3. New InfrastructureError subclass — `api/src/application/shared/errors/infrastructure-errors.ts`

Append (fixed 500 comes from the base; preserves code `INSTITUTION_NOT_FOUND`):

```ts
/**
 * InstitutionNotFoundError — the institution row is absent in the MASTER DB although
 * an institutionId is present on the TenantContext. A master/tenant data-integrity
 * fault (dangling reference), not a client-visible domain outcome → HTTP 500 (preserved).
 */
export class InstitutionNotFoundError extends InfrastructureError {
  constructor(message = 'Institución no encontrada') {
    super(message, 'INSTITUTION_NOT_FOUND');
  }
}
```

Default message matches the single current call site (Constancia L153), so RER-R6 body is identical.

## 4. DOMAIN_STATUS entries — `api/src/presentation/shared/filters/exception.filter.ts`

Add these 8 entries to the `DOMAIN_STATUS` record (append a reporting block before the closing `}` at ~line 60). None already exist → zero dupes.

```ts
  // Reportes — reporting-errors-reclassification (RER-R2)
  AXCC_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  COURSE_CYCLE_NOT_FOUND: 404,
  MATERIA_X_CURSO_X_CICLO_NOT_FOUND: 404,
  STUDENT_NOT_PRINTABLE: 422,
  STUDENT_NOT_ELIGIBLE: 422,
  BOLETIN_LEVEL_UNKNOWN: 422,
  BATCH_ALL_FAILED: 422,
```

No new `instanceof` branch — the `DomainError` branch (lines 103-105) already reads `DOMAIN_STATUS[code] ?? 400`. A missing entry silently regresses to 400; the regression-guard test (§7) locks this.

## 5. unwrapResultOrThrow — DomainError branch + bound relaxation (RER-R4, load-bearing)

**The type problem:** relaxing the bound to drop `httpStatus` makes the generic fallback's `error.httpStatus` fail to type-check (TS does not negatively-narrow a generic `E` after `instanceof` guards). **Solution: make `httpStatus` OPTIONAL in the bound** — `DomainError` satisfies it (absent is allowed), while `PdfError`/`ApplicationError`/`InfrastructureError` satisfy it (present as `number`). Then read it defensively in the fallback.

**Before** (lines 32-49):
```ts
export function unwrapResultOrThrow<T, E extends { httpStatus: number; code: string; message: string }>(
  result: Result<T, E>,
): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    if (error instanceof InfrastructureError) {
      throw error; // preserve instanceof identity so AppExceptionFilter reads code/httpStatus
    }
    throw new HttpException(
      { statusCode: error.httpStatus, code: error.code, message: error.message },
      error.httpStatus,
    );
  }
  return result.unwrap();
}
```

**After:**
```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../../../application/shared/errors/application-error';
import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';

export function unwrapResultOrThrow<T, E extends { code: string; message: string; httpStatus?: number }>(
  result: Result<T, E>,
): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    if (error instanceof InfrastructureError) {
      throw error; // preserve instanceof identity so AppExceptionFilter reads code/httpStatus (fixed 500)
    }
    if (error instanceof DomainError) {
      throw error; // RER-R4: re-throw as-is so AppExceptionFilter maps DOMAIN_STATUS[code], NOT the untyped fallback
    }
    const status = error.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    throw new HttpException(
      { statusCode: status, code: error.code, message: error.message },
      status,
    );
  }
  return result.unwrap();
}
```

**Why this type-checks and preserves behavior:**
- `httpStatus?: number` is the relaxation: `DomainError` (no `httpStatus`) NOW satisfies the bound; `PdfError`/`ApplicationError`/`InfrastructureError` still satisfy it.
- The new `instanceof DomainError` branch sits AFTER `ApplicationError`/`InfrastructureError` and BEFORE the fallback (exact ordering RER-R4 mandates). A `DomainError` is re-thrown identity-preserving → `AppExceptionFilter`'s `DomainError` branch maps `DOMAIN_STATUS[code]`.
- Fallback only runs for errors that are none of the three tiers (e.g. `PdfError`, which extends `Error` directly and carries `httpStatus`/`code`/`message`). `error.httpStatus` is now typed `number | undefined`; `?? INTERNAL_SERVER_ERROR` satisfies TS AND is behavior-preserving because those errors always carry a real `httpStatus` (RER-R4 scenario 2). The `code` key is still emitted so the filter's `HttpException` branch re-reads it.
- The doc-comment block (lines 1-26) MUST be updated: drop the stale mention of `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` as bare classes still flowing through the generic branch (they no longer exist post-change) and document the new `DomainError` branch.

This is the ONLY shared file whose type surface changes; every reporting controller already routes through this helper (Change 2), so the branch is exercised end-to-end with zero controller edits.

## 6. Per-code call-site migration (verified line numbers)

Each swap is `err(new <Old>('msg', 'CODE', status))` → `err(new <NewSubclass>('msg'))` (same message string → identical body). Return-type unions and the private `tenantClient()` signatures also change from `...Error` to the concrete new classes. Imports updated from the inline/legacy class to `@educandow/domain` (domain subclasses) and `../shared/errors/infrastructure-errors` (infra subclasses).

### 6.1 `generate-boletin.use-case.ts`
| Line | Old | New |
|---|---|---|
| L131 | `new BoletinError('Alumno×Curso×Ciclo no encontrado', 'AXCC_NOT_FOUND', 404)` | `new AxccNotFoundError('Alumno×Curso×Ciclo no encontrado')` |
| L134 | `new BoletinError('El alumno está marcado como no imprimible', 'STUDENT_NOT_PRINTABLE', 422)` | `new StudentNotPrintableError('El alumno está marcado como no imprimible')` |
| L150 | `new BoletinError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404)` | `new ReporteCourseCycleNotFoundError('CourseCycle no encontrado')` |
| L168 | `new BoletinError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404)` | `new ReporteStudentNotFoundError('Alumno no encontrado')` |
| L215 | `new BoletinError('Nivel pedagógico no soportado para boletín: ...', 'BOLETIN_LEVEL_UNKNOWN', 422)` | `new BoletinLevelUnknownError('Nivel pedagógico no soportado para boletín: ...')` |
| L898 (`tenantClient`) | `new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500)` | `new TenantClientUnavailableError()` |
| L938 (`getBaseLevel`) | `new BoletinError('Nivel pedagógico desconocido: ...', 'BOLETIN_LEVEL_UNKNOWN', 422)` | `new BoletinLevelUnknownError('Nivel pedagógico desconocido: ...')` |

- Delete the inline `BoletinError` class (L37-46) **in Slice 2** (batch also references it).
- `execute` return type: `Result<Buffer, PdfError | AxccNotFoundError | StudentNotPrintableError | ReporteCourseCycleNotFoundError | ReporteStudentNotFoundError | BoletinLevelUnknownError | TenantClientUnavailableError>`.
- `getBaseLevel` return: `Result<string, BoletinLevelUnknownError>`. `tenantClient` return: `Result<TenantPrismaClient, TenantClientUnavailableError>`.

### 6.2 `generate-boletin-batch.use-case.ts`
| Line | Old | New |
|---|---|---|
| L113 | `new BoletinError('No se pudo generar ningún boletín del lote — todos fallaron', 'BATCH_ALL_FAILED', 422)` | `new BatchAllFailedError('No se pudo generar ningún boletín del lote — todos fallaron')` |
| L152 (`tenantClient`) | `new BoletinError('No tenant context available', 'INTERNAL_ERROR', 500)` | `new TenantClientUnavailableError()` |

- Update the import on L8 (`import { GenerateBoletinUseCase, BoletinError }`) → drop `BoletinError`, import `BatchAllFailedError` from `@educandow/domain` and `TenantClientUnavailableError` from infra.
- `execute` return: `Result<Buffer, BatchAllFailedError | TenantClientUnavailableError>` (singleUC errors are swallowed by the `continue`, never returned). `tenantClient`: `Result<TenantPrismaClient, TenantClientUnavailableError>`.

### 6.3 `generate-constancia-regular.use-case.ts`
| Line | Old | New |
|---|---|---|
| L97 | `new ConstanciaError('No tenant context available', 'INTERNAL_ERROR', 500)` | `new TenantClientUnavailableError()` |
| L105 | `new ConstanciaError('AlumnosXCursoXCiclo no encontrado', 'AXCC_NOT_FOUND', 404)` | `new AxccNotFoundError('AlumnosXCursoXCiclo no encontrado')` |
| L117 | `new ConstanciaError('Alumno no encontrado', 'STUDENT_NOT_FOUND', 404)` | `new ReporteStudentNotFoundError('Alumno no encontrado')` |
| L124 | `new ConstanciaError('El alumno tiene fecha de pase... regular', 'STUDENT_NOT_ELIGIBLE', 422)` | `new StudentNotEligibleError('El alumno tiene fecha de pase... regular')` |
| L137 | `new ConstanciaError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404)` | `new ReporteCourseCycleNotFoundError('CourseCycle no encontrado')` |
| L153 | `new ConstanciaError('Institución no encontrada', 'INSTITUTION_NOT_FOUND', 500)` | `new InstitutionNotFoundError('Institución no encontrada')` |
| L192 | `new ConstanciaError('Template constancia-regular.hbs no encontrado', 'TEMPLATE_NOT_FOUND', 500)` | `new TemplateNotFoundError('constancia-regular.hbs')` |

- L13 import `ConstanciaError` from `./templates/constancia.template` → replace with imports from `@educandow/domain` (domain subclasses) + `../shared/errors/infrastructure-errors` (`TenantClientUnavailableError`, `InstitutionNotFoundError`, `TemplateNotFoundError`).
- **`TemplateNotFoundError(templateName)`** builds its own message `Template {name} no encontrado` — the wire message changes from `'Template constancia-regular.hbs no encontrado'` to `'Template constancia-regular.hbs no encontrado'`... verify: `TemplateNotFoundError('constancia-regular.hbs')` → `Template constancia-regular.hbs no encontrado` — **identical**. Good.
- `execute` return: `Result<Buffer, PdfError | TenantClientUnavailableError | AxccNotFoundError | ReporteStudentNotFoundError | StudentNotEligibleError | ReporteCourseCycleNotFoundError | InstitutionNotFoundError | TemplateNotFoundError>`.
- Delete `ConstanciaError` class from `templates/constancia.template.ts` (L33-42) **in Slice 3**.

### 6.4 `generate-asistencia-mensual-pdf.use-case.ts`
| Line | Old | New |
|---|---|---|
| L161 | `new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404)` | `new ReporteCourseCycleNotFoundError('CourseCycle no encontrado')` |
| L198 | `new AsistenciaReportingError('MateriaXCursoXCiclo no encontrada', 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND', 404)` | `new MateriaXCursoXCicloNotFoundError('MateriaXCursoXCiclo no encontrada')` |
| L209 | `new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404)` | `new ReporteCourseCycleNotFoundError('CourseCycle no encontrado')` |
| L243 (`render`) | `new AsistenciaReportingError('Template asistencia-mensual.hbs no encontrado', 'TEMPLATE_NOT_FOUND', 500)` | `new TemplateNotFoundError('asistencia-mensual.hbs')` |
| L386 (`tenantClient`) | `new AsistenciaReportingError('No tenant context available', 'INTERNAL_ERROR', 500)` | `new TenantClientUnavailableError()` |

- L54 import `AsistenciaReportingError` → replace with `@educandow/domain` (`ReporteCourseCycleNotFoundError`, `MateriaXCursoXCicloNotFoundError`) + infra (`TemplateNotFoundError`, `TenantClientUnavailableError`).
- `executeGeneral`/`executeMateria` return: `Result<Buffer, PdfError | ReporteCourseCycleNotFoundError | MateriaXCursoXCicloNotFoundError | TemplateNotFoundError | TenantClientUnavailableError | ForbiddenError>`.
- `render` return: `Result<Buffer, PdfError | TemplateNotFoundError>`. `tenantClient`: `Result<TenantPrismaClient, TenantClientUnavailableError>`. `checkDoor2General`/`checkDoor2Materia`: `Result<void, ForbiddenError | TenantClientUnavailableError>`.
- Delete `AsistenciaReportingError` (whole file `asistencia-reporting.errors.ts`) **in Slice 1** (single-module).

**Tenant wire-code + message note (RER-R3):** `TenantClientUnavailableError()` sets `code='TENANT_CLIENT_UNAVAILABLE'` (the sanctioned wire-code change) and message `'No tenant client available'` (was `'No tenant context available'`). The message delta is cosmetic on a 500 the frontend does not surface (verified in #2) and is an accepted consequence of decision #4 (reuse the Change-1 class). Status 500 unchanged. If a more descriptive message is wanted, pass context: `new TenantClientUnavailableError('boletin')` — optional, not required.

## 7. Test strategy (strict TDD — RED first)

Runner: `pnpm --filter api test` (vitest, source-aliased → no domain rebuild for tests). Coverage ≥ 80%.

1. **Per-code unit tests (RER-R8, all 11 codes).** For each new class: `instanceof` the correct tier, `code === '<expected>'`, and status. Domain subclasses: `new AxccNotFoundError('x')` → `instanceof DomainError`, `code==='AXCC_NOT_FOUND'`; status asserted by passing the instance through `AppExceptionFilter` and expecting 404/422. Infra: `InstitutionNotFoundError` → `instanceof InfrastructureError`, `code==='INSTITUTION_NOT_FOUND'`, `httpStatus===500`. Tenant guards: assert `code==='TENANT_CLIENT_UNAVAILABLE'` + 500. `TEMPLATE_NOT_FOUND`: assert reuse of Change-1 `TemplateNotFoundError` (`code==='TEMPLATE_NOT_FOUND'`, 500).
2. **DOMAIN_STATUS 400-regression guard (RER-R2).** Table-driven test: for each of the 8 domain codes, build an instance, run it through `AppExceptionFilter`, assert the status is the documented 404/422 and **NEVER 400**. This is the canary for a forgotten map entry.
3. **unwrapResultOrThrow DomainError branch (RER-R4).** (a) `err(new AxccNotFoundError('x'))` → the helper `throw`s that EXACT instance (`instanceof DomainError`, identity-preserving), NOT a synthesized `HttpException`; then the filter maps 404. (b) Regression: a bare `PdfError`-shaped error (has `httpStatus`) still hits the generic `HttpException` fallback with its status and `code` preserved. (c) `tsc` compiles for a caller typed `Result<T, DomainError | PdfError>`.
4. **Existing controller/use-case tests** (`reportes.controller.test.ts`, the 3 use-case suites) — re-derive asserts from `.toBeInstanceOf(BoletinError)` etc. to the new concrete classes; the wire `code`/`status` assertions stay identical (except tenant `code`).
5. **RER-R5 grep guard** (can be a lint/CI check or a test): no production or test file references `BoletinError` / `ConstanciaError` / `AsistenciaReportingError` after all slices.

**Per-slice green sequence:** `pnpm --filter @educandow/domain build` → `pnpm --filter api typecheck` → `pnpm --filter api test`. Do NOT trust a green vitest alone when you also changed domain exports — typecheck reads dist.

## 8. Slicing (stacked on `main`, each compiles green)

| Slice | Contents | Files | Est. lines | Deletable old class |
|---|---|---|---|---|
| **0 — shared (additive)** | `reportes/errors/index.ts` + `reportes/index.ts` + domain root `index.ts` export; `InstitutionNotFoundError` in infra-errors; `unwrapResultOrThrow` DomainError branch + bound relax + doc update; 8 `DOMAIN_STATUS` entries; tests (per-class domain, InstitutionNotFoundError, unwrap branch, DOMAIN_STATUS guard) | ~10 | ~300 | — (no call site touched → zero behavior change) |
| **1 — AsistenciaReporting** | migrate 5 call sites + unions in `generate-asistencia-mensual-pdf.use-case.ts`; **delete** `asistencia-reporting.errors.ts`; update asistencia tests | ~3-4 | ~150 | `AsistenciaReportingError` (single-module) |
| **2 — Boletin + batch** | migrate `generate-boletin.use-case.ts` (7 sites) + `generate-boletin-batch.use-case.ts` (2 sites); **delete** inline `BoletinError`; update boletin/controller tests | ~4-5 | ~250 | `BoletinError` (both refs now gone) |
| **3 — Constancia** | migrate `generate-constancia-regular.use-case.ts` (7 sites); **delete** `ConstanciaError` from `templates/constancia.template.ts`; update constancia tests; final RER-R5 grep guard | ~3-4 | ~180 | `ConstanciaError` (single-module) |

**Why Slice 0 first + additive:** the shared branch/bound/entries can land with zero call-site changes and zero behavior change (nothing constructs a `DomainError` reporting subclass yet), so it de-risks the load-bearing edit independently. **Why Asistencia is Slice 1:** cleanest module, no ambiguous codes, proves the pattern end-to-end. **Why Boletin before... wait — Boletin (Slice 2) before Constancia (Slice 3):** `BoletinError` spans 2 modules so its deletion is the slice with the most edits; doing it before Constancia keeps the final slice small and lets the RER-R5 grep guard run last against a fully-migrated tree. Old-class deletion is per-slice (each old class dies in the slice that migrates its last reference) — NOT deferred to one big final slice, because module-locality allows it and keeps each PR self-consistently green.

Total ≈ 20-23 files (15-16 production + tests), ~880 lines across 4 stacked PRs.

## 9. Verification checklist (per requirement)

- **RER-R1** — 8 domain subclasses + `InstitutionNotFoundError` exist with preserved codes; `TEMPLATE_NOT_FOUND`/tenant reuse Change-1 classes (no reportes-local infra class). ✔ §2,§3,§6.
- **RER-R2** — 8 `DOMAIN_STATUS` entries added; 400-regression guard test green. ✔ §4,§7.2.
- **RER-R3** — 3 tenant guards emit `TENANT_CLIENT_UNAVAILABLE` at 500; no other code string changes (diff-grep the 8 preserved codes). ✔ §6 note.
- **RER-R4** — `unwrapResultOrThrow` has `instanceof DomainError` re-throw between InfrastructureError and fallback; bound `httpStatus?: number`; `tsc` green (after domain dist rebuild); branch + fallback tests green. ✔ §5,§7.3.
- **RER-R5** — grep for the 3 old class names returns zero hits post-Slice 3. ✔ §7.5.
- **RER-R6** — messages/status/body shape identical except tenant `code` (and the cosmetic tenant message on a non-surfaced 500). Snapshot/controller tests unchanged except tenant code. ✔ §6.
- **RER-R7** — no `throw`→`Result` conversion; `application-error.ts` / `infrastructure-error.ts` base classes untouched (not in diff); no #3b module touched. ✔ (design edits only subclasses + shared boundary + call sites).
- **RER-R8** — every one of the 11 codes has instanceof+code+status test; unwrap DomainError branch covered. ✔ §7.1,§7.3.
- **Build gotcha** — each slice runs `domain build → api typecheck → vitest`; never trust vitest-green alone after domain export changes. ✔ §0,§7.

## 10. Architectural risks

- **Bound relaxation regressions the fallback typing.** Mitigated by `httpStatus?: number` (optional, not removed) + `?? INTERNAL_SERVER_ERROR`; covered by the bare-error fallback test (§7.3b). If any existing caller relied on `httpStatus` being statically required, it still compiles (present callers all carry it).
- **Forgotten DOMAIN_STATUS entry → silent 400.** The table-driven guard (§7.2) is the hard stop; without it a code regresses invisibly.
- **domain dist split-brain.** Highest operational risk: vitest green while typecheck red (or worse, stale-green). Fixed by the mandatory per-slice sequence.
- **Tenant message delta** (`context`→`client`) on 3 guards — accepted per decision #4; only a concern if some client scrapes the 500 body message (verified not the case in #2).
- **Return-type union verbosity** — the explicit unions on `execute` are long but give exhaustiveness; acceptable vs. widening to `DomainError | InfrastructureError | PdfError` (which would lose per-error precision at controllers). Chosen: explicit unions.
