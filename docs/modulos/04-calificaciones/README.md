# Módulo 04 — Calificaciones

> **Orquestador del módulo**: Escalas de nota, períodos de evaluación, calificaciones de alumnos.
> **Depende de**: Plan de Estudios (02), Ciclo Lectivo (03), Subjects (existente).
> **Usado por**: Niveles (10-13).

## Contexto

- **Tablas propias**: `grade_scales`, `grading_period_types`, `subject_grading_configs`, `student_grades`
- **Reglas que aplican**: R23-R31
- **Base de datos**: Tenant DB

## Modelo de datos reducido

```
grade_scales (CATÁLOGO por nivel):
  id, level, value, label, min_numeric, max_numeric,
  is_approved, status_tag, order, requires_recovery

grading_period_types (CATÁLOGO por nivel):
  id, level, code (BIMESTRAL|CUATRIMESTRAL|CURSADA|FINAL|FIRMA_TP|DIC|FEB),
  label, periods_count, order

subject_grading_configs:
  id, subject_id FK, period_type_id FK, grade_scale_level

student_grades (SNAPSHOT inmutable):
  id, student_id FK, subject_id FK, cycle_id FK,
  period_type_id FK, period_number,
  grade_value, grade_label, is_approved, status_tag,
  numeric_value, evaluated_at, evaluated_by
  UNIQUE(student_id, subject_id, cycle_id, period_type_id, period_number)
```

## Reglas del módulo

| # | Regla |
|---|---|
| R23 | GradeScale precargado por nivel, administrable |
| R24 | Materia elige tipo de período |
| R25 | StudentGrade registra nota concreta |
| R26 | status_tag → color (verde/rojo/amarillo) |
| R27 | requires_recovery → habilita recuperatorio |
| R28 | Evolución: ordenar por period_number |
| R29 | Terciario: CURSADA + FINAL + FIRMA_TP |
| R30 | SNAPSHOT: copia datos de GradeScale al guardar |
| R31 | GradeScale = template, StudentGrade = histórico |

## Pipeline SDD completo

| Fase | Sub-agente | Estado |
|---|---|---|
| 1. EXPLORE | `sdd-explore` | 🔲 |
| 2. PROPOSE | `sdd-propose` | 🔲 |
| 3. SPEC | `sdd-spec` | 🔲 |
| 4. DESIGN | `sdd-design` | 🔲 |
| 5. TASKS | `sdd-tasks` | 🔲 |
| 6. APPLY-PLAN | `sdd-apply-plan` | 🔲 |
| 7. APPLY | `sdd-apply` (múltiples) | 🔲 |
| 8. VERIFY | `sdd-verify` | 🔲 |
| 9. ARCHIVE | `sdd-archive` | 🔲 |

## Tareas atómicas (salida de TASKS)

| # | Tarea | Tipo |
|---|---|---|
| 1 | Crear entidades: GradeScale, GradingPeriodType, SubjectGradingConfig, StudentGrade | domain |
| 2 | Repositorios + Prisma | infra |
| 3 | Use cases: CRUD escalas, CRUD períodos, calificar alumno (con snapshot) | application |
| 4 | Controller + DTOs + módulo | presentation |
| 5 | Precarga de escalas por nivel (seed data) | infra |
| 6 | Tests unitarios + e2e | test |

## Contratos de API

```
GET    /v1/grade-scales?level=SECUNDARIO     → escalas disponibles
POST   /v1/grades                            → calificar alumno
GET    /v1/grades?studentId=X&cycleId=Y      → boletín del ciclo
GET    /v1/grades/evolution?studentId=X      → evolución por período
```
