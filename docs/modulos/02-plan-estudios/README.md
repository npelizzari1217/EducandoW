# Módulo 02 — Plan de Estudios

> **Orquestador del módulo**: Estructura académica, materias, cursos, correlatividades.
> **Depende de**: Instituciones (01), Subjects (tabla existente).
> **Usado por**: Ciclo Lectivo (03), Niveles (10-13).

## Contexto

- **Tablas propias**: `study_plans`, `study_plan_courses`, `study_plan_subjects`, `correlatives`
- **Reglas que aplican**: R16-R22
- **Base de datos**: Tenant DB

## Modelo de datos reducido

```
study_plans:
  id, name, level, structure_type (HIERARCHICAL|FLAT),
  academic_year, resolution, active

study_plan_courses (solo si HIERARCHICAL):
  id, study_plan_id FK, name, grade, order

study_plan_subjects:
  id, study_plan_id FK, course_id FK? (NULL si FLAT),
  subject_id FK, year, term, hours_per_week, regimen, order

correlatives:
  id, subject_id FK → study_plan_subjects,
  required_id FK → study_plan_subjects,
  requirement_type (CURSADA|FINAL)
```

## Reglas del módulo

| # | Regla |
|---|---|
| R16 | 1 plan = 1 nivel + 1 tipo de estructura |
| R17 | HIERARCHICAL → course_id obligatorio |
| R18 | FLAT → course_id NULL |
| R19 | Subject se crea primero, luego se referencia |
| R20 | Una misma Subject puede estar en varios planes |
| R21 | Correlativas se validan al inscribir |
| R22 | CURSADA = aprobó cursada, FINAL = aprobó final |

## Tareas atómicas

| # | Tarea | Agente | Contexto |
|---|---|---|---|
| 1 | Crear entidades dominio: StudyPlan, StudyPlanCourse, StudyPlanSubject, Correlative | sdd-apply | Solo estas 4 entidades |
| 2 | Crear interfaces de repositorio en domain | sdd-apply | 4 interfaces |
| 3 | Implementar repositorios Prisma | sdd-apply | 4 implementaciones |
| 4 | Crear use cases: CRUD StudyPlan, CRUD Subject | sdd-apply | Create, List, Get, Delete |
| 5 | Crear controller + DTOs + módulo | sdd-apply | Zod validation, RBAC |
| 6 | Tests unitarios de dominio | sdd-apply | 4 entidades |
| 7 | Tests e2e de API | sdd-apply | Endpoints CRUD |

## Contratos de API

```
POST   /v1/study-plans                    → crear plan
GET    /v1/study-plans?level=SECUNDARIO   → listar por nivel
GET    /v1/study-plans/:id                → detalle con cursos y materias
POST   /v1/study-plans/:id/courses        → agregar curso
POST   /v1/study-plans/:id/subjects       → agregar materia al plan
POST   /v1/study-plan-subjects/:id/correlatives → agregar correlativa
DELETE /v1/study-plans/:id                → eliminar
```
