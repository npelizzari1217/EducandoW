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

## Tareas

| # | Tarea | Agente |
|---|---|---|
| 1 | Diseñar DER detallado del nivel | orquestador |
| 2 | Implementar entidades + repos | sdd-apply |
| 3 | Implementar use cases | sdd-apply |
| 4 | Implementar controller + DTOs | sdd-apply |
| 5 | Tests | sdd-apply |
