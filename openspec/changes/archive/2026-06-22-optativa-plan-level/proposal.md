# Proposal: Optativa a nivel plan de estudios

> Follow-up de `optativas-inscripcion` (approach B / C-minimal). Store: hybrid (engram `sdd/optativa-plan-level/proposal`).

## Intent

`optativas-inscripcion` dejó `MateriaXCursoXCiclo.esOptativa` + filtro de cascade + toggle por-CC (PATCH). Hoy el admin marca cada materia optativa CC por CC **después** de materializar — repetitivo para instituciones con muchos CourseCycles. Lo hacemos ahora para que la designación viva en el plan y baje sola a la materialización: cada CC nuevo generado de un plan hereda el flag. Éxito = marcar una materia optativa UNA vez en el plan y que todos los CC futuros nazcan con `esOptativa = true`, sin tocar nada por-CC.

## Scope

### In Scope
- Schema: `StudyPlanSubject.esOptativa Boolean @default(false) @map("es_optativa")` (migración tenant, sin backfill).
- Domain: `StudyPlanCourseDto.subjects[]` + `StudyPlanRepository.addSubject` aceptan `esOptativa?: boolean`.
- Infra: `PrismaStudyPlanRepository.addSubject` (clausula `update:` incluida), `findPlanCourseById`, `findPlanCoursesByPlan`.
- App: `AddSubjectToPlanCourseUC`, `MaterializeMateriasUseCase.PlanSubjectInput`, `GenerateCourseCyclesUseCase` propagan el flag.
- Presentación: `AddSubjectToPlanCourseSchema` + handlers de controller exponen `esOptativa`.
- Web `study-plans`: toggle + badge optativa por materia, con hint "aplica en la próxima generación de CC".

### Out of Scope
- Propagación del flag a CCs ya materializados en re-gen.
- Cascade / inscripción por subconjunto (shipped).
- `SetMateriaEsOptativaUseCase` / PATCH por-CC (shipped, intacto).
- Competencias / boletín, bulk enrollment.

## Approach

Cadena fina de pass-through, sin patrones nuevos:

```
StudyPlanSubject.esOptativa → StudyPlanCourseDto → AddSubjectToPlanCourseUC
  → GenerateCourseCyclesUseCase → MaterializeMateriasUseCase
  → upsertMany({ esOptativa })  ← ya lo acepta
  → MateriaXCursoXCiclo.esOptativa
```

`upsertMany` ya recibe `esOptativa`; el gap es solo aguas arriba. La designación a nivel plan se vuelve el DEFAULT al materializar.

**Nivel pedagógico:** GENÉRICO — todos los niveles que usan planes de estudio + modelo de grupos.

## Decisions

1. **Flag en `StudyPlanSubject`**, `@default(false)`. Sin backfill: las filas existentes quedan obligatorias.
2. **Plan = default; PATCH = override.** El flag del plan define el valor al materializar; el PATCH por-CC sigue siendo la corrección post-generación.
3. **Re-gen ADITIVO, NO actualiza filas existentes (LOCK).** Re-generar un CourseCycle no toca `esOptativa` en `MateriaXCursoXCiclo` ya materializadas. El flag del plan solo afecta materializaciones NUEVAS. Rationale: re-escribir filas existentes pisaría silenciosamente overrides manuales por-CC (PATCH); mantenemos la semántica aditiva ya vigente.
4. **Editar el flag del plan: sin endpoint nuevo.** El re-POST `POST /study-plan-courses/:id/subjects` es upsert; se extiende la clausula `update:` de Prisma para setear `esOptativa`.

## Risks

| Riesgo | Mitigación |
|--------|------------|
| Cadena multi-capa (9 archivos, 1–4 líneas c/u) | PR1 schema+domain+infra+app → PR2 presentación+web; ambos < 400 líneas |
| Admin espera que cambiar el plan re-materialice CCs viejos | Documentar: plan afecta CCs NUEVOS; PATCH por-CC para existentes |
| `hoursPerWeek: 4` hardcodeado en web | Toggle es aditivo al render actual |
