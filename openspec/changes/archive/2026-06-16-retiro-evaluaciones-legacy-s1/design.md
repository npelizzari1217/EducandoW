# Design: retiro-evaluaciones-legacy-s1

> Fase: sdd-design · Store: hybrid · 2026-06-16 · Branch: `feat/retiro-evaluaciones-legacy-s1`
> Slice S1 del paraguas `retiro-teacher-legacy` (PR B1: borrado de superficie muerta).

## 1. Architecture approach

Borrado quirúrgico **presentación + aplicación + infra-repo en conjunto** (clean-arch), **dominio y schema intactos**. NO es borrado por módulo: `PedagogyController` y `PedagogyModule` mezclan use-cases LEGACY (subject-assignment → evaluacion/nota/periodo/nota-trimestral) con NUEVOS (competency, study-plan, academic-cycle, attendance, subjects, course-sections). Se extrae únicamente la veta legacy y se re-cablea DI sin tokens colgando.

**Hallazgo clave que reduce el riesgo:** NO existe un controller separado de `/evaluaciones` o `/notas-trimestrales`. Las 5 vetas legacy (`/subject-assignments`, `/evaluaciones`, `/notas`, `/periodos`, `/notas-trimestrales`) viven TODAS dentro de `pedagogy.controller.ts`. El borrado es local a un controller + su módulo + el archivo de use-cases compartido + 5 repos infra.

## 2. R1 RESUELTO — frontera exacta keep/remove (el contrato)

### Resolución del riesgo crítico `/periodos` (¿compartido?)
**`PeriodosPage` y `/periodos` son LEGACY → REMOVE.** Evidencia definitiva:
- `/periodos` (web) lo consumen SOLO `PeriodosPage` y `NotasTrimestralesPage` (ambas legacy). Grep exhaustivo en `web/src` no muestra otro consumidor.
- Backend `/periodos` → `PrismaPeriodoEvaluacionRepo` → modelo `PeriodoEvaluacion`.
- El NUEVO grading usa una ruta y repo DISTINTOS: `/grading-periods` → `PrismaGradingPeriodRepository` → `GradingPeriod` (página `GradingPeriodsPage`, sidebar línea 112). **No hay solapamiento de ruta ni de repositorio.** `/periodos` ≠ `/grading-periods`.

Conclusión: ninguna de las 4 páginas de `evaluation-pages.tsx` es compartida con el nuevo grading. Las 4 se borran.

### Tabla keep/remove (fuente de verdad para apply)

| Archivo | Símbolo / Ruta | Acción | Razón (fuente de datos) |
|---|---|---|---|
| `web/src/pages/dashboard/evaluation-pages.tsx` | **archivo completo** (`EvaluacionesPage`, `NotasPage`, `PeriodosPage`, `NotasTrimestralesPage`, tipos + `ConfirmModal` locales) | **REMOVE** | EvaluacionesPage/NotasPage → `/subject-assignments`+`/evaluaciones`+`/notas` (legacy). PeriodosPage/NotasTrimestralesPage → `/periodos`+`/notas-trimestrales` (legacy, repo `PeriodoEvaluacion`/`NotaTrimestral`). Tipos y `ConfirmModal` son locales al archivo (sin import externo). |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | `SubjectAssignmentsPage` (línea 56) | **REMOVE** | `/subject-assignments` (CRUD legacy). NO está ruteada en App.tsx → export huérfano. |
| `web/src/pages/dashboard/pedagogy-pages.tsx` | `SubjectsPage`, `CourseSectionsPage` (re-export), `AttendancePage`, `GenericPage` | **KEEP** | `/subjects`, `/course-sections`, `/attendance` — vigentes (no legacy grading). `GenericPage` lo usan los KEEP. |
| `web/src/App.tsx` | import `{ EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage }` (líneas 23-28) | **REMOVE** | importa el archivo borrado. |
| `web/src/App.tsx` | rutas `/evaluaciones`, `/evaluaciones/notas`, `/periodos`, `/notas-trimestrales` (líneas 74-77) | **REMOVE** | apuntan a páginas legacy borradas. |
| `web/src/App.tsx` | import `AttendancePage` (línea 22) + ruta `/attendance` (línea 78) y todas las rutas de nuevo grading (`/competency-grading`, `/grading/by-course`, `/grading-periods`, `/grading-scales`, etc.) | **KEEP** | no legacy. |
| `web/src/App.tsx` | import `SubjectAssignmentsPage` | **(no existe)** | confirmado: App.tsx NO importa ni rutea SubjectAssignmentsPage. Sin cambio de ruta para ella. |
| `web/src/components/layout/sidebar.tsx` | entrada `/evaluaciones` "Notas y Calificaciones" (línea 58) | **REMOVE** | única entrada de menú de la veta legacy. |
| `web/src/components/layout/sidebar.tsx` | entrada `/grading-periods` "Períodos de Calificación" (línea 112) | **KEEP** | nuevo grading. Las demás rutas legacy (`/periodos`, `/notas-trimestrales`, `/subject-assignments`, `/evaluaciones/notas`) NO aparecen en el sidebar. |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | handlers `subject-assignments` (POST/GET/DELETE, 157-165), `evaluaciones` (POST/GET/DELETE, 167-175), `notas` (POST/GET/DELETE, 177-185), `periodos` (POST/GET/DELETE, 187-195), `notas-trimestrales` (POST/GET/DELETE, 197-220) | **REMOVE** | rutas legacy. |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | 15 inyecciones del constructor (líneas 23-27): `createAssignUC/listAssignUC/deleteAssignUC`, `create/list/deleteEvaluacionUC`, `create/list/deleteNotaUC`, `create/list/deletePeriodoUC`, `create/list/deleteNotaTrimestralUC` | **REMOVE** | sólo usadas por los handlers borrados. |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | handlers de subjects, course-sections, attendance, academic-cycles, study-plans, subject-competencies, competency-valuations; inyección `boletinInvalidation` y `TenantContext` | **KEEP** | `boletinInvalidation` y `TenantContext` siguen usados por `gradePeriod` y study-plans. |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | clases `CreateSubjectAssignmentUC`/`ListSubjectAssignmentsUC`/`DeleteSubjectAssignmentUC` (263-279), `Create/List/DeleteEvaluacionUC` (281-287), `Create/List/DeleteNotaUC` (289-295), `Create/List/DeletePeriodoUC` (297-303), `Create/List/DeleteNotaTrimestralUC` (305-311) | **REMOVE** | use-cases CRUD legacy. |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | imports (línea 3 types: `SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository`; línea 4 entidades: `SubjectAssignment, Evaluacion, Nota, PeriodoEvaluacion, NotaTrimestral`) | **REMOVE (trim)** | quedan sin uso tras borrar las clases → evitar import muerto. Mantener `SubjectRepository, CourseSectionRepository, AttendanceRepository, AcademicCycleRepository, StudyPlanRepository, ...` y entidades `Subject, CourseSection, Attendance, AcademicCycle, StudyPlan`. |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | secciones Attendance, StudyPlan, AcademicCycle, Subject, CourseSection | **KEEP** | vigentes. |
| `api/src/presentation/pedagogy/dto/pedagogy.dto.ts` | `CreateSubjectAssignmentSchema/DTO`, `CreateEvaluacionSchema/DTO`, `CreateNotaSchema/DTO`, `CreatePeriodoSchema/DTO`, `CreateNotaTrimestralSchema/DTO` | **REMOVE** | DTOs de las rutas borradas. Archivo es una línea minificada → edición quirúrgica (ver §5). Mantener el resto de schemas. |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | imports `PrismaSubjectAssignmentRepo`, `PrismaEvaluacionRepo`, `PrismaNotaRepo`, `PrismaPeriodoEvaluacionRepo`, `PrismaNotaTrimestralRepo` (9-13) | **REMOVE** | repos huérfanos tras borrar UCs. |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | en arrays `repos` (24) y `tokens` (25): quitar las 5 entradas legacy y sus tokens `SubjectAssignmentRepository, EvaluacionRepository, NotaRepository, PeriodoEvaluacionRepository, NotaTrimestralRepository` | **REMOVE (índices alineados)** | ver §3 — el `.map((t,i)=>... repos[i])` exige mantener orden 1:1 entre arrays. |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | 15 providers `{ provide: UC.Create/List/Delete... }` (líneas 42-56) | **REMOVE** | proveen los UCs borrados. |
| `api/src/presentation/pedagogy/pedagogy.module.ts` | providers de Subject/CourseSection/Attendance/AcademicCycle/StudyPlan/Competency + repos competency/grading/courseCycle + `exports` | **KEEP** | vigentes (nuevo grading, study-plans, boletin via ReportesModule). |
| `api/.../repositories/prisma-subject-assignment.repository.ts` | `PrismaSubjectAssignmentRepo` | **REMOVE (archivo)** | sólo referenciado por pedagogy.module + UCs borrados. Boletin NO lo usa (raw client). |
| `api/.../repositories/prisma-evaluacion.repository.ts` | `PrismaEvaluacionRepo` | **REMOVE (archivo)** | sólo pedagogy.module + UCs borrados. |
| `api/.../repositories/prisma-nota.repository.ts` | `PrismaNotaRepo` | **REMOVE (archivo)** | idem. |
| `api/.../repositories/prisma-periodo-evaluacion.repository.ts` | `PrismaPeriodoEvaluacionRepo` | **REMOVE (archivo)** | idem. |
| `api/.../repositories/prisma-nota-trimestral.repository.ts` | `PrismaNotaTrimestralRepo` | **REMOVE (archivo)** | idem. Boletin lee `client.notaTrimestral.findMany` RAW (no el repo). |
| `api/src/application/reportes/generate-boletin.use-case.ts` | `client.subjectAssignment.findMany` (223/324/525) + `client.notaTrimestral.findMany` (240) | **KEEP — NO TOCAR** | acceso RAW al modelo Prisma; migración es S2. Sobrevive porque el schema queda intacto. |
| `api/src/application/shared/strategies/evaluacion-*.strategy.ts` + `evaluacion-strategy.factory.ts` | todo | **KEEP** | son las estrategias del NUEVO grading por nivel; NO referencian ningún repo legacy (grep confirmó 0 matches). El nombre "evaluacion" es homónimo, no la veta legacy. |
| `api/.../prisma/schema.prisma` (tenant) | modelos `SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral` | **KEEP — NO TOCAR** | requisito duro. Datos y modelos preservados (S3). |
| `@educandow/domain` | entidades + interfaces `SubjectAssignment(Repository)`, `Evaluacion(Repository)`, `Nota(Repository)`, `PeriodoEvaluacion(Repository)`, `NotaTrimestral(Repository)` | **KEEP** | el dominio se retira en S2/S3. Boletin y compat futura los referencian. Una interfaz sin implementación no rompe DI. |
| `api/src/application/pedagogy/__tests__/subject-assignment.use-cases.test.ts` | archivo | **REMOVE** | cubre `CreateSubjectAssignmentUC` y hermanos borrados. |
| `api/test/integration/evaluaciones.test.ts` | archivo | **REMOVE** | importa `CreateEvaluacionUC/.../CreateNotaTrimestralUC` borrados. |
| `api/src/application/pedagogy/__tests__/{academic-cycle,study-plan,competency}.use-cases.test.ts` | archivos | **KEEP** | cubren código vigente. |

## 3. Edición quirúrgica del módulo (DI sin colgar)

`pedagogy.module.ts` define dos arrays paralelos consumidos por índice:
```ts
...tokens.map((t, i) => ({ provide: t, useExisting: repos[i] }))
```
**Invariante:** `repos[i]` debe corresponder a `tokens[i]`. Al borrar las 5 entradas legacy hay que quitar el repo Y su token en la MISMA posición de ambos arrays. Resultado esperado:
- `repos` queda: `[PrismaSubjectRepo, PrismaCourseSectionRepo, PrismaAttendanceRepo, PrismaAcademicCycleRepository, PrismaStudyPlanRepository, PrismaSubjectCompetencyRepo, PrismaCompetencyValuationRepo]`
- `tokens` queda: `['SubjectRepository', 'CourseSectionRepository', 'AttendanceRepository', 'AcademicCycleRepository', 'StudyPlanRepository', 'SubjectCompetencyRepository', 'CompetencyValuationRepository']`

**No quedan tokens inyectados sin provider:** los tokens `SubjectAssignmentRepository/EvaluacionRepository/NotaRepository/PeriodoEvaluacionRepository/NotaTrimestralRepository` sólo eran inyectados por los UCs que se borran. Verificación: grep confirmó que ningún otro módulo/UC inyecta esos tokens. Los repos `Competency*`, `GradeScale`, `GradingPeriod`, `CourseCycle` y el `exports` se mantienen intactos.

## 4. Decisiones (ADR-style)

**ADR-1 — Borrar también los 5 repos infra (no solo los UCs).**
Decisión: eliminar `PrismaSubjectAssignmentRepo`, `PrismaEvaluacionRepo`, `PrismaNotaRepo`, `PrismaPeriodoEvaluacionRepo`, `PrismaNotaTrimestralRepo` y sus tokens.
Rationale: tras borrar los UCs quedan huérfanos (sólo los referenciaba `pedagogy.module`). Boletin accede a `subjectAssignment`/`notaTrimestral` por **cliente Prisma raw**, no por repo. Dejarlos vivos sería código muerto y viola "remove presentation + application together" + repository-pattern.
Alternativa rechazada: conservar repos como providers inertes — deja dead code y no aporta (el dominio/schema ya se conserva por separado).

**ADR-2 — Conservar entidades e interfaces de dominio.**
Decisión: NO tocar `@educandow/domain` (`SubjectAssignment`, `Evaluacion`, `Nota`, `PeriodoEvaluacion`, `NotaTrimestral` + sus `*Repository`).
Rationale: el retiro de dominio es S2/S3; boletin aún tipa contra el modelo Prisma y el dominio se mantiene como contrato. Interfaces sin impl no rompen Nest DI.
Alternativa rechazada: borrar el dominio ahora — saldría de alcance S1 y arriesga boletin/migración.

**ADR-3 — Schema Prisma intacto.**
Decisión: cero edición de `schema.prisma`; modelos y datos preservados.
Rationale: requisito duro; FKs `Restrict` (Evaluacion/NotaTrimestral→SubjectAssignment) harían fallar cualquier drop; archivado es S3. La superficie de ESCRITURA legacy desaparece, pero la LECTURA del boletin (raw) sigue verde sobre datos existentes.

**ADR-4 — Borrado quirúrgico, no por módulo.**
Decisión: extraer la veta legacy de un controller/módulo mixto manteniendo wiring de los nuevos UCs.
Rationale: `PedagogyController`/`PedagogyModule` son compartidos; borrar el módulo entero destruiría competency/study-plan/academic-cycle/attendance.

## 5. Plan de barrido de referencias colgantes (typecheck/build verdes)

Orden sugerido (de hoja a raíz para que el typecheck guíe):
1. **API repos**: borrar los 5 archivos repo → romperá imports en `pedagogy.module.ts`.
2. **pedagogy.module.ts**: quitar imports, entradas de `repos`/`tokens` (índices alineados), 15 providers UC.
3. **pedagogy.use-cases.ts**: borrar las 15 clases legacy + **trim de imports** líneas 3-4 (quitar tipos/entidades sin uso; cuidado: `Id`/`ok` siguen usados por otras clases).
4. **pedagogy.controller.ts**: quitar 15 inyecciones del constructor + 14 handlers. Verificar que `DTO.*` restantes, `BoletinInvalidationService` y `TenantContext` siguen usados (lo están).
5. **pedagogy.dto.ts**: quitar las 5 `Create*Schema` + sus `*DTO`. Archivo es una sola línea larga → edición por sub-cadena exacta, no por número de línea.
6. **Web**: borrar `evaluation-pages.tsx` completo; quitar import+4 rutas en `App.tsx`; quitar `SubjectAssignmentsPage` en `pedagogy-pages.tsx`; quitar entrada sidebar línea 58.
7. **Tests**: borrar `subject-assignment.use-cases.test.ts` y `test/integration/evaluaciones.test.ts`.

Gates de verificación (todos deben quedar verdes):
- `pnpm --filter api typecheck` (sin imports/símbolos muertos)
- `pnpm test` (vitest; ningún test referencia símbolos borrados — confirmado sólo 2 archivos los referencian, ambos se borran)
- `vite build` (web) y `pnpm build` (turbo)
- grep post-borrado: 0 referencias a `EvaluacionesPage|NotasPage|PeriodosPage|NotasTrimestralesPage|SubjectAssignmentsPage`, a `/evaluaciones|/notas-trimestrales|/periodos|/subject-assignments` en web, y a `Prisma{Evaluacion,Nota,PeriodoEvaluacion,NotaTrimestral,SubjectAssignment}Repo` fuera de schema/boletin.

## 6. Manejo de tests

- DELETE: `api/src/application/pedagogy/__tests__/subject-assignment.use-cases.test.ts`, `api/test/integration/evaluaciones.test.ts`.
- KEEP: `academic-cycle`, `study-plan`, `competency` use-cases tests (código vigente).
- Confirmado por grep: NINGÚN otro test referencia los UCs/rutas borrados. No hay tests del boletin que dependan de los repos (boletin usa raw client).
- TDD (deleción): no se escriben tests nuevos; se borran los de código eliminado y se valida que la suite restante queda verde.

## 7. Estimación y estrategia de PR

| Área | Archivos | Líneas (aprox) | Tipo |
|---|---|---|---|
| Web | `evaluation-pages.tsx` (-493), `App.tsx` (~-10), `pedagogy-pages.tsx` (-1), `sidebar.tsx` (-1) | ~505 borradas | deleción |
| API | controller (~-70), module (~-25), use-cases (~-50), dto (~-5) | ~150 borradas/editadas | deleción |
| API repos | 5 archivos | ~250 borradas | deleción |
| Tests | 2 archivos | ~200 borradas | deleción |

**Total: ~1100 líneas, >95% deleción pura, 0 lógica nueva.** El presupuesto de 400 líneas aplica a líneas AÑADIDAS/cambiadas para revisión; aquí los cambios añadidos/modificados son ~40 (trims de imports y arrays). **Single PR (auto-chain) confirmado** — bajo riesgo de revisión por ser borrado verificado contra una tabla keep/remove explícita.

## 8. Integration points / flujo de datos preservado

- **Boletin** (todos los niveles): sigue leyendo `client.subjectAssignment.findMany({include:{teacher}})` y `client.notaTrimestral.findMany` RAW sobre los modelos Prisma intactos → PDFs verdes.
- **Nuevo grading**: `/competency-grading`, `/grading/by-course`, `/grading-periods`, `/grading-scales`, `/competency-valuations`, `subject-period/final-grades` → intactos (otros controllers/repos).
- **Nest DI**: `PedagogyModule` mantiene Subject/CourseSection/Attendance/AcademicCycle/StudyPlan/Competency wiring + `exports` sin cambios.
