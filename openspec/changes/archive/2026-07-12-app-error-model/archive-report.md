# Archive Report — app-error-model (fase fundacional del épico error-handling)

- Change: `app-error-model`
- Archivado: 2026-07-12
- Rama: `refactor/app-error-model` (10 commits sobre `main`, sin push, sin PR)
- Store: hybrid (openspec + engram)
- **Veredicto final: PASS (0 CRITICAL, 0 WARNING) → ARCHIVADO**

---

## Resultado

`ApplicationError` existe como hermana de `DomainError` (`api/src/application/shared/errors/application-error.ts`),
`AppExceptionFilter` la mapea a HTTP en una rama dedicada antes de `DomainError` y del fallback
genérico, y `users.use-cases.ts` es el primer consumidor real: sus 5 throws de autorización
migraron a `Result` + 2 clases concretas (`InsufficientRoleHierarchyError`,
`CrossInstitutionForbiddenError`), y sus 4 throws de dominio preexistentes migraron a `err(...)`
sin cambiar de tipo. Cero `throw` remanente en el archivo.

- `pnpm --filter api test`: **208 archivos, 2116 tests, todos GREEN.**
- `pnpm --filter api typecheck`: limpio.
- Diff de producción: **84 líneas netas** (59 inserciones + 25 eliminaciones, 5 archivos).
- Diff de tests: **705 inserciones** (5 archivos) — cobertura nueva, no inflación: `CreateUserUseCase`,
  `UpdateUserUseCase`, `DeleteUserUseCase` y `users.controller.ts` no tenían ningún test previo.

Capability nueva creada: **`openspec/specs/application-error-handling/spec.md`** — AEM-R1..R6
migradas a forma canónica (sin notas de reconciliación, sin referencias de fase), con la sección
"Out of Scope / Follow-up" documentando el resto del épico.

## La historia de este change (su mayor valor pedagógico)

### 1. Es la fase FUNDACIONAL de un épico, no una migración completa

El `explore` original arrancó con el diagnóstico "144 throws en `application/` — mega-refactor".
La clasificación real, verificada call-site por call-site, redujo eso a **33 throws que en
realidad importan**: 97 de los 144 YA eran `DomainError` legítimos (mal clasificados en el conteo
inicial), y 21 estaban atados al PR #111 (aún sin mergear), por lo que no eran accionables todavía.
Esta fase fundacional NO migra los 33 — establece la BASE (`ApplicationError` + rama del filter) y
la prueba con UN piloto real. Los follow-ups (`materia-grupo-ciclo`, `asistencia`, `course-cycle`,
`reportes`, etc.) replican el patrón mecánicamente sobre esa base ya probada.

### 2. Cambio de piloto — el propose descubrió que el piloto original no servía

El plan original elegía **materia-grupo-ciclo** como piloto. El `propose` reclasificó su único
throw ad-hoc (MGC-R4: la invariante "grupo ⊆ materia") y encontró que es un **invariante de
DOMINIO** — hermano de `AlumnoAlreadyInGrupoError`, no una decisión de autorización dependiente del
contexto del llamante. Consecuencia directa: `materia-grupo-ciclo` NO ejercitaba `ApplicationError`
en absoluto; hubiera sido una base sin consumidor real. Se cambió el piloto a
**`users.use-cases.ts`**, cuyos 5 throws de autorización/jerarquía (`creatorRoles`,
`creatorInstitutionId`) SÍ son el caso puro de `ApplicationError` — YAGNI aplicado: no se construye
la base "para después", se construye junto con su primer uso real.

Esta reclasificación quedó formalizada como el criterio general de la capability
(`application-error-handling/spec.md`, sección "Classification note"): la línea divisoria es
CONTEXTO DEL LLAMANTE (→ `ApplicationError`) vs. invariante intrínseco al dato (→ `DomainError`),
sin importar en qué capa vive hoy el `throw`.

### 3. Bug de seguridad corregido: autorización denegada respondía HTTP 500, no 403

Antes de este change, los 5 sitios de autorización de `users.use-cases.ts` eran
`throw new Error(...)` genéricos. `AppExceptionFilter` no tenía rama para `ApplicationError`, así
que esos throws caían en el fallback `instanceof Error`, que NO cambia `status` de su default
`500` — **una denegación de autorización (request entendido, caller sin permiso) devolvía HTTP 500
y logueaba stack trace como si fuera un error inesperado del servidor**, en vez de HTTP 403.

Confirmado empíricamente, no solo por inspección: el RED de la work unit del filter
(`exception.filter.spec.ts`, describe `AEM-R2`) reprodujo el bug real — un stub `ApplicationError`
con `httpStatus=403` producía `expected [403] / received [500]` contra el filter sin la rama nueva.
Insertar `else if (exception instanceof ApplicationError)` ANTES de `DomainError` y del fallback
(GREEN) lo corrigió. Es una corrección de comportamiento deliberada, no parity — quedó documentada
en spec (AEM-R5) como regla explícita: cualquier test que asumiera 500 para estas condiciones debía
actualizarse a 403.

## Patrón fundacional establecido (replicable por los follow-ups)

1. **Base**: `abstract class ApplicationError extends Error { constructor(message, code, httpStatus = 422) }`
   — mismo contrato que `DomainError` (código en la instancia) + `httpStatus` explícito, patrón
   `BoletinError` ya usado en el codebase.
2. **Rama del filter**: `instanceof ApplicationError` ANTES de `instanceof DomainError` y del
   fallback `instanceof Error` — garantiza que ningún `ApplicationError` caiga en 500 por default.
3. **Clases concretas agrupadas por SEMÁNTICA, no por call site** — 2 clases para 5 sites (YAGNI:
   4 de los 5 eran la misma regla de jerarquía).
4. **Idiom de propagación**: `application/` retorna `Result`, `presentation/` hace
   `if (isErr()) throw unwrapErr()` — el mismo idiom ya usado 23+ veces en el codebase, sin
   inventar uno nuevo.

## Cobertura de requisitos (AEM-R1..R6) — heredado de verify, PASS en los 6

| Req | Resultado |
|---|---|
| AEM-R1 (base) | PASS — 3 tests |
| AEM-R2 (filter) | PASS — bug 500→403 confirmado, 4 tests |
| AEM-R3 (2 clases) | PASS — 2 tests |
| AEM-R4 (users a Result) | PASS — 9/9 throws migrados, cero `throw` remanente |
| AEM-R5 (403 no 500) | PASS — confirmado end-to-end, no existían tests previos asertando 500 (premisa documentada, no gap) |
| AEM-R6 (auth no roto) | PASS — módulo `auth` fuera del diff, 9 tests de regresión (ROOT×3, jerarquía suficiente×3, misma institución×1) |

## Commits (9 código/docs)

| Hash | Mensaje |
|------|---------|
| `3854013` | `feat(application): add ApplicationError base class` |
| `032528a` | `feat(application): add InsufficientRoleHierarchyError and CrossInstitutionForbiddenError` |
| `521cefd` | `feat(presentation): map ApplicationError to HTTP status in exception filter` |
| `dd58167` | `refactor(application): migrate CreateUserUseCase to Result` |
| `b2e67ae` | `refactor(application): migrate UpdateUserUseCase to Result` |
| `ebe4053` | `refactor(application): migrate DeleteUserUseCase to Result` |
| `38d08bc` | `refactor(presentation): adopt isErr/throw idiom in users controller` |
| `0d1b68f` | `docs(app-error-model): mark tasks complete and record apply progress` |
| `c9b43ff` | `docs(app-error-model): commit proposal, design and spec artifacts` |
| (10º) | `docs(sdd): archive app-error-model, add application-error-handling capability` (este commit) |

Sin atribución IA (`git log main..HEAD --format='%B' \| rg -i 'co-authored\|claude\|anthropic'` →
sin matches, confirmado en verify). ~316 líneas estimadas en diseño vs. 764 reales totales
(prod+test) — el exceso es 100% peso de tests nuevos sobre área sin cobertura previa, anticipado
explícitamente por `design.md` §8. Un solo PR, sin `size:exception`, sin chained PRs (forecast de
`tasks.md`: 400-line risk Low).

## Follow-ups (NO implementados — el épico continúa)

El patrón fundacional (base + rama del filter + clases por semántica) queda probado y listo para
replicar mecánicamente. Registrados en `application-error-handling/spec.md` (sección "Out of
Scope / Follow-up") y aquí para trazabilidad de planning:

1. **`materia-grupo-ciclo`** (17 throws) — domain-wrap de 16 sites + crear el `DomainError` NUEVO
   para MGC-R4 (grupo ⊆ materia, invariante intrínseca — NO es `ApplicationError`).
2. **`reportes` + `asistencia-reporting` + `attendance-type-pdf`** (30 throws) — BLOQUEADO hasta
   que PR #111 mergee. Migrar `BoletinError`/`ConstanciaError`/`AsistenciaReportingError` a
   `extends ApplicationError`.
3. **`asistencia`** (41 throws, 100% domain-wrap).
4. **`course-cycle`** (17 throws) — terminar migración mixta ya empezada.
5. **`users` restante** (si queda algo fuera del piloto) + **`attendance-type.use-cases.ts`**
   (5 throws, tipos de retorno mentirosos).
6. **Cola larga**: `pedagogy`, `ingresante`, `institution`, `asignacion-curso`, `nivel-terciario`.
7. **Helper compartido `unwrapOrThrow`** — 23+ controllers duplican
   `if (isErr) throw unwrapErr()` inline.
8. **2 guards de infra mal tipados** (`update-grupo.use-case.ts:43`, `competency.use-cases.ts:258`)
   → necesitan un `InfrastructureError` mínimo (concern separado de `ApplicationError`, aún sin
   modelar).

## Trazabilidad de artefactos (Engram)

| Artefacto | Topic key | Observation ID |
|-----------|-----------|-----------------|
| Proposal | `sdd/app-error-model/proposal` | #1810 |
| Spec (delta) | `sdd/app-error-model/spec` | #1811 |
| Design | `sdd/app-error-model/design` | #1812 |
| Tasks | `sdd/app-error-model/tasks` | #1813 |
| Verify report | `sdd/app-error-model/verify-report` | #1815 |
| Archive report | `sdd/app-error-model/archive-report` | (este documento) |

## Archivo movido

`openspec/changes/app-error-model/` → `openspec/changes/archive/2026-07-12-app-error-model/`
(vía `git mv`). `openspec/changes/` solo contiene `archive/` — sin changes activos pendientes.

## SDD Cycle Complete

El change `app-error-model` fue planificado, implementado, verificado y archivado de punta a punta.
La capability `application-error-handling` queda creada como fuente de verdad nueva (AEM-R1..R6).
El épico error-handling continúa con los follow-ups listados arriba, todos con el patrón
fundacional ya probado en producción para replicar.
