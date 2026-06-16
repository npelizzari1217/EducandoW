# Decisiones resueltas (post-propuesta)

Estas decisiones del usuario PREVALECEN sobre cualquier supuesto de las specs/design.

## D1 — cycleId obligatorio: los ingresantes sin ciclo se BORRAN
Al volver `cycleId` obligatorio, los ingresantes EXISTENTES sin ciclo (`cycleId IS NULL`) **se ELIMINAN** (paso de migración/cleanup: `DELETE FROM ingresantes WHERE cycle_id IS NULL`, multi-tenant, idempotente). Es DESTRUCTIVO → backup previo en producción.

## D2 — La validación de secuencia NO es retroactiva
La nueva máquina de estados (forzada en el dominio) valida **solo transiciones nuevas**. NO se valida ni corrige retroactivamente el estado actual de registros existentes (un ingresante que hoy esté en un estado "saltado" queda como está; a partir de ahora sus transiciones siguen las reglas).

## D3 — Selección de nivel por rol (alineado al modelo de 3 puertas)
- **ROOT y ADMIN** (allLevels=true en `resolveAccessScope`): ELIGEN el nivel en un dropdown. ROOT ve todos los niveles; ADMIN ve los niveles de SU institución.
- **Resto de no-ROOT** (DIRECTOR, SECRETARIO, etc.): tienen UN solo nivel = su `userLevels[0].level`. Se propone automáticamente y queda BLOQUEADO (read-only, no modificable). En la institución del usuario, estos roles no tienen múltiples niveles.
- El **dropdown de ciclo lectivo** se filtra por el nivel resultante (elegido para ROOT/ADMIN, bloqueado para el resto). ROOT ve todos los ciclos; los demás, los del nivel correspondiente.

## Reglas de secuencia de estados (confirmar detalle en spec)
- Progresión lineal hacia adelante: INSCRIPTO → PAGO_MATRICULA → ACEPTADO → INGRESO (INGRESO solo vía promote).
- NO se puede saltar etapas ni retroceder.
- NO_INGRESARA: disponible desde cualquier estado NO terminal.
- INGRESO y NO_INGRESARA son TERMINALES (inmutables).
- La API rechaza transiciones inválidas (no solo el UI).

## Endurecimiento
- Promote (ACEPTADO → Student + Enrollment → INGRESO) envuelto en transacción Prisma (tenant) — atómico, sin Student huérfano.
