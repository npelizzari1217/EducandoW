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

## Tareas

| # | Tarea | Agente |
|---|---|---|
| 1 | Diseñar DER detallado del nivel | orquestador |
| 2 | Implementar entidades + repos | sdd-apply |
| 3 | Implementar use cases | sdd-apply |
| 4 | Implementar controller + DTOs | sdd-apply |
| 5 | Tests | sdd-apply |
