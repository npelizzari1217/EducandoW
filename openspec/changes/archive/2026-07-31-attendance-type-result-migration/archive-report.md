# Archive Report — attendance-type-result-migration (épico error-handling)

- Change: `attendance-type-result-migration`
- Archivado: 2026-07-31
- Rama: `refactor/attendance-type-result-migration` (7 commits sobre `main` @ 3e0d147, pendiente push+PR)
- Store: hybrid (openspec + engram)
- **Veredicto final: PASS (0 CRITICAL, 1 WARNING → cerrado, 1 SUGGESTION) → ARCHIVADO**

---

## Resultado

Los 6 throws de `AttendanceTypeLevelOutOfScopeError` migraron al canal `Result`, y — lo notable —
la clase se **reclasificó de `DomainError` → `ApplicationError`** (403) y se **movió** de
`packages/domain` a `api/src/application/shared/errors/`. Es el **2º consumidor real de
`ApplicationError`** desde el piloto `users`, probando que la abstracción fundacional del épico
generaliza más allá de su piloto. **Cero cambio de comportamiento**: 403 antes y después.

- `@educandow/domain`: 1287/1287 verde (la clase ya no está en domain; sin referencia colgada).
- `api`: 2181/2182 verde (el 1 rojo, `archive-legacy-grading-data.spec.ts`, pre-existente — diff
  vacío vs `main`). `typecheck` limpio. `build` verde.
- Diff: **15 archivos, 134+/86- (+ el test del helper)**. Cero archivos en `web`/`auth`.

## Lo distintivo — reclasificación a ApplicationError

`AttendanceTypeLevelOutOfScopeError` es un rechazo por **scope del llamante** (los niveles asignados
al usuario) — caller-context, no invariante intrínseco. El propio spec `attendance-types/spec.md`
ya lo documentaba como "NO es error de dominio" desde 2026-07-01, antes de que existiera
`ApplicationError`. La reclasificación:
- `extends ApplicationError`, `super(msg, 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE', 403)`.
- **Movida** `packages/domain/src/attendance-type/errors/` → `api/src/application/shared/errors/`
  (Clean Arch: `domain` no puede depender de `api` donde vive `ApplicationError`). Exports de domain
  removidos (3 index), entrada `DOMAIN_STATUS` removida (dead — el 403 ahora sale de la rama
  `ApplicationError` del filter, antes de `DomainError`).

## Bug latente encontrado y arreglado (vía TDD)

Al mover el error de scope al canal `Result`, `printList` lo pasa por el helper compartido
`unwrapResultOrThrow`, que **envolvía todo error en un `HttpException` genérico que descarta
`error.code`**. Antes el scope-check era un `throw` directo que salteaba el helper; meterlo en
`Result` **expuso** que `res.body.error.code` pasaba a `undefined`. Fix en la raíz: el helper ahora
re-tira los `ApplicationError` tal cual (preserva `instanceof` + `code` + `httpStatus`), y deja
`PdfError` con el wrap previo. **Verificado seguro para otros consumidores**: `asistencia-reporting`
y `reportes` usan errores que extienden `Error` directo (nunca `ApplicationError`), así que la rama
nueva es dead-code para ellos. Se agregó un test unitario directo de esa rama (cierra el WARNING del
verify).

## Cobertura de requisitos (ATRM-R1..R7) — PASS

R1 (ApplicationError, 403, non-overlap con DomainError), R2 (vive en api, sin export domain colgado),
R3 (6 throws → err, List a Result, PDF :112 intacto), R4 (403 end-to-end incl. printList — el fix del
helper), R5 (controller list() idiom), R6 (CodeDuplicate/SystemAT/NotFound sin regresión), R7 (sin
clases base nuevas, auth/web intactos, doc actualizada). Verificado con contexto fresco, reproducción
independiente.

## Commits (7, sin atribución IA)

| Hash | Mensaje |
|------|---------|
| `8a19e91` | `refactor(attendance-type): move AttendanceTypeLevelOutOfScopeError to api as ApplicationError` |
| `f7aa106` | `refactor(attendance-type): migrate scope denials from throw to Result` |
| `9dfa1fa` | `refactor(attendance-type): adopt Result idiom in controller list()` |
| `adc2139` | `fix(api): preserve ApplicationError identity in unwrapResultOrThrow` |
| `a73a9ca` | `test(attendance-type): migrate scope assertions to Result shape` |
| `868b38c` | `docs(spec): record AttendanceTypeLevelOutOfScopeError as ApplicationError` |
| `e69f145` | `test(api): cover unwrapResultOrThrow ApplicationError branch directly` |

## Follow-ups del épico que siguen abiertos

- `InfrastructureError` (guards de infra: `update-grupo`, `competency.use-cases.ts:258`, y ahora el
  template guard de `generate-attendance-types-pdf.use-case.ts:112`).
- `reportes`/`asistencia-reporting`/`attendance-type-pdf` (30), `asistencia` (41), cola larga,
  helper `unwrapOrThrow`, `createGrupo` Clean-Arch anti-pattern.

## Trazabilidad (Engram)

explore 1931, proposal 1932, spec 1933, design 1934, tasks 1935, apply-progress 1937,
verify-report 1938 (backfill), archive-report (este).

## Capability

NO se creó capability nueva (CONSUME `application-error-handling`). Se actualizó su sección
"Out of Scope / Follow-up" marcando `attendance-type` como FULLY MIGRATED + 2º consumidor de
`ApplicationError`.

## SDD Cycle Complete

Planificado, implementado, verificado (PASS, contexto fresco, WARNING cerrado) y archivado. Segundo
consumidor real de `ApplicationError` — la abstracción del épico queda probada en generalización.
