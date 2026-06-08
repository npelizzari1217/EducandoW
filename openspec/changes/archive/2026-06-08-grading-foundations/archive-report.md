# Archive Report: grading-foundations (Fase 1 del épico de calificación por competencias)

**Status**: ARCHIVED / CLOSED
**Date**: 2026-06-08
**Verdict**: PASS (1a y 1b verificadas; warnings/sugerencias cerrados)

---

## Alcance

Fase 1 (fundacional) del épico de calificación por competencias. Construye las dos bases sobre las que se apoyan las fases 2-5: **escalas de notas configurables** y **períodos de calificación configurables**, ambas por institución+nivel+modalidad, en la tenant DB. Rediseño limpio (sin datos productivos en juego).

## Entregado en dos sub-entregas

### 1a — Escalas de Notas
- `GradeScale` (level+modality+name) + `GradeScaleValue` (code alfanumérico libre, label, sortOrder, `internalStatus`).
- enum `GradeInternalStatus { APROBADO, NO_APROBADO, EN_PROCESO, LIBRE }` reemplaza el `isApproved` booleano. Se eliminaron `minValue/maxValue/isConceptual/numericValue`.
- Dominio (packages/domain/src/grading/) + use cases + `PrismaGradeScaleRepository` + `GradingScalesController` + DTOs + `GradingModule` + permiso `GRADING_CONFIG` (seed).
- Migración tenant de reemplazo limpio (nulifica `Nota.gradeScaleValueId`, trunca, preserva FK + snapshots).
- Front `web/src/pages/dashboard/grading-scales.tsx` (selector de institución ROOT, por nivel+modalidad).

### 1b — Períodos de Calificación
- Modelo de 3 niveles: `GradingPeriodTemplate` (level+modality+name) → `GradingPeriodTemplateItem` (name+sortOrder) → `GradingPeriodDate` (fechas por ciclo lectivo, FK a AcademicCycle.uuid).
- Plantilla reutilizable por nivel+modalidad; las fechas se cargan por ciclo.
- Invariantes: startDate<endDate, dentro del rango del ciclo, SIN solapamiento (permite huecos), validado también contra fechas ya persistidas (cross-batch).
- Dominio + use cases + `PrismaGradingPeriodRepository` + `GradingPeriodsController` + DTOs (ampliando `GradingModule`).
- Front `web/src/pages/dashboard/grading-periods.tsx` + carga de fechas integrada (aditiva) en `academic-cycles.tsx`.
- `AcademicCycle.firstBim..fourthBim` quedan `@deprecated` pero NO se borran (los usa el front actual; se reemplazan funcionalmente en fases 4-5).

## Gates finales
- domain: 788 tests · api: 582 (6 pre-existentes ajenos: postgres-admin×6, ensure-institution-levels) · web: 164 · lint/typecheck: 0 errores.

## Verificación
- 1a: PASS WITH WARNINGS → sugerencia (test de cambio de estado interno) cerrada.
- 1b: PASS WITH WARNINGS → warning (solapamiento cross-batch) y sugerencia (lote vacío) cerrados.
- Warnings no accionables (HTTP 400 en validación DTO, ausencia de tests 403) descartados por ser convención del proyecto.

## Commits (main)
a2b9f8e, f62ddd9, 8d21106, 2b9e727 (1a) · 97948f5 (fix test) · baa4ee9, e1b8179, 9ae8503 (1b) · 544c8ff (fix solapamiento).

## Próximo
Fase 2 — Competencias en la jerarquía Plan→Curso→Materia. Ver plan maestro en engram `sdd/competency-grading/master-plan`.
