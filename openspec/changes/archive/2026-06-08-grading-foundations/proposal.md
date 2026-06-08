# Propuesta SDD — grading-foundations (Fase 1 de 5)

Épico: calificación por competencias en EducandoW. Esta es la fase FUNDACIONAL. Las fases 2-5 (competencias en jerarquía, instanciación plan→ciclo, libreta de alumnos, UI de carga de notas) dependen de ésta.

## Intent

Hoy la configuración de calificación está fragmentada y hardcodeada: escalas con un `isApproved` booleano insuficiente, y períodos repartidos en slots fijos (`AcademicCycle.firstBim..fourthBim`, `CourseCycle`, strings `1T/2T/3T`, `1C/2C/ANUAL`, `periodActive Int`). No hay forma de que cada institución configure sus propias escalas y períodos por nivel. Sin esta base, las fases siguientes no pueden expresar resultados ni anclar valoraciones a un período real.

Éxito: cada institución puede definir, por nivel, (A) sus escalas de notas con valor alfanumérico libre + estado interno del sistema, y (B) sus períodos de calificación, vía CRUD completo (dominio → API → front), reemplazando limpiamente lo existente.

## Scope

### In-scope
- **A. Escalas configurables (tenant DB)**: por institución + nivel. Cada valor = código alfanumérico libre + etiqueta + estado interno enum fijo (APROBADO / NO_APROBADO / EN_PROCESO / LIBRE). Rediseño limpio de `GradeScale`/`GradeScaleValue` (`isApproved` bool → enum de 4 estados).
- **B. Períodos configurables (tenant DB)**: por nivel. Cada período = nombre, orden, fechas inicio/fin opcionales. Reemplaza/unifica los hardcodes de período.
- Modelo Prisma (tenant) + migración (reemplazo limpio, casi sin datos), dominio (entidades con estado interno), repos, use cases CRUD, controller + DTOs, registro de permisos (módulos nuevos en seed), páginas front (espejo de Instituciones, con selector de institución para ROOT como en attendance-types/academic-cycles), tests strict TDD.

### Out-of-scope (fases posteriores)
- Fase 2: competencias en jerarquía. Fase 3: instanciación plan→ciclo. Fase 4: libreta de alumnos. Fase 5: carga de notas.
- Migración de datos existentes (volumen despreciable).
- Eliminación funcional de los campos de período viejos en modelos que aún los usan (se decide en la fase que los reemplace).

## Approach (alto nivel por capa)
- **Datos**: rediseñar `GradeScale`/`GradeScaleValue` (estado enum); nueva entidad `GradingPeriod` por nivel. Migración de reemplazo.
- **Dominio**: entidades con invariantes (estado interno fijo, orden de período, unicidad por institución+nivel).
- **Aplicación**: use cases CRUD por agregado.
- **API**: controllers + DTOs + permisos nuevos en seed.
- **Front**: dos pantallas de gestión siguiendo el patrón Instituciones + selector de institución ROOT.

## Key Risks
- Rediseño de `GradeScale`/`GradeScaleValue`: `Nota` referencia `GradeScaleValue`; verificar relaciones al cambiar el modelo.
- Obsolescencia de campos de período: `AcademicCycle.firstBim..fourthBim` (schema:123-130), `CourseCycle` (157-165, incl. `activeGradingPeriod`), `MateriaCarrera.periodActive` (299), `CompetencyValuation.periodActive` (331), strings `1T/2T/3T` en Calificacion*. Quedan obsoletos pero NO se eliminan aún → riesgo de doble fuente de verdad.
- Impacto en front existente de competencias/ciclos que leen esos campos.

## Open decisions (diferir a diseño / validar)
1. ¿Escalas por institución+nivel, o también por modalidad? (`GradeScale` actual tiene level+modality).
2. ¿Estados internos fijos (enum) o configurables? (recomendación: fijos).
3. ¿Fechas de período obligatorias u opcionales? ¿Vinculadas a `AcademicCycle` o plantilla por nivel reutilizable?
4. ¿Un permiso combinado `GRADING_CONFIG` o dos separados (`GRADE_SCALES`, `GRADING_PERIODS`)?
5. ¿Cuándo se eliminan los campos de período hardcodeados (esta fase o la que los reemplace funcionalmente)?

## Next recommended
`sdd-spec` y `sdd-design` (pueden correr en paralelo).
