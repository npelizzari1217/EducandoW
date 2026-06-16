# Proposal: retiro-evaluaciones-legacy-s1

> Fase: sdd-propose · Store: hybrid · 2026-06-16 · Branch: `feat/retiro-evaluaciones-legacy-s1`
> Slice S1 del paraguas `retiro-teacher-legacy` (PR B1: borrado de superficie muerta).

## Intent

El subsistema legacy de calificaciones (`SubjectAssignment` → `Evaluacion` / `NotaTrimestral`) fue reemplazado por el nuevo grading (subject-period-grades / subject-final-grades / valoraciones por competencia). Usuario confirmó que la superficie legacy ya NO se usa. Mantenerla viva confunde a usuarios, infla el bundle y arrastra tests/DTOs/use-cases muertos. S1 retira esa superficie de usuario y de API **sin tocar datos ni schema**. Éxito = la UI y los endpoints legacy desaparecen, todo lo demás (boletín, nuevo grading, mesas, docentes) sigue verde.

## Scope

**IN**
- Web: quitar rutas legacy en `App.tsx` (`/evaluaciones`, `/evaluaciones/notas`, `/periodos`, `/notas-trimestrales`) y la página admin `SubjectAssignmentsPage` con su ruta. Quitar entradas de sidebar/nav. Borrar los componentes de página muertos en `evaluation-pages.tsx` y `pedagogy-pages.tsx` que pertenezcan al subsistema legacy.
- API: quitar rutas `/subject-assignments` (POST/GET/DELETE) y los endpoints legacy `/evaluaciones` + `/notas-trimestrales`. Quitar use-cases CRUD (`CreateSubjectAssignmentUC`, `ListSubjectAssignmentsUC`, `DeleteSubjectAssignmentUC` y los CRUD de Evaluacion/NotaTrimestral), sus DTOs y tests. Actualizar `pedagogy.module.ts` (sin providers colgando).

**OUT (preservar)**
- NO tocar `schema.prisma`: modelos y datos `SubjectAssignment`/`Evaluacion`/`NotaTrimestral` intactos (S3).
- NO remover la entidad de dominio / modelo / acceso raw que usa `generate-boletin.use-case.ts` (`subjectAssignment.findMany({ include:{ teacher } })`) — migración es S2.
- NO tocar `Teacher`, `/teachers`, MesaExamen/ActaExamen.
- NO remover ninguna página/ruta del NUEVO grading.

## Approach

Borrado de presentación + aplicación EN CONJUNTO (clean-arch), dominio intacto. La eliminación es quirúrgica, NO por módulo: `pedagogy.controller`/`pedagogy.module` mezclan use-cases legacy (subject-assignment) con NUEVOS (competency) — se quitan solo los legacy y se actualizan providers DI. Auto-chain: cabe en un solo PR (~300-400 líneas de borrado: UI + rutas + CRUD).

## Impact

- Bundle web más liviano; API sin endpoints muertos. Cero cambio de datos. DI de Nest queda consistente.

## Risks

- **R1 (#1, CRÍTICO de alcance):** `evaluation-pages.tsx` exporta 4 páginas (EvaluacionesPage, NotasPage, PeriodosPage, NotasTrimestralesPage). Las 4 consumen endpoints legacy (`/subject-assignments`, `/evaluaciones`, `/notas`, `/periodos`, `/notas-trimestrales`), PERO `/periodos` podría ser compartido con el nuevo grading. El **límite exacto keep-vs-remove se VERIFICA en design** leyendo la fuente de datos de cada página. Borrar una página del nuevo grading es una regresión.
- **R2:** dejar un endpoint/use-case legacy a medio borrar rompe DI de Nest → typecheck/build deben quedar limpios.
- **R3:** imports/refs colgando tras el borrado.

## Out-of-scope / Deferred
- **S2:** migrar lookup de docente del boletín (DocenteXCiclo → User), retirar dominio `SubjectAssignment`.
- **S3:** archivar Evaluacion/NotaTrimestral + drop de schema (con backup).
- **Teacher track:** decisiones #2/#3 abiertas (MesaExamen/ActaExamen, página `/teachers`).

## Strict TDD (aceptación)
Cambio mayormente de DELECIÓN: borrar tests del código borrado; tests restantes verdes; typecheck limpio; `vite build` + `pnpm build` pasan; sin imports/refs muertas.
