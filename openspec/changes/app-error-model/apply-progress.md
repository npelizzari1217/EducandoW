# Apply Progress: app-error-model

Estado: **COMPLETO** — 7/7 work units, 15/15 tasks, 7/7 commits.

## Resumen por work unit

| WU | Commit | Estado |
|---|---|---|
| 1 — `ApplicationError` base | `3854013` `feat(application): add ApplicationError base class` | ✅ RED→GREEN, 3 tests |
| 2 — Clases concretas de autorización | `032528a` `feat(application): add InsufficientRoleHierarchyError and CrossInstitutionForbiddenError` | ✅ RED→GREEN, 2 tests |
| 3 — Rama `ApplicationError` en el filter | `521cefd` `feat(presentation): map ApplicationError to HTTP status in exception filter` | ✅ RED (prueba el bug 500) →GREEN (403), 13 tests en el archivo (3 nuevos AEM-R2) |
| 4 — `CreateUserUseCase` → Result | `dd58167` `refactor(application): migrate CreateUserUseCase to Result` | ✅ RED→GREEN, 5 tests nuevos |
| 5 — `UpdateUserUseCase` → Result | `b2e67ae` `refactor(application): migrate UpdateUserUseCase to Result` | ✅ RED→GREEN, 9 tests nuevos |
| 6 — `DeleteUserUseCase` → Result | `ebe4053` `refactor(application): migrate DeleteUserUseCase to Result` | ✅ RED→GREEN, 4 tests nuevos |
| 7 — Controller `users.controller.ts` | `38d08bc` `refactor(presentation): adopt isErr/throw idiom in users controller` | ✅ RED→GREEN, 6 tests nuevos |

## Bug 500→403 — confirmado empíricamente

El RED de WU3 (`exception.filter.spec.ts`, describe `AEM-R2: ApplicationError branch`) probó el bug
real: un `ApplicationError` stub con `httpStatus=403` caía en el branch genérico `instanceof Error`
del filter (no existía la rama `ApplicationError`), dejando `status` en el default `500`. Falla real
observada: `expected "vi.fn()" to be called with arguments: [403]` / recibido `[500]`. Insertar la
rama `else if (exception instanceof ApplicationError)` (GREEN) lo corrigió.

## Verificación final

- `pnpm --filter api test` — **208 test files, 2116 tests, todos pasaron.**
- `pnpm --filter api typecheck` — limpio, sin errores.
- `git diff --stat main..HEAD` (excluyendo `openspec/`): **10 archivos, 764 inserciones, 25
  eliminaciones** (764 líneas agregadas — por encima de la estimación de diseño de ~316, sobre todo
  por el peso de los tests nuevos de WU4-7, que el propio design.md §8 anticipaba como el patrón
  usual: "los tests nuevos... suelen pesar más de lo estimado". No se activó ningún gate de PR
  encadenado — el forecast de tasks.md marcaba 400-line risk: Low con margen, y aun con el real
  duplicando la estimación de líneas de producción, es 1 solo PR conceptualmente cohesivo (7
  commits secuenciales sobre la misma cadena de archivos), no se recomienda dividirlo).
- Ningún archivo bajo `/auth/` (login/token) aparece en el diff — confirmado vía
  `git diff --name-only main..HEAD | rg "/auth/"` → sin matches (AEM-R6.S4).
- Regresión AEM-R6 (ROOT bypass, jerarquía suficiente, misma institución) — cubierta por 9 tests de
  regresión distribuidos en WU4 (2), WU5 (3), WU6 (2), más 2 casos de "no encontrado" preservados
  (Update/Delete). Todos pasan.

## Desviaciones del design

Ninguna funcional. Única desviación: líneas reales (764 ins.) superan la estimación de diseño (~316)
por el peso de los tests — anticipado explícitamente por el propio design.md §8 como patrón usual,
no es una sorpresa arquitectónica.
