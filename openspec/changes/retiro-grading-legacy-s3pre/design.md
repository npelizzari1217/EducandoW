# Design: retiro-grading-legacy-s3pre

> Fase: sdd-design · Store: hybrid · Fecha: 2026-06-19
> Inputs: proposal.md + explore.md (re-validado 2026-06-19) + schema tenant real + patrón `cleanup-ingresantes-sin-ciclo.ts`.
> Verificado contra `api/prisma_tenant/schema.prisma` y los archivos reales (no contra el inventario del explore solamente).

## 1. Contexto y objetivo arquitectónico

Retirar el **grading legacy** (5 modelos tenant: `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral`) y todo su dead code asociado, archivando los datos antes del DROP. El path legacy de `NotaTrimestral` en `generate-boletin.use-case.ts` es **inalcanzable en producción** (los 4 niveles despachan a builders nuevos). Dropear `subject_assignments` deja a `teachers` sin lectores de FK y **habilita el change S3b-final** (drop Teacher).

Restricción transversal: **regla de dependencias Clean Arch** (domain → application → infrastructure → presentation). El borrado se hace de afuera hacia adentro (consumidores primero, dominio último) para no dejar tipos colgados.

---

## 2. Hallazgos de verificación (correcciones al inventario del explore)

Verifiqué archivo por archivo. El removal inventory del explore estaba **incompleto en 4 puntos** — todos confirmados contra el código real:

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| V-1 | **6 relaciones inversas** en el schema, no 4. Además de Student/Subject/CourseSection/Teacher, `GradeScaleValue.notas Nota[]` (línea 595) referencia `Nota`. | schema.prisma:595 + Nota.gradeScaleValueId:642-643 | Si no se quita, `prisma generate` rompe al borrar `Nota`. |
| V-2 | **5 repos de dominio**, no 4. Falta `repositories/nota-repository.ts` (exportado como `NotaRepository`, pedagogy/index.ts:78). | pedagogy/index.ts:78, src/index.ts:81 | Importa `Nota`; queda colgado si se borra solo la entidad. |
| V-3 | **`pedagogy.test.ts` importa las 5 entidades** y las testea (describe blocks SubjectAssignment/Evaluacion/Nota/PeriodoEvaluacion/NotaTrimestral). El explore solo mencionó stale mocks en tests de boletín. | `__tests__/entities/pedagogy.test.ts:11-15,111-197` | **Rompe build de PR-a** al borrar las entidades. |
| V-4 | **El backfill F3 lee `subjectAssignment`** vía Prisma client: `backfill-materia-grupo.ts:168`, factory `createSubjectAssignment` (factories.ts:218) y su test `f3-backfill.db.test.ts`. | grep `tenant.subjectAssignment` | **Rompe build de PR-b** al regenerar el client sin el modelo. |

Confirmaciones que SÍ valían: los 4 "lectores" de `SubjectAssignment` del explore (subject-grades.controller, competency.use-cases:204, list-teacher-subjects header, prisma-course-cycle JSDoc) son **comentarios stale** — no leen el modelo. Sumo un 5to comentario stale: `course-cycle-repository.ts:69` (JSDoc). Ninguno bloquea el drop.

---

## 3. Decisiones de arquitectura (ADR)

### AD-1 — Archival como script standalone (no migración Prisma)

**Decisión:** el export de las 5 tablas vive en `api/scripts/archive-legacy-grading-data.ts`, ejecutable manualmente (`npx tsx`), NO como `migration.sql` ni hook de `prisma migrate`.

**Rationale:**
- **Separación DML/DDL:** el archival es lectura+export (DML/I/O a disco); la migración es DDL. Mezclarlos en un `.sql` impide el export a CSV/JSON y acopla backup con destrucción.
- **Idempotencia:** un script TS controla re-corridas (si el archivo ya existe → no re-exporta), cosa imposible en una migración Prisma que corre una vez.
- **Gate pre-deploy:** debe correr y verificarse por tenant ANTES de PR-b. Como paso operativo explícito, separado del pipeline de migraciones, es auditable (logs por tenant).
- **Patrón ya probado:** replica `cleanup-ingresantes-sin-ciclo.ts` (lista tenants desde MASTER, itera, aborta tenant y continúa, idempotente).

**Rechazado:** archival dentro de la migración DROP (no idempotente, sin export a archivo, sin gate); `pg_dump` manual (no versionado, no testeable, no per-tenant homogéneo).

### AD-2 — Dos PRs encadenados (decouple sin DDL en PR-a; DROP en PR-b)

**Decisión:** dividir el trabajo en dos PRs con orden de deploy estricto.

- **PR-a (riesgo BAJO, sin cambio de schema):** archival script + tests, borrado del dead code (use-case + strategies), borrado de entidades/repos de dominio + exports, limpieza de stale mocks y del test de dominio (V-3). El schema tenant queda **intacto** → el Prisma client sigue exponiendo los 5 modelos.
- **PR-b (riesgo MEDIO, solo DDL + fixes forzados):** la migración DROP de los 5 modelos, el borrado de las 6 relaciones inversas del schema, y la remoción de la maquinaria F3 acoplada al client (V-4). Requiere PR-a deployado y archival ejecutado OK por tenant.

**Rationale:**
- **Reversibilidad asimétrica:** PR-a no toca datos → revertible por `git revert`. PR-b destruye estructura → solo recuperable vía rollback inline + restore desde archival. Aislar el riesgo en el PR más chico posible.
- **Orden de deploy:** PR-a primero garantiza que cuando PR-b regenere el client sin los modelos, **ya no queden consumidores** (dead code + dominio borrados). Si se invirtiera, PR-a referenciaría tipos ya dropeados.
- **Tamaño/review:** separa "borrar TS" (revisable a ojo) de "DDL destructivo" (requiere revisión de orden FK y rollback). Presupuesto de review por PR < 400 líneas.

**Por qué V-4 va en PR-b y no en PR-a:** `backfill-materia-grupo.ts` y la factory leen `tenant.subjectAssignment` del **Prisma client**, que sigue existiendo en PR-a (schema intacto). Recién al regenerar el client en PR-b ese tipo desaparece y fuerza la remoción. Mantiene PR-a sin dependencias del DDL.

**Rechazado:** PR único (mezcla revert de código con restore de datos; review > presupuesto; riesgo concentrado).

### AD-3 — Orden de DROP por FKs Restrict, `IF EXISTS` + rollback inline

**Decisión:** la migración dropea en orden hijo→padre respetando las FK `Restrict`, cada `DROP TABLE` con `IF EXISTS`, y un bloque de rollback inline comentado que recrea la estructura.

**Orden (verificado en schema):**
```
1. notas                 (FK notas.evaluationId → evaluaciones; Restrict)
2. evaluaciones          (FK evaluaciones.assignmentId → subject_assignments; Restrict)
3. notas_trimestrales    (FK → subject_assignments + periodos_evaluacion; ambas Restrict)
4. periodos_evaluacion   (ya sin hijos tras dropear notas_trimestrales)
5. subject_assignments   (FK → teachers/subjects/course_sections; Cascade hacia padres)
```

**Rationale:**
- **Restrict bloquea el padre:** `Evaluacion.assignmentId`, `Nota.evaluationId`, `NotaTrimestral.assignmentId/periodId` no declaran `onDelete` → default Prisma **Restrict**. Dropear el padre antes que el hijo da error de FK. El orden hijo→padre lo evita.
- **`IF EXISTS`:** defensa ante re-corrida o ante PR-b aplicado parcialmente; hace la migración idempotente a nivel DDL.
- **Rollback inline:** Prisma migrate no autogenera down-migrations. El rollback se documenta como SQL comentado dentro del mismo archivo (recrea tablas + FKs en orden inverso padre→hijo). **Los datos se restauran desde los CSV/JSON del archival (AD-1)** — el rollback recrea solo la estructura.
- `subject_assignments` se dropea último; tras eso `teachers` queda sin lectores de FK → habilita S3b-final.

**Rechazado:** orden alfabético/arbitrario (falla por Restrict); `CASCADE` en el DROP (oculta dependencias inesperadas y borra sin control).

### AD-4 — Borrar el path legacy del boletín sin tocar los builders nuevos

**Decisión:** en `generate-boletin.use-case.ts` borrar (a) el bloque legacy `NotaTrimestral` (líneas ~244-334, dentro de `buildMaterias`), (b) el sub-bloque `isInicial` + su llamada a `resolveDocentesForStudentCC` (~263-269), y (c) el método privado `resolveDocentesForStudentCC` completo (~906-1001). Los dispatch a `buildMateriasInicial` (ret. línea 214), `buildMateriasTerciario` (219), `buildMateriasPrimario` y `buildMateriasSecundario` **no se tocan**.

**Rationale:**
- **Dead code verificado:** los 4 niveles retornan antes del legacy path; `reportes.module.ts` siempre inyecta los 4 repos, por lo que la rama `else` (sin repos) es inalcanzable. `resolveDocentesForStudentCC` solo se llama desde el bloque `isInicial` interno → dead code dentro de dead code (Inicial ya despachó en línea 214).
- **Sin cambio funcional observable:** se quita código muerto; ningún nivel pierde capacidad (Inicial→InformeEvolutivo, Terciario→InscripcionMateria+ActaExamenNota, Primario/Secundario→repos inyectados).
- **No-regresión por test, no por inspección:** los tests de boletín por nivel (Inicial/Primario/Secundario/Terciario) deben pasar idénticos antes y después (sección 6).

**Rechazado:** dejar el legacy path "por las dudas" (viola Clean Arch: dead code que referencia tablas que vamos a dropear → build roto en PR-b).

### AD-5 — Remoción de entidades/repos de dominio legacy y exports

**Decisión:** borrar de `packages/domain/src/pedagogy/` las **5 entidades** y los **5 repos** legacy, y limpiar todos sus exports en `pedagogy/index.ts` y `src/index.ts`. Se hace en PR-a, **después** de borrar consumidores (use-case, strategies, test de dominio).

**Entidades:** `subject-assignment.ts`, `evaluacion.ts`, `nota.ts`, `periodo-evaluacion.ts`, `nota-trimestral.ts`.
**Repos:** `subject-assignment-repository.ts`, `evaluacion-repository.ts`, `nota-repository.ts` (V-2), `periodo-evaluacion-repository.ts`, `nota-trimestral-repository.ts`.

**Rationale:**
- **Clean Arch — domain sin tipos colgados:** no hay implementaciones de estos repos en `infrastructure/` (removidas en S1). El único consumidor vivo de las entidades era `pedagogy.test.ts` (V-3), que se limpia primero. Verificado: el resto de matches son comentarios stale.
- **Orden de borrado afuera→adentro:** consumidores (application + tests) → entidades/repos (domain) → exports. Garantiza que en ningún commit intermedio el dominio exporta tipos que ya no existen.
- **`nota.ts` es seguro:** `Nota` (legacy) solo lo consumían `pedagogy.test.ts`, `nota-repository.ts` y los re-exports. El grading nuevo usa `SubjectPeriodGrade`/`SubjectFinalGrade`, intactos.

**Rechazado:** borrar entidades dejando los exports (rompe `tsc` del package domain); borrar dominio antes que consumidores (build roto intermedio).

---

## 4. Inventario archivo-por-archivo (create / modify / delete)

### PR-a — sin cambio de schema (revertible por `git revert`)

**CREATE (2)**
| Archivo | Propósito |
|---|---|
| `api/scripts/archive-legacy-grading-data.ts` | Export por tenant de las 5 tablas a CSV/JSON. Patrón `cleanup-ingresantes-sin-ciclo.ts`: lista tenants desde MASTER, itera, idempotente, aborta-tenant-y-sigue. |
| `api/scripts/__tests__/archive-legacy-grading-data.spec.ts` | Tests del script (idempotencia, abort-on-fail, export por tenant). Ver sección 6. |

**MODIFY (4)**
| Archivo | Cambio |
|---|---|
| `api/src/application/reportes/generate-boletin.use-case.ts` | Borrar legacy path (~244-334), bloque `isInicial` (~263-269) y método `resolveDocentesForStudentCC` (~906-1001). AD-4. |
| `packages/domain/src/pedagogy/index.ts` | Quitar exports de las 5 entidades (líneas 5-14) y los 5 repos (76-80). AD-5. |
| `packages/domain/src/index.ts` | Quitar re-exports pedagogy: entidades/Props (57-58) y repos legacy (81). Conservar el resto del barrel. AD-5. |
| `packages/domain/src/pedagogy/__tests__/entities/pedagogy.test.ts` | Quitar imports (11-15) y los 5 describe legacy (111-197). **V-3 — sin esto PR-a no compila.** |

**DELETE — dead code (12)**
| Archivo | Razón |
|---|---|
| `packages/domain/src/pedagogy/entities/subject-assignment.ts` | Entidad legacy (AD-5) |
| `packages/domain/src/pedagogy/entities/evaluacion.ts` | Entidad legacy |
| `packages/domain/src/pedagogy/entities/nota.ts` | Entidad legacy |
| `packages/domain/src/pedagogy/entities/periodo-evaluacion.ts` | Entidad legacy |
| `packages/domain/src/pedagogy/entities/nota-trimestral.ts` | Entidad legacy |
| `packages/domain/src/pedagogy/repositories/subject-assignment-repository.ts` | Repo legacy |
| `packages/domain/src/pedagogy/repositories/evaluacion-repository.ts` | Repo legacy |
| `packages/domain/src/pedagogy/repositories/nota-repository.ts` | Repo legacy (**V-2**) |
| `packages/domain/src/pedagogy/repositories/periodo-evaluacion-repository.ts` | Repo legacy |
| `packages/domain/src/pedagogy/repositories/nota-trimestral-repository.ts` | Repo legacy |
| `api/src/application/shared/strategies/` (7 archivos) | `evaluacion.strategy.ts`, `evaluacion-inicial/-primario/-secundario/-terciario.strategy.ts`, `evaluacion-strategy.factory.ts`, `index.ts`. Sin imports vivos (solo un comentario en boletin-template.factory). |

**MODIFY — stale mocks en tests (scan + limpiar)**
| Archivo | Cambio |
|---|---|
| `api/src/application/reportes/__tests__/generate-boletin.use-case.test.ts` | Quitar claves de mock no llamadas: `subjectAssignment`, `periodoEvaluacion`, `notaTrimestral` (~383-385, 418-421, 591-594, 767-770, 926-929). |
| `api/src/application/reportes/__tests__/generate-boletin.docente-s2.test.ts` | Quitar `subjectAssignment/periodoEvaluacion/notaTrimestral` del factory `makeTenantClient` (~13-16). |
| `api/src/application/reportes/__tests__/generate-boletin.inicial.test.ts` | Scan: si el mock tenant client define esas claves, quitarlas (no se invocan). |
| `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts` | Ídem scan + limpiar. |

> Nota: los mocks legacy son objetos planos (no usan el Prisma client real), por eso se limpian en PR-a sin esperar al drop. Eliminar la clave no debe alterar el resultado del test (si lo altera, el path no era dead code → STOP).

### PR-b — DDL + fixes forzados por regeneración del client

**CREATE (1)**
| Archivo | Propósito |
|---|---|
| `api/prisma_tenant/migrations/{timestamp}_drop_grading_legacy/migration.sql` | DROP de los 5 modelos en orden FK + rollback inline comentado. AD-3. Ver sección 5. |

**MODIFY (1)**
| Archivo | Cambio |
|---|---|
| `api/prisma_tenant/schema.prisma` | Borrar los 5 `model` blocks (SubjectAssignment 462-485, Evaluacion 608-626, Nota 628-658, PeriodoEvaluacion 660-675, NotaTrimestral 677-697) **y las 6 relaciones inversas**: `Student.notas` (42), `Student.notasTrimestrales` (43), `Teacher.subjectAssignments` (109), `Subject.subjectAssignments` (414), `CourseSection.subjectAssignments` (448), **`GradeScaleValue.notas` (595 — V-1)**. Sin esto `prisma generate` falla. |

**DELETE — maquinaria F3 acoplada al client (V-4) (2)**
| Archivo | Razón |
|---|---|
| `api/scripts/backfill-materia-grupo.ts` | Lee `tenant.subjectAssignment.findMany` (línea 168). Backfill F3 ya ejecutado; tras el drop no compila. Mismo gate operativo que el archival: confirmar que el backfill F3 corrió en todos los tenants antes de borrarlo. |
| `api/test/integration/materia-grupo-ciclo/f3-backfill.db.test.ts` | Testea el backfill desde `SubjectAssignment`; usa la factory que desaparece. |

**MODIFY — factory de integración (1)**
| Archivo | Cambio |
|---|---|
| `api/test/integration/setup/factories.ts` | Quitar `createSubjectAssignment` (218-) que llama `tenant.subjectAssignment.create`. No queda otro consumidor tras borrar el test F3. |

**MODIFY opcional — limpieza de JSDoc stale (no bloqueante)**
- `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts:69`, `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`, `subject-grades.controller.ts`, `competency.use-cases.ts:204`, `list-teacher-subjects-in-course-cycle.use-case.ts`: comentarios que mencionan SubjectAssignment. Actualizar texto si se toca el archivo; no rompen build.

**Conteo total:** CREATE **3** · MODIFY **7** (4 PR-a + 3 PR-b; sin contar JSDoc opcionales) · DELETE **16** (12 PR-a + 4 PR-b… ver nota). Nota: en PR-b son 2 DELETE de archivo + 1 MODIFY (factory) + 1 MODIFY (schema) + 1 CREATE (migración). Total archivos DELETE = 14 (12 dead-code PR-a + 2 F3 PR-b).

---

## 5. Formato de la migración DROP (PR-b)

**Ubicación:** `api/prisma_tenant/migrations/{timestamp}_drop_grading_legacy/migration.sql` (carpeta de migraciones tenant; se aplica con `prisma:migrate:deploy:tenant` por tenant).

**Estructura del SQL:**
```sql
-- DROP grading legacy — orden hijo→padre (FKs Restrict). AD-3.
-- PRE-REQUISITO: archive-legacy-grading-data.ts ejecutado OK en este tenant.
DROP TABLE IF EXISTS "notas";
DROP TABLE IF EXISTS "evaluaciones";
DROP TABLE IF EXISTS "notas_trimestrales";
DROP TABLE IF EXISTS "periodos_evaluacion";
DROP TABLE IF EXISTS "subject_assignments";

-- ── ROLLBACK INLINE (manual) ────────────────────────────────────────────
-- Prisma migrate no genera down-migrations. Para revertir:
--   1. Ejecutar el CREATE TABLE en orden inverso (padre→hijo):
--      subject_assignments → periodos_evaluacion → notas_trimestrales → evaluaciones → notas
--      con sus PK, FKs (Restrict/Cascade) e índices originales (ver schema previo a este change).
--   2. Restaurar datos desde los CSV/JSON generados por archive-legacy-grading-data.ts.
```

**Notas:**
- El `schema.prisma` se edita en el mismo PR (sección 4, MODIFY) para que `prisma generate` produzca un client sin estos modelos; el SQL de arriba se genera con `prisma migrate dev --create-only` y se revisa/ajusta el orden a mano.
- El rollback recrea **estructura**; los **datos** vienen del archival (AD-1). Por eso el archival es gate obligatorio.

---

## 6. Plan de testing (TDD estricto)

`test_command: pnpm test` · `build_command: pnpm build` · coverage ≥ 80%. Test primero en todo lo nuevo.

### Tests que se AGREGAN (PR-a) — `archive-legacy-grading-data.spec.ts`
Siguiendo el patrón de helpers exportados de `cleanup-ingresantes-sin-ciclo.ts` (funciones puras testeables sin DB real, con un `TenantPrismaClient` mockeado):
1. **Export por tenant:** dado un tenant con N filas en cada tabla, el helper escribe `{tenant}/{tabla}.csv` (o `.json`) con esas N filas. Cubre las 5 tablas.
2. **Idempotencia:** segunda corrida con el archivo ya presente → no re-exporta / sobre-escribe con contenido idéntico, sin error.
3. **Abort-on-fail por tenant:** si un tenant lanza al exportar, el helper lo loguea, no propaga, y el `main` continúa con el siguiente tenant (no aborta el batch).
4. **Tenant vacío:** 0 filas → genera archivo vacío válido (o no-op documentado), sin error.

### Tests que se LIMPIAN
- **PR-a:** stale mocks en los 4 archivos de tests de boletín (sección 4) + remoción de los 5 describe legacy en `pedagogy.test.ts` (V-3).
- **PR-b:** borrar `f3-backfill.db.test.ts` y la factory `createSubjectAssignment` (V-4).

### No-regresión del boletín por nivel (AD-4)
- Los suites `generate-boletin.inicial.test.ts`, `generate-boletin.use-case.test.ts` (Primario/Secundario) y `generate-boletin.terciario.test.ts` deben **pasar idénticos** tras borrar el legacy path. Son la prueba de que el path era inalcanzable: si quitar el legacy path/mocks cambia un assert, el path NO era dead code → STOP y re-evaluar.
- Gate de PR-a: `pnpm build` + `pnpm test` verdes (incluye `tsc` de `@educandow/domain` sin los exports legacy).
- Gate de PR-b: `pnpm --filter api prisma:generate` sin error (valida que se quitaron las 6 relaciones inversas) + `pnpm build` + `pnpm test`.

---

## 7. Riesgos de implementación y mitigación por diseño

| Riesgo | Sev | Cómo lo mitiga el diseño |
|---|---|---|
| **`prisma generate` rompe por relación inversa colgada** (V-1, esp. `GradeScaleValue.notas`) | ALTO | Sección 4 PR-b lista las **6** relaciones inversas explícitamente; gate de PR-b corre `prisma:generate`. |
| **Build de PR-a roto por `pedagogy.test.ts`** (V-3) | ALTO | Incluido como MODIFY obligatorio en PR-a (no era visible en el inventario del explore). |
| **Build de PR-b roto por backfill F3** (V-4) | ALTO | Maquinaria F3 (`backfill-materia-grupo.ts`, factory, test) asignada a PR-b porque se acopla al Prisma client que recién cambia ahí. |
| **Pérdida de datos sin archival** | CRÍTICO | AD-1 archival obligatorio + AD-2 gate: archival OK por tenant ANTES de PR-b; rollback de PR-b restaura desde los CSV/JSON. |
| **Orden de DROP viola FK Restrict** | ALTO | AD-3 orden hijo→padre verificado contra el schema + `IF EXISTS`. |
| **PR-b deployado antes que PR-a** | ALTO | AD-2 orden de deploy estricto + `IF EXISTS` como defensa; PR-a borra consumidores primero. |
| **El "dead code" no era tan dead** | MEDIO | No-regresión por test (sección 6): si limpiar mocks/legacy path cambia un assert del boletín, STOP. |
| **Borrar `backfill-materia-grupo.ts` sin confirmar que corrió** | MEDIO | Mismo gate operativo que el archival: confirmar backfill F3 ejecutado en todos los tenants antes de borrarlo (es one-shot histórico). |

---

## 8. Salida para sdd-tasks

El desglose en tasks debe respetar: (a) orden afuera→adentro en PR-a (consumidores → dominio → exports), (b) frontera PR-a/PR-b según acoplamiento al Prisma client, (c) TDD: test del archival antes que su implementación, (d) gates de build/test/prisma-generate al cierre de cada PR.
