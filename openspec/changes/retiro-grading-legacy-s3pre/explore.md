# Explore: retiro-grading-legacy-s3pre

> Re-explore 2026-06-19 — premisa CONGELAR obsoleta; Terciario+Inicial migrados.
> Fase: sdd-explore · Store: hybrid · Original: 2026-06-17 · Refrescado: 2026-06-19
> S3-pre — archivar + dropear grading legacy (Evaluacion/Nota/NotaTrimestral/PeriodoEvaluacion/SubjectAssignment). Habilita S3b-final (drop Teacher).

---

## CAMBIO DE PREMISA — por qué se refresca

El explore original planteaba opciones A/B/C/D y decidió **CONGELAR** porque Inicial (decada 1) y Terciario (decada 4) no tenían grading en el modelo nuevo. Eso cambió:

| Change archivado | Fecha | Efecto |
|---|---|---|
| `retiro-homeroom-column-s3b0` | 2026-06-17 | `homeroomTeacherId` dropeada; Teacher sin lectors homeroom |
| `retiro-sala-grado-curso-teacher-s3b1` | 2026-06-17 | `Sala/Grado/Curso.teacherId` dropeada |
| `retiro-teachers-admin-s3b2` | 2026-06-17 | `/teachers` CRUD retirado |
| `retiro-examenes-presidente-s3b3` | 2026-06-17 | `MesaExamen/ActaExamen.presidenteId` migrado a User.id |
| **`informe-avance-inicial`** | **2026-06-17** | **Inicial boletín → InformeEvolutivo (off NotaTrimestral)** |
| **`evaluacion-terciario`** | **2026-06-18** | **Terciario: InscripcionMateria + NotaCursadaTerciario + ActaExamenNota.intento** |
| **`boletin-terciario`** | **2026-06-18** | **Terciario boletín → buildMateriasTerciario (dispatch decade-4; off NotaTrimestral)** |

---

## HALLAZGO CENTRAL: legacy path es dead code en producción

`generate-boletin.use-case.ts:buildMaterias()` tiene esta lógica de dispatch:

```
Línea 213-215: if (decade === 1) → buildMateriasInicial    ← Inicial sale aquí
Línea 217-220: if (decade === 4) → buildMateriasTerciario  ← Terciario sale aquí
Línea 222-231: if (decade === 2 && repos)  → buildMateriasPrimario
Línea 233-242: if (decade === 3 && repos)  → buildMateriasSecundario
Línea 244-334: legacy NotaTrimestral path  ← SOLO si repos NO inyectados para decada 2/3
```

`reportes.module.ts` siempre inyecta los 4 repos (linea 45 del módulo):
```ts
new GenerateBoletinUseCase(pdfGen, pdfStorage, prisma, sgpRepo, pgRepo, fgRepo, cvRepo, undefined, informeRepo)
```

→ **El legacy path (líneas 244-334) es INALCANZABLE EN PRODUCCIÓN para cualquier nivel.**

El check `isInicial = Math.floor(enrollment.level / 10) === 1` en línea 263-269 es dead code dentro de dead code: Inicial ya fue despachado en línea 213.

Confirmado en el archive-report de `boletin-terciario` (DEFERRED-2):
> "The legacy `else` branch (reads `NotaTrimestral / CourseCycles`) is now unreachable for decade-4 students but was NOT deleted."

---

## Pregunta 1: Reachability por nivel

| Nivel | Decade | Path actual | ¿Lee NotaTrimestral? |
|---|---|---|---|
| Inicial | 1 | `buildMateriasInicial` → `informeRepo` | NO |
| Primario | 2 | `buildMateriasPrimario` → repos inyectados | NO |
| Secundario | 3 | `buildMateriasSecundario` → repos inyectados | NO |
| Terciario | 4 | `buildMateriasTerciario` → `inscripcionMateria` + `actaExamenNota` | NO |

**Legacy path: DEAD CODE. Ningún nivel llega ahí en producción.**

---

## Pregunta 2: Otros lectores de SubjectAssignment

| Archivo | Evidencia | Veredicto |
|---|---|---|
| `api/src/presentation/grading/subject-grades.controller.ts:53` | Comentario JSDoc stale: "C1: teacher must have SubjectAssignment" — el código delega a UCs del modelo nuevo | No lee SubjectAssignment |
| `api/src/application/pedagogy/use-cases/competency.use-cases.ts:204` | Comentario: "Old executeForSubjectAssignment removed" — solo texto | No lee SubjectAssignment |
| `api/src/application/grading/list-teacher-subjects-in-course-cycle.use-case.ts` | Header: "Reemplaza Teacher+SubjectAssignment por DocenteXCiclo+GrupoRepository" — usa `docenteRepo.findByUserAndCycle` + `grupoRepo.findByDocente` | No lee SubjectAssignment |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts:148` | JSDoc en `findByCourseSectionIds`: "Used for 'por materia': SubjectAssignment.courseSectionId → CourseCycle.courseId" — el método en sí hace `client.courseCycle.findMany(...)` | No lee SubjectAssignment |

**Ninguno de los 4 bloquea el drop. Son stale comments o remplazan explícitamente el modelo.**

También: no hay implementaciones de `SubjectAssignmentRepository`, `EvaluacionRepository`, `NotaTrimestralRepository`, `PeriodoEvaluacionRepository` en `api/src/infrastructure/`. Fueron removidas en S1.

---

## Pregunta 3: Grafo de FK + orden de drop

De `api/prisma_tenant/schema.prisma`:

```
teachers.id ← (Cascade) subject_assignments.teacherId
subject_assignments.id ← (Restrict/default) evaluaciones.assignmentId
evaluaciones.id ← (Restrict/default) notas.evaluationId
subject_assignments.id ← (Restrict/default) notas_trimestrales.assignmentId
notas_trimestrales.periodId → (Restrict/default) periodos_evaluacion.id
```

Orden de DROP TABLE (scripts de migración):
1. `notas` (FK → evaluaciones; Restrict)
2. `evaluaciones` (FK → subject_assignments; Restrict)
3. `notas_trimestrales` (FK → subject_assignments + periodos_evaluacion; ambas Restrict)
4. `periodos_evaluacion` (sin hijos en legacy)
5. `subject_assignments` (FK → teachers; Cascade — puede dropearse antes que teachers)

Tras dropear `subject_assignments`: **`teachers` queda sin consumidores de FK → S3b-final habilitado.**

Confirmado: mismo grafo que el explore original. No hubo cambios de schema en este area desde 2026-06-17.

---

## Pregunta 4: Dead code inventory completo

### `api/src/application/shared/strategies/` (7 archivos)
No son importados desde ningún módulo NestJS ni archivo externo. Solo se referencian entre sí:
- `evaluacion.strategy.ts` (interface)
- `evaluacion-inicial.strategy.ts`
- `evaluacion-primario.strategy.ts`
- `evaluacion-secundario.strategy.ts`
- `evaluacion-terciario.strategy.ts`
- `evaluacion-strategy.factory.ts`
- `index.ts`

El archivo `boletin-template.factory.ts` los menciona en UN COMENTARIO ("Mismo pattern que EvaluacionStrategyFactory") — no hay import.

### `api/src/application/reportes/generate-boletin.use-case.ts`
- Líneas 244-334: legacy NotaTrimestral path completo
- Líneas 263-269: `isInicial` check + `resolveDocentesForStudentCC` call
- Líneas 906-1001: método `resolveDocentesForStudentCC` (solo llamado desde el legacy path)

### `packages/domain/src/pedagogy/`
Entidades y repos a remover (sin consumidores en infra):
- `entities/subject-assignment.ts`
- `entities/evaluacion.ts`
- `entities/nota-trimestral.ts`
- `entities/periodo-evaluacion.ts`
- `entities/nota.ts` (si no tiene otros consumidores fuera de legacy)
- `repositories/subject-assignment-repository.ts`
- `repositories/evaluacion-repository.ts`
- `repositories/nota-trimestral-repository.ts`
- `repositories/periodo-evaluacion-repository.ts`
- Exports en `packages/domain/src/pedagogy/index.ts` y `packages/domain/src/index.ts`

### Tests con stale mocks
- `generate-boletin.use-case.test.ts:383-385`: `subjectAssignment`, `periodoEvaluacion`, `notaTrimestral` en mock del test de Inicial (línea 375) — nunca llamados
- `generate-boletin.use-case.test.ts:418-421`, `591-594`, `767-770`, `926-929`: `subjectAssignment` en mocks de Primario — nunca llamados (buildMateriasPrimario no usa subjectAssignment)
- `generate-boletin.docente-s2.test.ts:13-16`: `subjectAssignment`, `periodoEvaluacion`, `notaTrimestral` en `makeTenantClient` factory

---

## Pregunta 5: Decisión bajo premisa nueva

Las opciones A/B/C/D del explore original ya no aplican. La opción C ("construir grading para Inicial/Terciario") está HECHA. La decisión ahora es directa:

**OPCIÓN ÚNICA: DROP (archival + decouple + DROP migration)**

No hay ningún nivel sin reemplazo. El drop es seguro una vez ejecutado el archival script.

---

## Pregunta 6: Archival approach

Patrón `cleanup-ingresantes-sin-ciclo.ts` confirmado como referencia válida. El script `archive-legacy-grading-data.ts` debe:
1. Conectarse al master DB para listar tenants activos
2. Por cada tenant: exportar SELECT * de las 5 tablas a CSV/JSON (nombrado `{tenant}/{tabla}.csv`)
3. Ser idempotente: si los archivos ya existen, no re-exportar (o sobre-escribir con mismo contenido)
4. Abortar el tenant si falla, continuar con el siguiente
5. Ejecutar ANTES de cualquier migración DROP

Este approach sigue siendo correcto.

---

## Pregunta 7: Secuencia de PRs

La secuencia de 2 PRs sigue válida. El perfil de riesgo es ahora MENOR que en el explore original porque el legacy path es dead code:

**PR-a (riesgo BAJO):**
- Script `archive-legacy-grading-data.ts` + tests
- Borrar legacy NotaTrimestral path en generate-boletin (líneas 244-334)
- Borrar `resolveDocentesForStudentCC` (líneas 906-1001)
- Borrar 7 archivos de strategies en `api/src/application/shared/strategies/`
- Borrar domain entities/repos legacy en `packages/domain/src/pedagogy/`
- Actualizar exports en `packages/domain/src/index.ts` y `pedagogy/index.ts`
- Limpiar stale mocks en tests de boletin
- **SIN migración de schema**

**PR-b (riesgo MEDIO — pre-deploy: ejecutar archival script primero):**
- DROP TABLE en orden: notas → evaluaciones → notas_trimestrales → periodos_evaluacion → subject_assignments
- Rollback inline (recreación de tablas con datos from archival)
- Requiere que PR-a esté deployed

**PR-b habilita S3b-final** (drop Teacher — change separado, ya sin blockers post PR-b).

---

## Removal inventory completo

| Categoría | Items |
|---|---|
| Schema tenant | 5 models: `Nota`, `Evaluacion`, `NotaTrimestral`, `PeriodoEvaluacion`, `SubjectAssignment` |
| Domain entities | `nota.ts`, `evaluacion.ts`, `nota-trimestral.ts`, `periodo-evaluacion.ts`, `subject-assignment.ts` |
| Domain repos | `nota-trimestral-repository.ts`, `evaluacion-repository.ts`, `periodo-evaluacion-repository.ts`, `subject-assignment-repository.ts` |
| Application (UC) | Legacy path lines 244-334 + `resolveDocentesForStudentCC` lines 906-1001 en generate-boletin |
| Application (strategies) | 7 archivos en `api/src/application/shared/strategies/` |
| Tests | Stale mocks en generate-boletin.use-case.test.ts y generate-boletin.docente-s2.test.ts |
| Scripts nuevos | `api/scripts/archive-legacy-grading-data.ts` + tests |

---

## Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Pérdida de datos sin archival | CRÍTICO | Archival script OBLIGATORIO antes de PR-b |
| Orden de DROP incorrecto (Restrict) | ALTO | Script con ORDER explícito: notas→eval→notas_trim→periodos→subj_assign |
| PR-b deployado antes que PR-a | ALTO | PR-b tiene IF EXISTS guards; igual: PR-a debe estar merged primero |
| Archival falla en algún tenant | ALTO | Script aborta tenant específico, continúa; verificar logs antes de PR-b |

---

## VEREDICTO

**DROP VIABLE: SÍ — sin condiciones pendientes.**

La premisa de congelamiento (Decisión #1 del explore original) era "Inicial/Terciario no tienen grading en el modelo nuevo". Esa premisa es falsa hoy:
- Inicial → InformeEvolutivo (archivado 2026-06-17)
- Terciario → InscripcionMateria + ActaExamenNota (archivado 2026-06-18)

El legacy NotaTrimestral path en `generate-boletin.use-case.ts` (líneas 244-334) es dead code. La tabla `SubjectAssignment` no tiene ningún lector de producción. El drop es técnicamente seguro una vez ejecutado el archival script.

**Next step: proceder a `sdd-propose` para `retiro-grading-legacy-s3pre`.**
