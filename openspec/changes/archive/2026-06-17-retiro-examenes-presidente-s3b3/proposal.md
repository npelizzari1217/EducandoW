# Proposal: retiro-examenes-presidente-s3b3

> Fase: sdd-propose · Store: hybrid · 2026-06-17
> S3b-3 del retiro de Teacher — desacoplar MesaExamen/ActaExamen.presidenteId de Teacher.

## Intent
S3b-2 eliminó todos los caminos de creación de filas `Teacher`. Las dos FK `presidente_id` (Restrict → `teachers.id`) en `mesas_examen` y `actas_examen` son el ÚLTIMO acoplamiento que ata las mesas/actas de examen a la tabla `Teacher`. Mientras existan, un presidente de mesa exige una fila `Teacher`, contradiciendo el modelo objetivo donde cualquier `User` puede presidir. Este change **cierra el R-GAP de S3b-2**: tras S3b-3, formar una mesa o acta requiere únicamente un `User.id`; ninguna fila `Teacher` es necesaria. Éxito = FKs eliminadas, datos backfilleados a `User.id`, cero cambios de código, suite verde.

## Scope
**In:**
- Schema (`api/prisma_tenant/schema.prisma`): quitar las relaciones `presidente Teacher @relation(... onDelete: Restrict)` de `MesaExamen` y `ActaExamen`; quitar back-relations `mesasExamen`/`actasExamen` de `Teacher`. Conservar columnas `presidenteId String` + índices.
- Migración a mano (1 archivo): backfill `presidente_id = teachers.user_id WHERE user_id IS NOT NULL` (mesas + actas) ANTES del DROP, luego `DROP CONSTRAINT IF EXISTS` de las dos FK. Índices se conservan. Comentario de rollback DDL (solo estructura).
- Specs (texto): `nivel-secundario/spec.md` y `nivel-terciario/spec.md` — `presidenteId` FK→Teacher pasa a `User.id` (AD-6) + nota de vocales.

**Out:**
- Modelo Prisma `Teacher` (tabla queda — aún la usa `SubjectAssignment.teacherId` Cascade hasta S3-pre).
- Lógica de `ActaExamen.vocales` (ya free-form, sin FK).
- Nullability de `presidenteId` (sigue `NOT NULL`).
- Cero cambios domain/app/infra/frontend/DTO/test. `presidenteId` ya es UUID opaco, nunca name-resuelto; `z.string().uuid()` sigue válido para `User.id`. Sin `generator erd`.

## Approach
**Target = User (AD-6 cross-DB, sin FK).** Un presidente es persona/rol legal, no cycle-bounded; backfill = 1 join `Teacher.id → Teacher.userId`. `presidenteId` queda `TEXT NOT NULL` con `User.id`, patrón AD-6 (igual que `Teacher.userId`, `DocenteXCiclo.userId`).
**Huérfanos = Opción B (pragmática).** Teachers con `userId NULL` conservan su `Teacher.id` colgante como UUID dangling — aceptado: cero impacto UX (presidenteId nunca se resuelve a nombre). Deploy directo.

## Impact
- Consumidor de `Teacher` restante tras S3b-3 = **SOLO** `SubjectAssignment.teacherId` (gated por S3-pre / Decision #1).
- Deploy per-tenant vía `migrate-tenants`; backfill-before-drop en una sola migración (sin gap). Pre-deploy: queries de conteo de huérfanos por tenant (informativas, no bloquean).

## Risks
- **R1 (datos):** huérfanos `userId NULL` → UUID colgante. Mitigación: conteo pre-deploy informativo.
- **R2 (orden):** backfill DEBE preceder al DROP en el mismo archivo (secuencial).
- **R3 (latente):** colgantes silenciosos solo problemáticos si se agrega name-display futuro.

## Out-of-scope / Deferred
- Drop de la tabla `Teacher` → S3-pre (tras desacoplar `SubjectAssignment`).
- Limpieza de UUIDs colgantes (Opción A) → no planificada; reabrir solo si surge name-display.

## Delivery
Auto-chain, single PR (~30 líneas: schema + migración + 2 specs).
