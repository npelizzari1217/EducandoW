# Archive Report — course-cycle-alumnos-result-migration (épico error-handling)

- Change: `course-cycle-alumnos-result-migration` (slice AlumnosXCurso, follow-up de `course-cycle-result-migration`)
- Archivado: 2026-07-31
- Rama: `refactor/course-cycle-alumnos-result-migration` (6 commits de código desde `main` @ ad947ad, sin push, sin PR)
- Store: hybrid (openspec + engram)
- **Veredicto final: PASS (0 CRITICAL, 0 WARNING, 1 SUGGESTION) → ARCHIVADO**

---

## Resultado

Los 5 use-cases de `AlumnosXCurso` (`add-student-to-course-cycle`, `remove-student-from-course-cycle`,
`toggle-printable`, `registrar-pase`, `cascade-student-materias-competencias`) migraron de `throw` a
`Result<T, Error>`, y el `AlumnosXCursoXCicloController` adoptó el idiom `if (isErr) throw unwrapErr()`
en sus 5 endpoints que consumen esos use-cases. Con esto, **el área `course-cycle` queda totalmente
migrada** al patrón de error-handling (junto con el slice del archivo nombrado del change anterior).

- **Cero clases nuevas, cero entradas nuevas en `DOMAIN_STATUS`, cero correcciones 500→4xx.** Es la
  migración más limpia del épico: pura consistencia + un bridge.
- Diff: **12 archivos, 316 líneas** (192+ / 124-), bajo el budget de 400 → un PR.
- `pnpm --filter api test`: **2153/2154 GREEN** (el 1 fallo, `archive-legacy-grading-data.spec.ts`,
  es pre-existente — diff vacío vs `main`). `@educandow/domain`: 1284 GREEN. `typecheck` limpio.
  `nest build`: 0 issues, 511 archivos.

## Lo distintivo de este change

### 1. El bridge de `PaseFechaInvalidaError` (única decisión no-mecánica)

De los 11 throws, 10 eran `NotFoundError`/`StudentHasPaseError` explícitos (migración mecánica a
`err(...)`). El 11º era un throw **de la entidad**: `Student.registrarPase(fecha)`
(`packages/domain/src/personnel/entities/student.ts:139`) tira `PaseFechaInvalidaError` si la fecha es
futura. `RegistrarPaseUseCase` lo **puentea** a `Result` con try/catch
(`registrar-pase.use-case.ts:52-60` → `err(e as PaseFechaInvalidaError)`), siguiendo el precedente
`attendance-type.use-cases.ts:102-106`. La entidad sigue siendo throw-based (patrón de dominio
establecido); el use-case adapta ese throw a `Result` — el único lugar donde `application/` atrapa un
throw de dominio, justificado porque la API de la entidad es throw-based.

### 2. Sin bugs de 500 (a diferencia de los slices previos)

`app-error-model` y `course-cycle-result-migration` corregían denegaciones/validaciones que
respondían 500. Este slice NO: todos los códigos HTTP quedan idénticos (`NOT_FOUND` 404,
`STUDENT_HAS_PASE` 409, `PASE_FECHA_INVALIDA` 400 — todos ya mapeados). Solo cambia el mecanismo de
propagación interno (return vs throw). Se documentó honestamente como tal en propose/spec.

### 3. Acople por tipos → un PR (no chained)

El cambio de return types acopla use-cases y controller vía el sistema de tipos: los commits 1-5 no
compilan aislados (el controller compila contra `Result` recién en el commit 6). Por eso, aunque se
evaluó partir en chained PRs, la decisión correcta fue **un solo PR**.

## Cobertura de requisitos (CCAM-R1..R7) — PASS en los 7

| Req | Resultado |
|---|---|
| CCAM-R1 (cero throw en los 5 use-cases) | PASS — grep sin throws |
| CCAM-R2 (bridge PaseFechaInvalidaError) | PASS — try/catch, ambas ramas ok(undefined) |
| CCAM-R3 (status codes preservados) | PASS — DOMAIN_STATUS intacto, sin 500→4xx |
| CCAM-R4 (controller idiom en 5 endpoints) | PASS — :78,:116,:151,:171,:217 |
| CCAM-R5 (Cascade 4 return sites → ok) | PASS — :60,:82,:91,:107, payload igual |
| CCAM-R6 (sin clase nueva, auth + slice previo intactos) | PASS — diff limpio |
| CCAM-R7 (cobertura togglePrintable) | PASS — C-19/C-20/C-21 nuevos, RED-first |

## Commits (6 código, sin atribución IA)

| Hash | Mensaje |
|------|---------|
| `e7d7c69` | `refactor(course-cycle): AddStudent + Remove use-cases return Result` |
| `f8e97c1` | `refactor(course-cycle): TogglePrintable use-case returns Result` |
| `54cb4f1` | `refactor(course-cycle): RegistrarPase returns Result, bridge PaseFechaInvalidaError` |
| `a88e761` | `refactor(course-cycle): Cascade use-case returns Result` |
| `4ca1bee` | `test(course-cycle): RED - togglePrintable controller-spec coverage (C-19..C-21)` |
| `c6e90be` | `refactor(course-cycle): controller adopts isErr/unwrapErr on 5 endpoints` |

TDD estricto: RED genuino confirmado 2 veces — S-4-B (bridge) y C-20/C-21 (togglePrintable). El
resto son rewrites que preservan comportamiento.

## SUGGESTION (no bloqueante)

El cast `e as PaseFechaInvalidaError` (`registrar-pase.use-case.ts:59`) podría endurecerse con un
`instanceof` narrow. Aceptado como hardening opcional (matchea el precedente de `attendance-type`).

## Follow-ups del épico que siguen abiertos

- **`GenerateCourseCyclesUseCase` batch partial-success** (decisión de producto).
- `materia-grupo-ciclo` (17, + nuevo DomainError MGC-R4), `reportes`+`reporting`+`pdf` (30),
  `asistencia` (41), `attendance-type.use-cases.ts` (5), cola larga (`pedagogy`, `ingresante`,
  `institution`, `asignacion-curso`, `nivel-terciario`), helper `unwrapOrThrow`, 2 guards de infra
  (`InfrastructureError`).
- NOTA de backlog: los `.catch()` fire-and-forget de `GenerateCourseCyclesUseCase` (:421,:429) —
  si AutoCreate/Materialize se migran a `Result` en un slice futuro, un `err(...)` resuelve normal y
  bypassea el `.catch()` logger. Considerar al migrar esos.

## Trazabilidad de artefactos (Engram)

| Artefacto | Topic key | Obs ID |
|-----------|-----------|--------|
| Exploration | `sdd/course-cycle-alumnos-result-migration/explore` | 1900 |
| Proposal | `sdd/course-cycle-alumnos-result-migration/proposal` | 1901 |
| Spec | `sdd/course-cycle-alumnos-result-migration/spec` | 1902 |
| Design | `sdd/course-cycle-alumnos-result-migration/design` | 1903 |
| Tasks | `sdd/course-cycle-alumnos-result-migration/tasks` | 1904 |
| Apply progress | `sdd/course-cycle-alumnos-result-migration/apply-progress` | 1907 |
| Verify report | `sdd/course-cycle-alumnos-result-migration/verify-report` | 1909 |
| Archive report | `sdd/course-cycle-alumnos-result-migration/archive-report` | (este documento) |

## Capability

NO se creó capability nueva — este change CONSUME `application-error-handling`. Se actualizó su
sección "Out of Scope / Follow-up" (línea 203) marcando `course-cycle` como **totalmente migrado**
por los dos changes (named-file + AlumnosXCurso).

## SDD Cycle Complete

Planificado, implementado, verificado y archivado de punta a punta. El área `course-cycle` queda
cerrada dentro del épico error-handling.
