# Módulo 10 — Nivel Inicial

> **Orquestador del módulo**: Salas por edad, informes evolutivos, planificaciones.
> **Depende de**: Plan de Estudios (02), Ciclo Lectivo (03), Calificaciones (04), Asistencia (05).
> **Estado**: 🔲 Sin diseñar

## Tablas propias (diseño pendiente)

- `salas`: grupos por edad (3, 4, 5 años)
- `sala_enrollments`: alumno ↔ sala
- `informes_evolutivos`: informe por alumno/período
- `areas_desarrollo`: áreas evaluadas en el informe
- `planificaciones`: planificación semanal
- `secuencias_didacticas`: secuencias dentro de la planificación

## Particularidades del nivel

- Evaluación CUALITATIVA (no numérica)
- Sin boletín tradicional → Informe Evolutivo
- Áreas: Socio-afectiva, Motriz, Cognitiva, Lenguaje, Creativa
- Valoraciones: DESTACADO, LOGRADO, EN_PROCESO, NO_LOGRADO
- Promoción automática por edad

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
| 1 | Diseñar DER detallado del nivel (salas, informes, planificaciones) | design |
| 2 | Crear entidades dominio: Sala, InformeEvolutivo, AreaDesarrollo, Planificacion, SecuenciaDidactica | domain |
| 3 | Repositorios + Prisma | infra |
| 4 | Use cases: CRUD salas, informes evolutivos, planificaciones | application |
| 5 | Controller + DTOs zod + módulo NestJS | presentation |
| 6 | Tests unitarios + e2e | test |
