# Archive Report: competency-hierarchy (Fase 2 del épico de calificación por competencias)

**Status**: ARCHIVED / CLOSED
**Date**: 2026-06-08
**Verdict**: PASS (verify final: 0 CRITICAL, 0 WARNING, 2 SUGGESTION no bloqueantes)

---

## Alcance

Fase 2 (capa de **definición**) del épico de calificación por competencias. Re-conecta las
competencias a la jerarquía real **Plan → Curso → Materia** y repara la UI que estaba rota
en vivo. No toca la capa de instanciación (Fase 3).

## Entregado (4 PRs encadenados + fix-batch)

### PR1 — Domain + Schema + Migration
- `SubjectCompetency` re-anclada: `subjectId` (global Subject) → `studyPlanSubjectId`
  (`StudyPlanSubject`, Plan×Curso×Materia). Unique `(studyPlanSubjectId, name)`,
  FK `onDelete: Cascade`. Campo deprecado `periodActive` eliminado.
- Puertos de repositorio renombrados al lenguaje study-plan-subject
  (`findActiveByStudyPlanSubject`, `findByStudyPlanSubjectAndName`, `findByStudyPlanSubject`).
- `StudyPlanRepository.findStudyPlanSubjectIds(courseSectionId, subjectId)` agregado.
- Migración tenant `20260608151036_competency_scope_remodel`. Marcador Fase-3 en
  `CompetencyValuation.@@unique` para el futuro cambio a `(studentId, competencyId, courseCycleId)`.

### PR2 — Infraestructura + Aplicación + wiring
- Repos Prisma re-cableados a `studyPlanSubjectId`; `findByStudentAndStudyPlanSubject`
  (join de dos pasos).
- `AutoCreateCompetencyValuationsUC` reescrito: navega
  `CourseCycle → StudyPlan → StudyPlanCourse → StudyPlanSubject → SubjectCompetency`
  (antes: match frágil por columnas de `Enrollment`/`CourseSection`).
- `CopySubjectCompetenciesUC` nuevo (idempotente, saltea duplicados).
- Wiring del `PedagogyModule` con Symbol tokens.

### PR3 — Presentación
- `POST /subject-competencies/copy` (declarado ANTES de `/:uuid`).
- DTO de copia + validación HTTP 400.

### Fix-batch (cierre de hallazgos del verify de backend)
- C1: guard de nombre duplicado en `UpdateSubjectCompetencyUC` (idempotente con su propio nombre).
- W1: POST duplicado 409 → 400. W2: PATCH 422 genérico → 400 (duplicado) / 404 (no existe).
- W3: `CreateSubjectAssignmentUC` aísla el fallo de AutoCreate (fire-and-forget). W4: test de aislamiento.

### PR4 — Web
- `PlanCourseSubjectSelector` (cascada Plan→Curso→Materia, vía `GET /study-plans` + `GET /study-plans/:id`).
- `CopyCompetenciesDialog`. `competencies.tsx` reescrito: rutas reales, 2 rutas muertas eliminadas, sin `periodActive`.

## Gates finales
- domain: 792 · api: 617/623 (6 pre-existentes ajenos: postgres-admin ×6, ensure-institution-levels) · web: 176 · build/lint: 0 errores.

## Decisiones clave
- Migración destructiva aprobada por el usuario (tablas casi vacías); resultó CREATE TABLE
  porque las tablas no existían en la DB — outcome idéntico, sin pérdida de datos.
- `StudyPlanSubject` NO es entidad de dominio: se hizo swap de primitivo (string FK), sin entidad/repo nuevos.
- Fuente de datos del drill-down: `GET /study-plans/:id` (trae `subjects[]` inline); backend NO modificado.
- `@Injectable()` en los use cases es la convención REAL del proyecto (los 10 UCs lo usan) — no es hallazgo.

## Specs principales sincronizados
- `openspec/specs/subject-competencies/spec.md` — re-scope a StudyPlanSubject, códigos 400/404, endpoint `/copy`.
- `openspec/specs/competency-valuations/spec.md` — retrieval por `studyPlanSubjectId`, navegación StudyPlan en auto-creación, aislamiento de fallo.

## Commits
PENDIENTE: el working tree tiene los cambios de Fase 2 sin commitear. El commit/push es un
paso aparte que el usuario debe solicitar explícitamente.

## Próximo
Fase 3 — Instanciación plan→ciclo: `CompetencyValuation` gana `courseCycleId`, cambia su UNIQUE,
e integra escalas (valor libre + estado interno). Ver plan maestro en engram `sdd/competency-grading/master-plan`.
