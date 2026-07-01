# Verify Report — tipos-asistencia-nivel-e-impresion

**Fecha:** 2026-07-01
**Branch verificado:** `feat/attendance-types-web-selector-print` (tip, contiene PR1→PR5 stacked, `git log --oneline main..feat/attendance-types-web-selector-print` = 15 commits)
**Veredicto: PASS WITH WARNINGS**

## Gates ejecutados (todos verdes)

| Comando | Resultado |
|---|---|
| `pnpm --filter @educandow/domain test` | 110 archivos / 1275 tests ✅ |
| `pnpm --filter api test` | 199 archivos / 2039 tests ✅ |
| `pnpm --filter web test` | 50 archivos / 612 tests ✅ |
| `pnpm --filter api typecheck` | limpio ✅ |
| `pnpm --filter web build` (`tsc -b && vite build`) | limpio (solo warning pre-existente de chunk size >500kB, no relacionado) ✅ |

Todos los números coinciden exactamente con lo reportado en apply-progress (#1670).

## Cobertura de requerimientos (spec → implementación → test, file:line)

| Requerimiento / Escenario | Implementación | Test |
|---|---|---|
| ADD-1.1/1.2/1.3 — colapso de modalidad a nivel base | `packages/domain/src/auth/access-scope.ts:16-32` (`baseLevels`) | `packages/domain/src/auth/__tests__/access-scope.test.ts:84-101` |
| REQ-17 (MOD) Listar — sin `?level` devuelve solo baseLevels | `api/.../attendance-type.use-cases.ts:173-183` (`ListAttendanceTypesUseCase`) | `attendance-type.use-cases.test.ts` (docente 1/N nivel, ROOT/ADMIN) + e2e `attendance-type.controller.e2e.test.ts:112-121` (200 in-scope) |
| REQ-17 — `?level` fuera de scope → 403 (Escenario 8.6/ADD-4.1) | `attendance-type.use-cases.ts:179-181` | e2e `attendance-type.controller.e2e.test.ts:102-110` (403 real, `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`) |
| Escenario 8.9 — 0 niveles base sin `?level` → 200 `{data:[]}` | `prisma-attendance-type.repository.ts:35` (`where.level={in:[]}` cuando `allowedLevels=[]`) | `prisma-attendance-type.repository.test.ts` (allowedLevels) |
| REQ-18 (MOD) Crear — `level` fuera de scope → 403 (Escenario 3.3-3.5) | `attendance-type.use-cases.ts:47-50` (`CreateAttendanceTypeUseCase`) | unit `attendance-type.use-cases.test.ts` + controller unit `attendance-type.controller.test.ts:132-145` (403 propagation) |
| REQ Editar — `entity.level` fuera de scope → 403 (Escenario 4.3-4.5) | `attendance-type.use-cases.ts:97-100` (`UpdateAttendanceTypeUseCase`) | e2e `attendance-type.controller.e2e.test.ts:123-134` (403 real) + `:135-145` (200 in-scope) |
| Delete scopeado (cierre de riesgo design §9) | `attendance-type.use-cases.ts:145-148` (`DeleteAttendanceTypeUseCase`) | e2e `attendance-type.controller.e2e.test.ts:146-156` (403/204 reales) |
| Get-by-id scopeado (cierre de riesgo design §9) | `attendance-type.use-cases.ts:204-207` (`GetAttendanceTypeUseCase`) | e2e `attendance-type.controller.e2e.test.ts:164-175` (403/200 reales) |
| ADD-3.1–3.4 — impresión PDF con MISMO scope que listado | `generate-attendance-types-pdf.use-case.ts:87-101` (idéntica estructura a `ListAttendanceTypesUseCase.execute`) | unit `generate-attendance-types-pdf.use-case.test.ts` + e2e `attendance-type.controller.e2e.test.ts:185-207` (200 pdf, 403 out-of-scope sin PDF) |
| ADD-4.2 — validación transporte ANTES del scope (400 vs 403) | `print-attendance-types.dto.ts` (Zod) aplicado en `attendance-type.controller.ts:93` antes del use-case | `print-attendance-types.dto.test.ts` + e2e `attendance-type.controller.e2e.test.ts:210-216` (400 antes de scope) |
| Ruta `/print` antes de `:id` (hazard Nest) | `attendance-type.controller.ts:89` (declarado antes de línea 109 `@Get(':id')`) | e2e `attendance-type.controller.e2e.test.ts:219-223` (`getUC` nunca invocado) |
| ADD-2.1–2.4 — selector web 1/N/0/ROOT | `web/.../attendance-types.tsx:30-46` (`collapseToBaseLevels`, `deriveAvailableLevels`) | `attendance-types-level-scope.test.ts` (unit puro) + `attendance-types.test.tsx` (componente, 1/N/0/ADMIN) |
| Botón Imprimir + ROOT institutionId fix | `attendance-types.tsx:261-284` | `attendance-types.test.tsx:746-828` (incluye caso ROOT institutionId dedicado) |
| Q4/ADR-07 — `allowedLevels` en repo Prisma | `prisma-attendance-type.repository.ts:35-36` | `prisma-attendance-type.repository.test.ts` |

**Los 4 criterios de aceptación transversales de la spec (sección final) se verifican funcionalmente:**
1. Ningún test sustituye 403 por 200+vacío — confirmado (e2e siempre 403 real ante out-of-scope).
2. `resolveAccessScope` es la única fuente de verdad — confirmado por grep (`rg baseLevels`), solo `access-scope.ts` calcula la fórmula; el front la replica manualmente (documentado como riesgo aceptado en design.md §9, por restricción CJS/ESM que impide importar runtime de domain en web).
3. El front nunca es la única barrera — confirmado, la suite e2e pega directo al controller/pipeline HTTP real bypaseando cualquier UI.
4. Impresión usa exactamente el mismo cálculo que el listado — confirmado por comparación línea a línea entre `ListAttendanceTypesUseCase.execute` y `GenerateAttendanceTypesPdfUseCase.execute`.

## Findings

### CRITICAL
Ninguno. Los 5 endpoints (list/create/update/delete/get-by-id) y el endpoint de impresión aplican el mismo gate de scope backend-first, con test e2e real (no solo mockeado) para list/update/delete/get/print. La barrera de seguridad — objetivo central del change — está cerrada en las 5 operaciones + impresión.

### WARNING
1. **`tasks.md` no está en 41/41 `[x]` como se esperaba.** T40 y T41 ("Cierre transversal": correr `pnpm build && pnpm test && pnpm lint` en la raíz, y verificar los 4 criterios transversales de la spec) quedan `[ ]` sin marcar en el archivo commiteado (`tasks.md:291`, `tasks.md:294`, commit `fbbf2a1`), pese a que el commit message dice "mark PR5 tasks (T31-T41) done" y el apply-progress narrativo (#1670) describe haber corrido esos comandos. Los checkboxes de "Criterios de aceptación transversales" en `spec.md:311-317` también quedan sin marcar. Es una inconsistencia de proceso/checklist, no funcional — este verify-report confirma en la sección anterior que los 4 criterios SÍ se cumplen en el código. Recomendado: marcar T40/T41 y los 4 checkboxes de spec.md como `[x]` antes de `sdd-archive` (o dejar que archive lo haga como parte del cierre).
2. **No hay test e2e real (pipeline HTTP completo) para `POST /attendance-types` fuera de scope.** El e2e file (`attendance-type.controller.e2e.test.ts`) cubre list/update/delete/get-by-id/print con supertest real, pero create (Escenario 3.3) solo tiene cobertura a nivel de use-case unitario (`attendance-type.use-cases.test.ts`) y controller unitario con mocks (`attendance-type.controller.test.ts:132-145`). Dado que el mapeo de excepción 403 ya se prueba 4 veces contra el pipeline real (list/update/delete/get), el riesgo residual es bajo, pero es una asimetría de cobertura respecto al resto de las operaciones.

### SUGGESTION
1. **Tres instancias de `PdfGeneratorService` module-scoped coexisten** (`asistencia-reporting.module.ts`, `reportes.module.ts`, y ahora `attendance-type.module.ts`), cada una potencialmente instanciando su propio singleton de Puppeteer. Sigue el precedente ya existente en el repo (ya había 2 antes de este change) — no es una regresión introducida por este change, pero conviene evaluar un `ReportingModule` compartido que exporte `PdfGeneratorService` una sola vez, para no seguir escalando instancias de browser en futuros reportes.
2. Contexto informativo (NO son findings de este change, ya verificados pre-existentes vía `git stash -u` hasta la punta de PR4 por el propio apply): lint errors pre-existentes en `api` (`subject-group-filter.db.test.ts`, `guardians.test.ts`) y `web` (`materia-grupos.tsx` hooks condicionales, `gestion-grupos.test.tsx` prefer-const) — fuera de alcance de este change.

## Persistencia
- openspec: `openspec/changes/tipos-asistencia-nivel-e-impresion/verify-report.md` (este archivo)
- engram: `sdd/tipos-asistencia-nivel-e-impresion/verify-report` (project: educandow)
