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

## Pipeline SDD completo

> Cada fase es ejecutada por su **sub-agente especializado**.
> El orquestador del módulo coordina el flujo y valida cada salida.

| Fase | Sub-agente | Entrada | Salida | Estado |
|---|---|---|---|---|
| **1. EXPLORE** | `sdd-explore` | Este README | Documento de exploración | 🔲 |
| **2. PROPOSE** | `sdd-propose` | Exploración | Propuesta de cambio | 🔲 |
| **3. SPEC** | `sdd-spec` | Propuesta | Especificaciones (Given/When/Then) | 🔲 |
| **4. DESIGN** | `sdd-design` | Especificaciones | Diseño técnico detallado | 🔲 |
| **5. TASKS** | `sdd-tasks` | Diseño | Lista de tareas atómicas | 🔲 |
| **6. APPLY-PLAN** | `sdd-apply-plan` | Tareas | Plan de implementación | 🔲 |
| **7. APPLY** | `sdd-apply` | Plan | Código implementado (6-8 tareas) | 🔲 |
| **8. VERIFY** | `sdd-verify` | Código + Specs | Tests pasando, coverage ≥80% | 🔲 |
| **9. ARCHIVE** | `sdd-archive` | Todo verificado | Specs sincronizadas, cambio cerrado | 🔲 |

### Para el orquestador del módulo

```bash
# Flujo completo para este módulo:
1. Delegar a sdd-explore  → entiende el contexto del módulo
2. Delegar a sdd-propose  → crea propuesta formal
3. Delegar a sdd-spec     → escribe Given/When/Then
4. Delegar a sdd-design   → diseña la solución técnica
5. Delegar a sdd-tasks    → descompone en tareas atómicas
6. Delegar a sdd-apply-plan → analiza impacto y orden
7. Delegar a sdd-apply    → implementa cada tarea (pueden ser múltiples delegaciones)
8. Delegar a sdd-verify   → corre tests, verifica cobertura
9. Delegar a sdd-archive  → sincroniza specs, cierra el cambio
```

### Tareas atómicas (salida esperada de la fase TASKS)

| # | Tarea | Tipo |
|---|---|---|
| 1 | Crear entidades dominio: StudyPlan, StudyPlanCourse, StudyPlanSubject, Correlative | domain |
| 2 | Crear interfaces de repositorio | domain |
| 3 | Implementar repositorios Prisma | infra |
| 4 | Crear use cases: CRUD StudyPlan, asignar materias, validar correlativas | application |
| 5 | Crear controller + DTOs zod + módulo NestJS | presentation |
| 6 | Precarga de datos de ejemplo (seed) | infra |
| 7 | Tests unitarios de entidades | test |
| 8 | Tests e2e de endpoints | test |

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
