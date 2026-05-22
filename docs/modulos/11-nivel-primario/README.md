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

## Tareas

| # | Tarea | Agente |
|---|---|---|
| 1 | Diseñar DER detallado del nivel | orquestador |
| 2 | Implementar entidades + repos | sdd-apply |
| 3 | Implementar use cases | sdd-apply |
| 4 | Implementar controller + DTOs | sdd-apply |
| 5 | Tests | sdd-apply |
