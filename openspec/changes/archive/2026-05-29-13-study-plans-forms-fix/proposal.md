# Proposal: Fix study-plans inline form creation

## Intent
Corregir la creación de materias y cursos en Planes de Estudio. Los formularios inline no funcionaban porque faltaban campos requeridos por la API (`institutionId`, `modality`) y los errores se silenciaban sin feedback.

## Root Cause
1. `POST /subjects` requiere `institutionId` (uuid) — no se enviaba
2. `POST /course-sections` requiere `modality` (number) — no se enviaba
3. Ambos catch blocks eran `catch { /* ignore */ }` — sin feedback al usuario

## Fix
- Agregar `institutionId` al body de `POST /subjects`
- Agregar `modality` e `institutionId` al body de `POST /course-sections`
- Mostrar errores de la API en los formularios inline (estado `courseFormError`, `subjectFormError`)
- Limpiar errores al abrir/cerrar formularios
- Build verificado: 3/3 ✅
