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
| 1 | Diseñar DER detallado del nivel (inscripciones, actas, títulos) | design |
| 2 | Crear entidades: InscripcionMateria, ActaExamen, ActaExamenNota, Titulo | domain |
| 3 | Repositorios + Prisma | infra |
| 4 | Use cases: inscribir con validación de correlativas, actas, emitir título | application |
| 5 | Controller + DTOs + módulo | presentation |
| 6 | Tests unitarios + e2e | test |
