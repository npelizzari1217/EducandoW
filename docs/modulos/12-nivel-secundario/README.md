# Módulo 12 — Nivel Secundario

> **Orquestador del módulo**: Cursos 1° a 6° con orientación, previas, mesas de examen.
> **Depende de**: Plan de Estudios (02), Ciclo Lectivo (03), Calificaciones (04), Asistencia (05).
> **Estado**: 🔲 Sin diseñar

## Tablas propias (diseño pendiente)

- `cursos`: extiende course_sections (1° a 6° + orientación)
- `calificaciones_secundario`: extiende student_grades
- `mesas_examen`: mesas de examen
- `mesa_examen_inscripciones`: alumno ↔ mesa
- `regimen_academico`: reglas por materia

## Particularidades del nivel

- Evaluación NUMÉRICA 1 a 10
- Condición: APROBADO (≥6), PREVIA (<6), LIBRE
- Períodos: 3 trimestres + Diciembre + Febrero
- Mesas de examen para previas
- Orientaciones: Naturales, Sociales, Economía, Arte, etc.

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
| 1 | Diseñar DER detallado del nivel (cursos, previas, mesas) | design |
| 2 | Crear entidades: Curso, CalificacionSecundario, MesaExamen, RegimenAcademico | domain |
| 3 | Repositorios + Prisma | infra |
| 4 | Use cases: CRUD cursos, calificar con previas, mesas, régimen | application |
| 5 | Controller + DTOs + módulo | presentation |
| 6 | Tests unitarios + e2e | test |
