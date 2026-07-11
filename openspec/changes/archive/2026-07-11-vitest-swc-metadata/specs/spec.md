# Spec (nueva) — Test Infrastructure: paridad de metadata DI test↔prod

- **Change name:** `vitest-swc-metadata`
- **Store:** hybrid (engram `sdd/vitest-swc-metadata/spec` + este archivo)
- **Basado en:** `openspec/changes/vitest-swc-metadata/proposal.md` (issue #100)
- **Convención:** Given/When/Then + RFC 2119 (MUST/MUST NOT/SHOULD/MAY). Cada escenario es verificable de forma aislada, apto para derivar un test directamente (TDD estricto activo).
- **Nivel pedagógico afectado:** `N/A` — infraestructura de test (transform de Vitest + andamiaje de DI), no toca dominio ni currícula; aplica transversalmente a toda la suite `api`.
- **Capability:** NUEVA — `test-infrastructure` (no existe hoy en `openspec/specs/`; primer spec del dominio). IDs de este change: `VSM-R*` / `VSM-S*`.
- **Cross-references:** ninguna spec existente cubre el transform de Vitest ni la paridad de metadata de decoradores; este spec establece la línea base del dominio.

## Fuera de alcance de esta spec (explícito)

- Remover los 8 `@Inject(TOKEN)` legítimos (tokens `Symbol`/string: `PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`, `'EventBus'`) — la reflexión de metadata NUNCA resuelve tokens no-clase; deben permanecer para siempre.
- e2e completo de los 12 endpoints de `StudentController` — follow-up ticket separado.
- Medición formal de presupuesto de performance de la suite — se valida cualitativamente (sin regresión de tiempo significativa), no se fija un número.

---

## VSM-R1 — `unplugin-swc` wireado en el transform de Vitest

`api/vitest.config.ts` MUST registrar `unplugin-swc` (variante `/vite`) dentro de `plugins: []`, de modo que el transform TS→JS usado por Vitest para toda la suite `api` emita `design:paramtypes` — paridad con el builder de producción (`nest-cli.json` → `builder: "swc"`).

### VSM-S1 — El plugin está registrado y activo

- GIVEN el archivo `api/vitest.config.ts`
- WHEN se inspecciona la configuración exportada por `defineConfig`
- THEN `test.plugins` (o el array `plugins` equivalente de Vite) MUST incluir el plugin de `unplugin-swc`
- AND MUST NOT quedar el transform default de esbuild como único transform para archivos `.ts`

---

## VSM-R2 — DI implícita resuelve dentro de `Test.createTestingModule` (requisito central)

Dentro de un `TestingModule` construido con `Test.createTestingModule`, un controller cuyos parámetros de constructor son tipos de CLASE (sin `@Inject` explícito) MUST resolver TODAS sus dependencias a instancias válidas — ninguna MUST llegar `undefined`.

### VSM-S2a — `StudentController` resuelve sus 12 use-cases sin `@Inject`

- GIVEN un `TestingModule` que provee `StudentController` y providers mock para sus 12 use-cases (tipados por clase, sin decorar con `@Inject` en el constructor del controller) más el provider del token `'StudentRepository'`
- WHEN se construye el módulo y se resuelve `StudentController`
- THEN los 12 use-cases inyectados MUST ser instancias definidas (no `undefined`)
- AND cada uno MUST ser la instancia mock provista (identidad preservada)

### VSM-S2b — `AttendanceTypeController` resuelve sus 6 use-cases sin `@Inject` de andamiaje

- GIVEN un `TestingModule` que provee `AttendanceTypeController` (tras remover el andamiaje, ver VSM-R3) y providers mock para sus 6 use-cases
- WHEN se construye el módulo y se resuelve `AttendanceTypeController`
- THEN los 6 use-cases inyectados MUST ser instancias definidas (no `undefined`)

---

## VSM-R3 — Andamiaje `@Inject(Clase)` removido de `AttendanceTypeController`

`attendance-type.controller.ts` MUST NOT contener los 6 `@Inject(Clase)` de andamiaje (categoría B: `CreateAttendanceTypeUseCase`, `ListAttendanceTypesUseCase`, `GetAttendanceTypeUseCase`, `UpdateAttendanceTypeUseCase`, `DeleteAttendanceTypeUseCase`, `GenerateAttendanceTypesPdfUseCase`) una vez wireado `unplugin-swc`. El e2e existente (`attendance-type.controller.e2e.test.ts`) MUST seguir pasando sin ellos.

### VSM-S3 — El e2e de attendance-type pasa sin el andamiaje

- GIVEN `attendance-type.controller.ts` con el constructor SIN `@Inject(Clase)` en ninguno de sus 6 parámetros de use-case
- AND `unplugin-swc` ya wireado (VSM-R1 satisfecho)
- WHEN se ejecuta `attendance-type.controller.e2e.test.ts`
- THEN la suite completa de ese archivo MUST pasar sin modificar sus assertions ni la forma de sus mocks

---

## VSM-R4 — Tokens legítimos (`Symbol`/string) intactos (guardarraíl)

Los 8 `@Inject(TOKEN)` que usan tokens `Symbol`/string (`PDF_PORT` en los 4 use-cases de PDF, `MATERIA_PREVIA_REPOSITORY` en los 2 use-cases de materias previas, `'StudentRepository'` en `StudentController`, `'EventBus'` en `user-registered.handler.ts`) MUST permanecer sin cambios. Este requisito protege contra over-cleanup: `design:paramtypes` NUNCA resuelve tokens no-clase, removerlos rompe la DI en runtime independientemente del transform.

### VSM-S4 — Ningún token legítimo fue removido

- GIVEN el árbol de código bajo `api/src` tras aplicar VSM-R1 y VSM-R3
- WHEN se inspeccionan los 8 sitios listados en el inventario (`PDF_PORT` x4, `MATERIA_PREVIA_REPOSITORY` x2, `'StudentRepository'`, `'EventBus'`)
- THEN cada uno MUST seguir teniendo su `@Inject(TOKEN)` explícito, sin cambios de token ni de tipo de parámetro

---

## VSM-R5 — Guard de regresión para `StudentController` (RED→GREEN obligatorio)

MUST existir un test que instancie `StudentController` vía `Test.createTestingModule` y afirme que sus 12 use-cases resuelven (ninguno `undefined`). Este test MUST fallar bajo el transform esbuild (estado previo a VSM-R1) y MUST pasar una vez wireado `unplugin-swc`.

### VSM-S5 — RED con esbuild, GREEN con unplugin-swc

- GIVEN el test descrito en VSM-S2a, ejecutado ANTES de aplicar VSM-R1 (transform = esbuild default)
- WHEN se corre ese test
- THEN MUST fallar — los use-cases resueltos MUST ser `undefined` (constructor sin `design:paramtypes`, Nest no puede mapear parámetro→token)
- GIVEN el mismo test, ejecutado DESPUÉS de aplicar VSM-R1 (transform = unplugin-swc)
- WHEN se corre ese test
- THEN MUST pasar — los 12 use-cases MUST resolver a sus instancias mock

---

## VSM-R6 — Sin regresión de la suite completa

Tras wirear `unplugin-swc` (transform global, no selectivo por archivo), la suite completa `pnpm --filter api test` MUST seguir en verde para la totalidad de los tests existentes (~2083 tests en ~192 archivos bajo `api/src`).

### VSM-S6 — La suite completa pasa tras el cambio de transform

- GIVEN el repositorio con VSM-R1, VSM-R3, VSM-R4 y VSM-R5 aplicados
- WHEN se ejecuta `pnpm --filter api test`
- THEN el comando MUST terminar con código de salida 0
- AND ningún test previamente verde MUST pasar a fallar como efecto del cambio de transform

---

## Trazabilidad requisito → escenario

| Requisito | Escenarios |
|-----------|-----------|
| VSM-R1 | VSM-S1 |
| VSM-R2 | VSM-S2a, VSM-S2b |
| VSM-R3 | VSM-S3 |
| VSM-R4 | VSM-S4 |
| VSM-R5 | VSM-S5 |
| VSM-R6 | VSM-S6 |
