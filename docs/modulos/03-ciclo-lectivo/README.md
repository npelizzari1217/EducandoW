# Módulo 03 — Ciclo Lectivo

> **Orquestador del módulo**: Años académicos, períodos, fechas, vinculación con planes de estudio.
> **Depende de**: Plan de Estudios (02). **Usado por**: Calificaciones (04), Asistencia (05), Niveles (10-13).

## Contexto

- **Tablas propias**: `academic_cycles`, `academic_cycle_periods`, `academic_cycle_study_plans`
- **Reglas que aplican**: R32-R39
- **Base de datos**: Tenant DB

## Modelo de datos reducido

```
academic_cycles:
  id, name, level, start_date, end_date, active

academic_cycle_periods:
  id, cycle_id FK, period_type_id FK, period_number,
  start_date, end_date
  UNIQUE(cycle_id, period_type_id, period_number)

academic_cycle_study_plans:  ← JOIN N:M
  id, cycle_id FK, study_plan_id FK
  UNIQUE(cycle_id, study_plan_id)
```

## Reglas del módulo

| # | Regla |
|---|---|
| R32 | 1 ciclo = 1 nivel, con fechas inicio/cierre |
| R33 | Períodos del ciclo tienen fechas reales configurables |
| R34 | N:M entre Cycle y StudyPlan |
| R35 | Al calificar, validar fecha dentro del período activo |
| R36 | Ciclos son anuales, planes trascienden ciclos |
| R37 | Boletín filtra por cycle_id |
| R38 | Progresión alumno: curso X ciclo 2024 → curso Y ciclo 2025 |
| R39 | Enrollment tiene cycle_id FK |

## Tareas atómicas

| # | Tarea | Agente |
|---|---|---|
| 1 | Crear entidades: AcademicCycle, AcademicCyclePeriod | sdd-apply |
| 2 | Repositorios + Prisma | sdd-apply |
| 3 | Use cases: CRUD ciclo, CRUD períodos, vincular plan | sdd-apply |
| 4 | Controller + DTOs + módulo | sdd-apply |
| 5 | Actualizar Enrollment (agregar cycle_id FK) | sdd-apply |
| 6 | Tests | sdd-apply |

## Contratos de API

```
POST   /v1/academic-cycles                     → crear ciclo
GET    /v1/academic-cycles?level=SECUNDARIO    → listar
GET    /v1/academic-cycles/:id                 → detalle con períodos
POST   /v1/academic-cycles/:id/periods         → agregar período
POST   /v1/academic-cycles/:id/study-plans     → vincular plan
GET    /v1/students/:id/history                → progresión por ciclos
```
