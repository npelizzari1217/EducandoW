# Módulo 13 — Nivel Terciario

> **Orquestador del módulo**: Carreras, correlatividades, actas de examen, títulos.
> **Depende de**: Plan de Estudios (02), Ciclo Lectivo (03), Calificaciones (04), Asistencia (05).
> **Estado**: 🔲 Sin diseñar

## Tablas propias (diseño pendiente)

- `inscripciones_materia`: alumno ↔ materia (con validación de correlativas)
- `actas_examen`: actas formales
- `acta_examen_notas`: notas dentro del acta
- `titulos`: títulos emitidos

## Particularidades del nivel

- Plan de estudios FLAT (materias directas, sin cursos)
- Correlatividades: CURSADA y FINAL
- Régimen: PROMOCIONAL (≥7), REGULAR (≥4), LIBRE (<4)
- Períodos: CURSADA + FINAL + FIRMA_TP
- Actas formales con libro y folio
- Emisión de títulos

## Tareas

| # | Tarea | Agente |
|---|---|---|
| 1 | Diseñar DER detallado del nivel | orquestador |
| 2 | Implementar entidades + repos | sdd-apply |
| 3 | Implementar use cases | sdd-apply |
| 4 | Implementar controller + DTOs | sdd-apply |
| 5 | Tests | sdd-apply |
