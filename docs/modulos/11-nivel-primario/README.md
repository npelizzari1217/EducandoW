# Módulo 11 — Nivel Primario

> **Orquestador del módulo**: Grados 1° a 6°, calificaciones numéricas 1-10, boletín trimestral.
> **Depende de**: Plan de Estudios (02), Ciclo Lectivo (03), Calificaciones (04), Asistencia (05).
> **Estado**: 🔲 Sin diseñar

## Tablas propias (diseño pendiente)

- `grados`: extiende course_sections (1° a 6°)
- `calificaciones_primario`: extiende student_grades

## Particularidades del nivel

- Evaluación NUMÉRICA 1 a 10
- Trimestral (3 períodos)
- Concepto: Excelente (9-10), Muy Bueno (7-8), Bueno (6), Regular (4-5), Insuficiente (1-3)
- Aprueba con 6
- Boletín de calificaciones (Template Method ya implementado)

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

## Tareas atómicas (salida estimada de TASKS)

| # | Tarea | Tipo |
|---|---|---|
| 1 | Diseñar DER detallado del nivel | design |
| 2 | Crear entidades: Grado, CalificacionPrimario | domain |
| 3 | Repositorios + Prisma | infra |
| 4 | Use cases: CRUD grados, calificar, generar boletín | application |
| 5 | Controller + DTOs + módulo | presentation |
| 6 | Tests unitarios + e2e | test |
