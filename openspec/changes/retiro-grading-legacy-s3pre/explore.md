# Explore: retiro-grading-legacy-s3pre

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3-pre — archivar + dropear grading legacy (Evaluacion/Nota/NotaTrimestral/PeriodoEvaluacion/SubjectAssignment). Habilita S3b-final (drop Teacher).

## 🛑 RIESGO HEADLINE — premisa de Decision #1 incompleta
Inicial (decada 1) y Terciario (decada 4) **NO tienen datos de notas en el modelo nuevo** — sus notas viven SOLO en `NotaTrimestral`. Además, la **entrada** de notas del modelo nuevo está restringida a Primario/Secundario (`ListTeacherCourseCyclesUseCase.SUBJECT_ALLOWED_DECADES = [2,3]`); Inicial/Terciario no tienen path de carga en el modelo nuevo. El CRUD legacy de notas se removió en S1. → Esos niveles HOY solo muestran notas históricas (read-only) vía el path legacy del boletín.

**Implicación:** repuntar el boletín al modelo nuevo (premisa de Decision #1) NO muestra notas para Inicial/Terciario (ni históricas ni nuevas). Dropear el legacy elimina la única capacidad de notas de esos niveles, sin reemplazo. NO es solo "archivar historia".

## Mecánica (clara, si se decide avanzar)
### Grafo de FK + orden de drop
```
teachers.id ←(Cascade) subject_assignments
  subject_assignments ←(Restrict) evaluaciones ←(Restrict) notas
  subject_assignments ←(Restrict) notas_trimestrales →(Restrict) periodos_evaluacion
```
Orden: notas → evaluaciones → notas_trimestrales → periodos_evaluacion → subject_assignments. Tras dropear subject_assignments, `teachers` queda SIN consumidores de FK → S3b-final habilitado.

### Lectores vivos de las tablas legacy
SOLO `generate-boletin.use-case.ts` path legacy (Inicial/Terciario, ~líneas 202-294): subjectAssignment (materias) + periodoEvaluacion (períodos) + notaTrimestral (notas). Ningún otro use-case/controller/repo. (Primario/Secundario ya usan el modelo nuevo.) Strategies en `api/src/application/shared/strategies/` (7 archivos) son dead code desde S1.

### Archivado (recomendado)
Script `archive-legacy-grading-data.ts` (patrón de `cleanup-ingresantes-sin-ciclo.ts`): itera tenants activos desde master, exporta SELECT * de las 5 tablas a CSV/JSON por tenant, idempotente, aborta si falla. Pre-deploy, ANTES de cualquier migración.

### Removal inventory
Domain: borrar 5 entidades + 5 repos en `packages/domain/src/pedagogy/` + exports en index. Schema: 5 model blocks + relaciones en Student/Subject/CourseSection/Teacher. Dead code: 7 strategies. Migración SQL: 5 DROP TABLE en orden (IF EXISTS), rollback estructura inline.

### Secuencia: 2 PRs (PR-a debe deployarse antes que PR-b)
- PR-a: archival script + decouple del boletín (Inicial/Terciario) + tests. Sin migración.
- PR-b: DROP migration + domain/schema/dead-code cleanup. Requiere PR-a live.

## DECISIÓN requerida (re-consulta, premisa #1 corregida)
Dado que Inicial/Terciario no tienen grading en el modelo nuevo:
- **A — Dropear + boletín tira error explícito** (`BOLETIN_LEVEL_LEGACY`) para Inicial/Terciario; historia en archivo CSV. Cierra el retiro de Teacher, pero **elimina el boletín con notas de esos niveles**.
- **B — Dropear + boletín con materias y notas vacías.** Engañoso (parece un bug). Descartado.
- **C — Construir grading nuevo para Inicial/Terciario primero** (entrada + migración de datos) y después dropear. Cambio grande aparte. Preserva la capacidad.
- **D — Conservar el legacy congelado para Inicial/Terciario** (no dropear SubjectAssignment/NotaTrimestral/etc.). El boletín sigue mostrando notas históricas. `Teacher` queda como tabla frozen mínima. Termina el retiro acá (footprint reducido), sin drop total.

## Riesgos
- CRÍTICO: pérdida de la capacidad de notas de Inicial/Terciario sin reemplazo (no solo historia).
- ALTO: PR-b no puede deployarse antes de PR-a (boletín leería tablas dropeadas).
- ALTO: el archival debe tener 100% éxito por tenant antes del DROP.
- ALTO: orden de drop (Restrict) estricto.

## Siguiente: RESOLVER la decisión A/C/D (premisa #1 corregida) antes de proponer.
