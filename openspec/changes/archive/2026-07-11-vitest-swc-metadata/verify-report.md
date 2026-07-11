# Verify Report: vitest-swc-metadata (issue #100)

- **Change:** `vitest-swc-metadata`
- **Store:** hybrid (engram `sdd/vitest-swc-metadata/verify-report` + este archivo)
- **Verificado contra:** `HEAD f8ba34e` en `chore/vitest-swc-metadata` (main..HEAD = 5 commits: 4 de código + 1 de bookkeeping SDD)
- **Veredicto: PASS**

## Prioridad 1 — Sin residuo del enfoque revertido (ESLint `consistent-type-imports`)

| Chequeo | Resultado |
|---|---|
| `git diff main..HEAD -- eslint.config.mjs` | Vacío — CONFIRMADO, no tocado |
| `git diff main..HEAD -- 'api/**' \| rg 'eslint-disable.*consistent-type-imports'` | 0 matches — CONFIRMADO |
| `git diff --stat main..HEAD -- . ':!openspec'` | 4 files changed, 65 insertions(+), 9 deletions(-) |
| Archivos tocados | Exactamente los 4 esperados: `list-grupos-global.use-case.ts`, `attendance-type.controller.ts`, `student.controller.di.test.ts`, `vitest.config.ts` — ninguno extra |

**Limpio: SÍ.** Ningún rastro del intento global de autofix (247 archivos / 923+/879−). El enfoque mínimo quirúrgico es el único presente en el árbol.

## Prioridad 2 — Cobertura de requisitos (VSM-R1..R6)

| Requisito | Cumplido | Evidencia |
|---|---|---|
| **VSM-R1** — unplugin-swc wireado | Sí | `api/vitest.config.ts`: `plugins: [swc.vite({...})]` a nivel raíz (sibling de `test:`/`resolve:`), `jsc.transform.decoratorMetadata: true`, `parser.decorators: true`, `transform.legacyDecorator: true`, `module: { type: 'es6' }` — coincide exacto con `design.md §2` |
| **VSM-R2** — DI implícita resuelve en `TestingModule` | Sí | `student.controller.di.test.ts`: `Test.createTestingModule({ controllers: [StudentController], providers: [...12 stubs..., 'StudentRepository'] })`, `.overrideGuard(AuthGuard).useValue({ canActivate: () => true })`, `.compile()`, assert los 12 campos `toBeDefined()`. Corrido y confirmado GREEN en la suite completa |
| **VSM-R3** — andamiaje removido de `AttendanceTypeController` | Sí | `rg '@Inject' attendance-type.controller.ts` → 0 matches (verificado). e2e `attendance-type.controller.e2e.test.ts` pasa dentro de la suite completa (205/205 archivos verdes) |
| **VSM-R4** — tokens legítimos intactos | Sí | `rg '@Inject\(' api/src` (excl. tests) → exactamente 8 sitios: `PDF_PORT` x4 (pdf reportes/asistencia/constancia/attendance-types), `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'` x1, `'EventBus'` x1. Ninguno removido, ninguno con token/tipo alterado |
| **VSM-R5** — guard RED→GREEN | Sí (verificado empíricamente, no solo razonado) | Reverti temporalmente `vitest.config.ts` a la versión pre-wiring (`git show 835bdf5:api/vitest.config.ts`), corrí el guard aislado → **FALLÓ**: `AssertionError: createUC debe resolver: expected undefined to be defined`. Restauré el config wireado (`git diff` post-restore = 0 líneas, árbol limpio) → guard pasa dentro de la corrida completa (GREEN) |
| **VSM-R6** — suite completa sin regresión | Sí | `pnpm --filter api test` corrido por mí: **205/205 archivos, 2084/2084 tests, exit 0**, duration 56.00s. Coincide con lo reportado en apply-progress (205/205, 2084/2084, ~57-59s) |

**Cobertura: 6/6 completa, sin parciales.**

## Prioridad 3 — Fix de `list-grupos-global.use-case.ts`

- Las 4 interfaces (`GrupoRepository`, `GrupoGlobalRow`, `GrupoGlobalFilters`, `DocenteXCicloRepository`) están en un `import type { ... } from '@educandow/domain'` separado.
- `resolveAccessScope` (runtime) está en un `import { resolveAccessScope } from '@educandow/domain'` normal, separado.
- Verificado contra `packages/domain/src/index.ts`: las 4 interfaces se exportan como `export type { ... }` (líneas 223, 236); `resolveAccessScope` se exporta como `export { resolveAccessScope }` (línea 262) — el split es exacto, no hay type/runtime mezclados incorrectamente.
- El test `list-grupos-global.use-case.test.ts` (con `vi.mock('@educandow/domain')` estricto) pasa — confirmado dentro de la corrida completa de la suite (205/205 archivos verdes incluye este).

**Correcto: SÍ.**

## Prioridad 4 — typecheck + reconciliación

- `pnpm --filter api typecheck` → corrido por mí, **exit 0, sin output** (limpio).
- Reconciliación pendiente confirmada presente en `apply-progress.md` (sección "Reconciliation pending for verify/archive"), NO resuelta por mí (según instrucción):
  1. `design.md §4` afirma que los guards `@UseGuards` no se instancian durante `.compile()` — esto es FALSO con metadata real post-wiring (Nest los instancia eagerly). Mitigado en el guard vía `.overrideGuard(AuthGuard)`. `design.md` necesita corrección textual.
  2. Estimación de líneas en `proposal.md`/`design.md`/`tasks.md` (Review Workload Forecast, ~45 líneas) quedó desactualizada tras el descubrimiento de Phase 2a (fix del import mixto) — real: 36 líneas desde el guard RED, 74 incluyendo el archivo del guard. Ambos puntos son tareas para `sdd-archive`, no bloqueantes.

## Hallazgos

Ningún hallazgo CRITICAL. Ningún hallazgo WARNING de bloqueo.

- **SUGGESTION-1:** `design.md §4` tiene una afirmación técnica incorrecta sobre instanciación de guards en `.compile()` (ver Prioridad 4, punto 1). Debería corregirse en `sdd-archive` para que el design quede fiel al comportamiento real, útil para futuros lectores del historial.
- **SUGGESTION-2:** Las estimaciones de líneas en `proposal.md`/`tasks.md` deberían actualizarse al valor final real (36/74 líneas) al archivar, por trazabilidad histórica — no afecta la corrección del cambio en sí.
- **SUGGESTION-3 (informativo, no acción):** el 5º commit (`f8ba34e`) sobre `main` es bookkeeping SDD (`openspec/` únicamente) — no forma parte del diff de código auditado en Prioridad 1, mencionarlo explícitamente en el archive evita confusión sobre "cuántos commits" tiene el change.

## Veredicto final: **PASS**

Sin residuo del enfoque abandonado, los 6 requisitos del spec (VSM-R1..R6) están cumplidos con evidencia verificada de primera mano (no solo inspección de código — corrí la suite, el typecheck, y reproduje empíricamente el RED del guard revirtiendo temporalmente la config). El fix de `list-grupos-global` es correcto y mínimo. Las dos reconciliaciones pendientes son de documentación, no de comportamiento, y quedan explícitamente delegadas a `sdd-archive` sin bloquear el cierre del change.
