# Tasks: retiro-grading-legacy-s3pre

> Generated: 2026-06-19 · Store: hybrid  
> Delivery: 3 PRs encadenados (PR-a1 → PR-a2 → PR-b) — decisión 2026-06-19: separar el script de archival de los borrados. PR-b requiere PR-a* deployado + archival exit 0 en todos los tenants.  
> TDD: test primero en todo lo nuevo. `pnpm test` / `pnpm build`. Coverage ≥ 80%.  
> Orden Clean Arch en PR-a: consumidores (application) → dominio → exports.  
> Correcciones del design aplicadas: V-1 (6 relaciones inversas), V-2 (nota-repository.ts), V-3 (pedagogy.test.ts), V-4 (F3 backfill en PR-b).

---

## PR-a1 — Archival Script (sin cambio de schema)

Riesgo: BAJO. Solo agrega el script de archival + tests. No borra nada, no toca el schema. Revertible por `git revert`.

---

### 1 — Infrastructure/Scripts: Archival Script (TDD first)

> Satisface: REQ-1.1–1.8 (grading-legacy-archival/spec.md)  
> Patrón: `api/scripts/cleanup-ingresantes-sin-ciclo.ts` — helpers exportados puros, sin DB real en tests, mock de TenantPrismaClient.

- [x] **1.1** `[RED]` Crear `api/scripts/__tests__/archive-legacy-grading-data.spec.ts` con 4 suites failing:
  - **Scenario A — Export por tenant:** dado mock TenantPrismaClient con N filas por tabla, el helper escribe `{tenant-slug}/{tabla}.csv` (o `.json`) con esas N filas. Cubre las 5 tablas: `notas`, `evaluaciones`, `notas_trimestrales`, `periodos_evaluacion`, `subject_assignments`.
  - **Scenario B — Idempotencia:** segunda corrida con archivo ya presente (bytes > 0) → el helper skippea sin sobreescribir, sin error, exit 0.
  - **Scenario C — Abort-on-fail por tenant:** fallo en `notas` de tenant `beta` → loguea `[beta][notas]`, no propaga, las tablas restantes de `beta` NO se intentan, el script continúa con el siguiente tenant, exit 1.
  - **Scenario D — Tabla vacía:** 0 filas → crea archivo con solo header (CSV) / array vacío (JSON). No se trata como fallo.
  - Ejecutar `pnpm test` — los tests fallan (RED). Los helpers aún no existen.

- [x] **1.2** `[GREEN]` Implementar `api/scripts/archive-legacy-grading-data.ts`:
  - Enumerar tenants activos desde MASTER usando el patrón `PrismaService` master.
  - Por tenant: conectar al tenant DB, exportar las 5 tablas en orden fijo.
  - Skip-on-exists: si el archivo de salida existe con bytes > 0, omitir esa tabla para ese tenant.
  - Abort-per-tenant: error en cualquier tabla → loguear `[tenant][tabla]`, abortar las tablas restantes de ese tenant, continuar con el siguiente.
  - Exit 0 si todos los tenants completaron OK (incluyendo skips). Exit 1 si al menos un tenant falló.
  - Ejecutar `pnpm test` — los 4 scenarios del spec 1.1 pasan (GREEN).

---

### 1b — PR-a1 Gate: Build + Tests Verdes

> Gate de cierre de PR-a1. Solo valida que el script nuevo no rompe nada; el schema sigue intacto.

- [x] **1b.1** `[GATE]` `pnpm build` — verde.
- [x] **1b.2** `[GATE]` `pnpm test` — verde (incluye los 4 scenarios del archival script).

---

## PR-a2 — Dead Code Removal (sin cambio de schema)

Riesgo: BAJO. ~1.200 líneas eliminadas de dead code verificable con grep. El schema tenant queda intacto; el Prisma client sigue exponiendo los 5 modelos. Revertible por `git revert`. Requiere PR-a1 mergeado.

---

### 2 — Application: Legacy Path en generate-boletin

> Satisface: REQ-4.2 + delta/report-cards "Legacy NotaTrimestral Path — RETIRED" + "No Legacy Table Reads"  
> Archivo: `api/src/application/reportes/generate-boletin.use-case.ts`  
> SECUENCIAL: 2.1 → 2.2 → 2.3. No saltear el baseline (2.1).

- [ ] **2.1** `[BASELINE]` Correr `pnpm --filter api test` y confirmar que los 4 suites de boletín pasan ANTES de tocar el use-case:
  - `generate-boletin.use-case.test.ts`
  - `generate-boletin.docente-s2.test.ts`
  - `generate-boletin.inicial.test.ts`
  - `generate-boletin.terciario.test.ts`
  - Si alguno falla → STOP. No continuar hasta que el baseline esté verde.

- [ ] **2.2** `[MODIFY]` En `generate-boletin.use-case.ts` borrar:
  - Bloque `else` legacy completo (~líneas 244-334): la rama de `buildMaterias()` que lee `NotaTrimestral` y `CourseCycles` cuando los repos NO están inyectados.
  - Sub-bloque `isInicial` + llamada a `resolveDocentesForStudentCC` (~líneas 263-269), que estaba dentro del bloque anterior.
  - Método privado `resolveDocentesForStudentCC` completo (~líneas 906-1001).
  - Verificar con grep que `NotaTrimestral`, `notaTrimestral`, `resolveDocentesForStudentCC`, `SubjectAssignment` no aparecen en el archivo. Si aparecen → revisar que no quedaron fragmentos.

- [ ] **2.3** `[GREEN / NO-REGRESIÓN]` `pnpm --filter api test` — los 4 suites de boletín pasan idénticos a 2.1. Si algún assert cambia o un test rompe → el path NO era dead code → STOP y re-evaluar antes de continuar.

---

### 3 — Application: Dead-Code Strategies

> Satisface: REQ-4.1 (7 archivos borrados, sin imports vivos)  
> Directorio: `api/src/application/shared/strategies/`  
> PUEDE correr en paralelo con la tarea 4.

- [ ] **3.1** `[DELETE]` Borrar los 7 archivos:
  - `evaluacion.strategy.ts`
  - `evaluacion-inicial.strategy.ts`
  - `evaluacion-primario.strategy.ts`
  - `evaluacion-secundario.strategy.ts`
  - `evaluacion-terciario.strategy.ts`
  - `evaluacion-strategy.factory.ts`
  - `index.ts`
  - Confirmar con grep que ningún archivo del repo importa de esta carpeta. La única mención conocida es un comentario en `boletin-template.factory` — no es un import y no bloquea.

---

### 4 — Application Tests: Stale Mock Cleanup

> Satisface: REQ-4.6 + regression guard "No Legacy Table Reads" (delta/report-cards)  
> Archivos: 4 test files de boletín  
> PUEDE correr en paralelo con la tarea 3. DEBE ejecutarse DESPUÉS de 2.3 (baseline confirmado).

- [ ] **4.1** `[MODIFY]` Quitar las claves `subjectAssignment`, `periodoEvaluacion`, `notaTrimestral` de los mock factories / `makeTenantClient` en:
  - `generate-boletin.use-case.test.ts`: instancias en ~383-385, 418-421, 591-594, 767-770, 926-929.
  - `generate-boletin.docente-s2.test.ts`: factory `makeTenantClient` ~líneas 13-16.
  - `generate-boletin.inicial.test.ts`: scan completo del archivo, quitar todas las ocurrencias.
  - `generate-boletin.terciario.test.ts`: scan completo del archivo, quitar todas las ocurrencias.

- [ ] **4.2** `[GREEN]` `pnpm --filter api test` — todos los tests de boletín pasan. Si alguno rompe → las claves eliminadas sí eran consultadas → STOP y revisar el use-case antes de continuar.

---

### 5 — Domain: Cleanup del Test de Entidades (V-3)

> V-3: `pedagogy.test.ts` importa y testea las 5 entidades legacy. Sin esta limpieza, el build de PR-a rompe al borrar los archivos en la tarea 6.  
> DEBE ejecutarse ANTES de la tarea 6 (DELETE de entidades/repos). DEBE ejecutarse DESPUÉS de 3 y 4 (consumidores de application ya borrados).

- [ ] **5.1** `[MODIFY]` En `packages/domain/src/pedagogy/__tests__/entities/pedagogy.test.ts`:
  - Quitar imports de las 5 entidades legacy (líneas ~11-15: `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral`).
  - Quitar los 5 `describe` blocks legacy (líneas ~111-197: bloques que testean las entidades borradas).

- [ ] **5.2** `[GREEN]` `pnpm --filter @educandow/domain test` — verde. Sin errores de compilación ni tests rotos. Si falla → quedan referencias a las entidades borradas → revisar 5.1.

---

### 6 — Domain: Borrar Entidades y Repos Legacy

> Satisface: REQ-4.3 (5 entidades) + REQ-4.4 (5 repos) + V-2 (nota-repository.ts que el explore omitió)  
> DEBE ejecutarse DESPUÉS de 5 (pedagogy.test.ts limpio) y DESPUÉS de 2/3/4 (consumidores de application borrados).

- [ ] **6.1** `[DELETE]` Borrar los 5 archivos de entidades:
  - `packages/domain/src/pedagogy/entities/subject-assignment.ts`
  - `packages/domain/src/pedagogy/entities/evaluacion.ts`
  - `packages/domain/src/pedagogy/entities/nota.ts`
  - `packages/domain/src/pedagogy/entities/periodo-evaluacion.ts`
  - `packages/domain/src/pedagogy/entities/nota-trimestral.ts`

- [ ] **6.2** `[DELETE]` Borrar los 5 archivos de repositorios (V-2: incluye `nota-repository.ts` que el explore no listó):
  - `packages/domain/src/pedagogy/repositories/subject-assignment-repository.ts`
  - `packages/domain/src/pedagogy/repositories/evaluacion-repository.ts`
  - `packages/domain/src/pedagogy/repositories/nota-repository.ts` **(V-2)**
  - `packages/domain/src/pedagogy/repositories/periodo-evaluacion-repository.ts`
  - `packages/domain/src/pedagogy/repositories/nota-trimestral-repository.ts`

---

### 7 — Domain: Limpiar Exports de Barrel Files

> Satisface: REQ-4.5 (exports cleaned — pedagogy/index.ts y domain/src/index.ts)  
> DEBE ejecutarse DESPUÉS de 6 (archivos ya borrados — si los exports se limpian antes, el barrel apuntaría a archivos que aún existen, no es error pero es confuso).

- [ ] **7.1** `[MODIFY]` `packages/domain/src/pedagogy/index.ts`:
  - Quitar exports de las 5 entidades legacy (líneas ~5-14: `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral` y sus tipos `Props`).
  - Quitar exports de los 5 repos legacy (líneas ~76-80: `SubjectAssignmentRepository`, `EvaluacionRepository`, `NotaRepository`, `PeriodoEvaluacionRepository`, `NotaTrimestralRepository`).
  - Conservar todos los demás exports del barrel.

- [ ] **7.2** `[MODIFY]` `packages/domain/src/index.ts`:
  - Quitar re-exports de entidades/Props legacy (líneas ~57-58).
  - Quitar re-export de repos legacy (línea ~81).
  - Conservar el resto del barrel intacto.

---

### 8 — PR-a2 Gate: Build + Tests Verdes

> Gate de cierre de PR-a2 (AD-2). DEBE ser el último paso antes de abrir el PR. DEBE ejecutarse DESPUÉS de completar las tareas 2-7.

- [ ] **8.1** `[GATE]` `pnpm build` — verde. Incluye `tsc` de `@educandow/domain` sin los exports legacy. Si falla → hay un export o import colgado; revisar 7.1 o 7.2.

- [ ] **8.2** `[GATE]` `pnpm test` — verde. Todos los suites pasan (dominio, boletín, archival script). Si algún test referencia tipos borrados → revisar 5.1 o 4.1.

---

## PR-b — DROP Migration (requiere PR-a deployed + archival exit 0 en todos los tenants)

Riesgo: MEDIO. Rollback requiere recrear las 5 tablas + restaurar desde los CSV/JSON del archival.  
Pre-condición operativa obligatoria: `api/scripts/archive-legacy-grading-data.ts` ejecutado con exit 0 para todos los tenants activos. Los archivos de salida existen en disco (5 por tenant).

---

### 9 — Infrastructure: F3 Backfill Cleanup (V-4)

> V-4: `backfill-materia-grupo.ts` y su test leen `tenant.subjectAssignment` del Prisma client, que desaparece en PR-b al regenerar el client tras el DROP. Van en PR-b porque el client sigue existiendo en PR-a (schema intacto).  
> Pre-condición operativa: confirmar que el backfill F3 corrió en todos los tenants (one-shot histórico) ANTES de borrar este script.  
> PUEDE correr en paralelo con la tarea 10.

- [ ] **9.1** `[DELETE]` Borrar `api/scripts/backfill-materia-grupo.ts`.

- [ ] **9.2** `[DELETE]` Borrar `api/test/integration/materia-grupo-ciclo/f3-backfill.db.test.ts`.

- [ ] **9.3** `[MODIFY]` `api/test/integration/setup/factories.ts`:
  - Quitar la función `createSubjectAssignment` (~líneas 218+) que llama `tenant.subjectAssignment.create`.
  - Verificar con grep que no queda ningún otro consumidor de `createSubjectAssignment` en el repo (tras borrar 9.2 no debería haber ninguno).

---

### 10 — Infrastructure/Schema: Limpieza del Schema Prisma Tenant

> Satisface: REQ-2.5 + REQ-3.2 + V-1 (son 6 relaciones inversas, no 4 — la más fácil de olvidar es `GradeScaleValue.notas`)  
> Archivo: `api/prisma_tenant/schema.prisma`  
> PUEDE correr en paralelo con la tarea 9. DEBE completarse ANTES de la tarea 11 (migración).

- [ ] **10.1** `[MODIFY]` En `api/prisma_tenant/schema.prisma`:
  - Borrar los 5 model blocks:
    - `SubjectAssignment` (~líneas 462-485)
    - `Evaluacion` (~líneas 608-626)
    - `Nota` (~líneas 628-658)
    - `PeriodoEvaluacion` (~líneas 660-675)
    - `NotaTrimestral` (~líneas 677-697)
  - Borrar las **6 relaciones inversas** (V-1 — todas deben quitarse o `prisma generate` falla):
    - `Student.notas Nota[]` (~línea 42)
    - `Student.notasTrimestrales NotaTrimestral[]` (~línea 43)
    - `Teacher.subjectAssignments SubjectAssignment[]` (~línea 109)
    - `Subject.subjectAssignments SubjectAssignment[]` (~línea 414)
    - `CourseSection.subjectAssignments SubjectAssignment[]` (~línea 448)
    - `GradeScaleValue.notas Nota[]` (~línea 595) — **V-1: la relación que el explore no detectó**

---

### 11 — Infrastructure/Migration: DROP Migration

> Satisface: REQ-2.1–2.4 + AD-3 (orden FK hijo→padre, IF EXISTS, rollback inline)  
> DEBE ejecutarse DESPUÉS de 10 (schema ya limpio antes de generar la migración).

- [ ] **11.1** `[CREATE]` Crear `api/prisma_tenant/migrations/{timestamp}_drop_grading_legacy/migration.sql`:
  - Generar el archivo con `pnpm --filter api prisma:migrate:tenant dev --create-only`.
  - Revisar y ajustar el orden a mano para garantizar FK-safe (Prisma no garantiza el orden automáticamente):
    ```sql
    -- DROP grading legacy — orden hijo→padre (FKs Restrict). AD-3.
    -- PRE-REQUISITO: archive-legacy-grading-data.ts ejecutado OK en este tenant.
    DROP TABLE IF EXISTS "notas";
    DROP TABLE IF EXISTS "evaluaciones";
    DROP TABLE IF EXISTS "notas_trimestrales";
    DROP TABLE IF EXISTS "periodos_evaluacion";
    DROP TABLE IF EXISTS "subject_assignments";
    ```
  - Agregar bloque rollback inline comentado: `CREATE TABLE` en orden inverso (`subject_assignments` → `periodos_evaluacion` → `notas_trimestrales` → `evaluaciones` → `notas`) con PK, FKs originales (Restrict/Cascade) e índices. Los datos se restauran desde los CSV/JSON del archival (AD-1).

---

### 12 — PR-b Gate: Prisma Generate + Build + Tests + Post-Condición

> Gate de cierre de PR-b (AD-2 + REQ-3.1 + REQ-3.3). DEBE ser el último paso antes de abrir el PR. DEBE ejecutarse DESPUÉS de completar todas las tareas 9-11.

- [ ] **12.1** `[GATE]` `pnpm --filter api prisma:generate` — verde. Valida que las **6 relaciones inversas** (V-1) fueron eliminadas: si falta alguna, `prisma generate` falla con error de campo desconocido. Este gate es el detector de V-1.

- [ ] **12.2** `[GATE]` `pnpm build` — verde. Valida que ningún archivo de la aplicación referencia tipos `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral` del Prisma client regenerado.

- [ ] **12.3** `[GATE]` `pnpm test` — verde. Confirma que el borrado del F3 (9.1-9.3) no dejó imports colgados y que los suites de integración pasan.

- [ ] **12.4** `[POST-CONDICIÓN — REQ-3.1]` En al menos un tenant de staging, verificar con SQL que `teachers` no tiene FK children:
  ```sql
  SELECT COUNT(*)
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'teachers';
  -- Resultado esperado: 0
  ```
  Confirma REQ-3.1 → habilita el change S3b-final (drop `teachers`). No iniciar S3b-final hasta confirmar este resultado en todos los tenants activos (REQ-3.4).

---

## Review Workload Forecast

| PR | Líneas añadidas | Líneas eliminadas | Diff bruto estimado | Riesgo presupuesto 400 |
|----|-----------------|-------------------|---------------------|------------------------|
| PR-a1 | ~270 (archival script ~150 + archival test ~120) | ~0 | ~270 | **OK** — lógica nueva, review focalizado |
| PR-a2 | ~0 | ~1.200 (strategies 7 archivos ~350 + entities 5 ~150 + repos 5 ~100 + use-case legacy path ~200 + pedagogy.test.ts ~95 + barrels ~15 + stale mocks ~30 + misc ~260) | ~1.200 | borrados grep-verificables (deletion-only) |
| PR-b | ~50 (migration SQL) | ~400 (schema blocks ~90 + F3 backfill script ~180 + F3 test ~100 + factory ~30) | ~450 | **MEDIO — borderline** |

**Chained PRs recomendados: SÍ. 3 PRs (decisión 2026-06-19): PR-a1 aísla la lógica nueva del archival; PR-a2 es borrado mecánico verificable con grep; PR-b es el DROP.**

**Nota sobre el presupuesto:** PR-a supera 400 líneas brutos porque elimina ~1.200 líneas de dead code verificado. La carga de review REAL es asimétrica: las eliminaciones son mecánicas (se verifican con grep — si no hay imports, el borrado es correcto) y la carga sustantiva recae en las ~270 líneas nuevas del archival script. Estrategia de review sugerida: focalizar en la idempotencia (skip-on-exists), el abort-per-tenant y los exit codes; verificar deleciones con grep de imports. Si el equipo requiere estrictamente < 400 líneas brutos por PR, PR-a puede dividirse en PR-a1 (archival + use-case cleanup) y PR-a2 (strategies + domain) — pero esto añade un PR al chain sin beneficio de riesgo.

**Bottleneck secuencial crítico en PR-a:** la tarea 5.1 (pedagogy.test.ts cleanup — V-3) DEBE preceder a 6.1/6.2 (borrar entidades/repos). Es la única dependencia no obvia dentro del PR; si se invierte el orden, el build rompe.

**Dependencias entre PRs:** PR-b tiene una pre-condición operativa (no solo de git): el archival script debe haber corrido con exit 0 en todos los tenants. Este gate es responsabilidad del operador, no del pipeline de CI.
