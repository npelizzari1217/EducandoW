# Explore: retiro-examenes-presidente-s3b3

> Fase: sdd-explore · Store: hybrid · 2026-06-17
> S3b-3 del retiro de Teacher — migrar MesaExamen/ActaExamen.presidenteId off Teacher.

## Resumen
Migración mínima: `presidenteId` (FK Restrict → Teacher.id) pasa a guardar **User.id** (ref cross-DB AD-6, sin FK). **CERO cambios de código** — `presidenteId` ya es un UUID opaco, nunca name-resuelto. Solo schema (4 líneas de relación) + migración (backfill + drop FK) + 2 specs (texto). Cierra el R-GAP de S3b-2.

## Schema (confirmado)
- `mesas_examen.presidente_id TEXT NOT NULL`, FK `mesas_examen_presidente_id_fkey` → teachers(id) Restrict, índice `mesas_examen_presidente_id_idx`.
- `actas_examen.presidente_id TEXT NOT NULL`, FK `actas_examen_presidente_id_fkey` → teachers(id) Restrict, índice idem.
- Teacher back-relations (líneas 108-109): `mesasExamen MesaExamen[]`, `actasExamen ActaExamen[]` — quitar.
- `ActaExamen.vocales String[]` — ya es free-form sin FK, NO en scope (solo update de texto del spec).

## Capas (verificado): cero cambios
- Domain (mesa-examen.ts, acta-examen.ts): presidenteId: string opaco, sin validación contra Teacher.
- App (CreateMesaExamenUseCase, CreateActaExamenUC): no inyectan TeacherRepository.
- DTOs: `presidenteId: z.string().uuid()` — sigue válido para User.id.
- Infra (repos): sin `include:{presidente}`.
- Frontend (mesa-examen-form): input de UUID libre; la lista NO muestra presidente. ActaExamen no tiene página web. **El nombre del presidente no se muestra en ningún lado** → sin migración de display.

## Target: User (AD-6) — recomendado
Un presidente es una persona (rol legal), no cycle-bounded. Backfill = 1 join (Teacher.id → Teacher.userId). DocenteXCiclo sería ambiguo (¿qué ciclo?) + 2 joins. presidenteId queda TEXT NOT NULL con User.id, sin FK (patrón AD-6, como Teacher.userId/DocenteXCiclo.userId/StudentGuardian.userId).

## Migración (SQL a mano)
```sql
-- backfill ANTES del drop (mismo archivo, sin gap)
UPDATE mesas_examen me SET presidente_id = t.user_id
  FROM teachers t WHERE me.presidente_id = t.id AND t.user_id IS NOT NULL;
UPDATE actas_examen ae SET presidente_id = t.user_id
  FROM teachers t WHERE ae.presidente_id = t.id AND t.user_id IS NOT NULL;
ALTER TABLE "mesas_examen" DROP CONSTRAINT IF EXISTS "mesas_examen_presidente_id_fkey";
ALTER TABLE "actas_examen" DROP CONSTRAINT IF EXISTS "actas_examen_presidente_id_fkey";
-- índices se conservan (útiles para lookup por User.id)
```
Rollback DDL inline (solo estructura, no data). Pre-deploy: contar huérfanos por tenant.

## DECISIÓN (R1 — huérfanos)
Teachers con userId=NULL → sus filas de examen quedan con Teacher.id colgante tras el drop (sin error, sin UX impact porque no hay name display).
- **Opción A (limpia):** bloquear deploy si hay huérfanos; exigir Teacher.userId poblado primero.
- **Opción B (pragmática, recomendada):** aceptar UUIDs colgantes — cero impacto (presidenteId nunca se resuelve a nombre).

## Cierre del R-GAP
SÍ. Tras S3b-3, presidenteId es TEXT NOT NULL con User.id; cualquier User puede ser presidente; sin Teacher row requerido. Consumidor de Teacher restante: SOLO SubjectAssignment.teacherId (gate S3-pre).

## Riesgos
- R1 (CRÍTICO/datos): huérfanos userId=NULL → UUID colgante. Surface con count pre-deploy.
- R2 (ALTO): backfill DEBE ir antes del DROP en el mismo archivo (orden secuencial).
- R3 (MEDIO): presidenteId queda NOT NULL; colgantes silenciosos (problema solo si se agrega name-display futuro).

## Scope
schema 4 líneas + 1 migración (~25 líneas) + 2 specs texto. Cero domain/app/infra/frontend. Single PR <400. Sin tests nuevos (los existentes ya usan UUID string).

## Decisión requerida: A vs B (huérfanos). Recomendado B. Siguiente: sdd-propose.
