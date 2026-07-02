# Design: Autollenado de "P" en días hábiles al Generar

## Executive Summary

Al Generar la asistencia mensual, todo día HÁBIL VACÍO queda prellenado con el
`AttendanceType` Presente del nivel del curso, en ambos ejes (general y por
materia), sin pisar jamás un valor existente. Se logra con **un helper de
dominio puro** (`fillHabilVacios`) que produce el day-map objetivo, y un cambio
puntual en el merge de infra de "incoming pisa" a **fill-only (existing gana)**,
de modo que re-generar sea idempotente y nunca sobrescriba lo cargado por un
docente.

## Contexto verificado (lo que dice el código real, no el proposal)

Rutas reales confirmadas (el proposal citaba un path inexistente):

- Use-case: `api/src/application/asistencia/generate-monthly-attendance.use-case.ts`
  (NO `.../use-cases/...`). Hoy **throwea** sus errores (`ForbiddenError`,
  `NotFoundError`, `PreviousMonthOpenError`); NO usa `Result`.
- Helper de calendario: `packages/domain/src/asistencia/utils/calendar-utils.ts`
  → `buildLockedDayMap(year, month)` devuelve SOLO keys bloqueadas
  (`SAB`/`DOM`/`X`); los hábiles NO tienen entrada. `daysInMonth(year, month)`
  disponible en el mismo módulo.
- El day-map es `Record<string,string>` (día→código). Hábil vacío = key ausente.

### Descubrimiento crítico #1 — el merge de infra PISA

`generateMany` (general y materia) ya hace read-merge-write, pero el merge es:

```ts
// prisma-asistencia-general.repository.ts (idéntico en materia)
export function mergeLocked(existing, locked) {
  return { ...existing, ...(locked ?? {}) }; // incoming GANA
}
```

Hoy es seguro SOLO porque `locked` nunca trae keys hábiles. Si le pasáramos un
mapa con `"1":"P","2":"P",...` (hábiles llenos), el spread `{...existing,
...incoming}` **sobrescribiría** el `"3":"A"` de un docente con `"P"`. Es la
trampa central del feature: no se puede reusar el merge actual tal cual.

### Descubrimiento crítico #2 — cómo se identifica "Presente"

- `CourseCycle` tiene `level: Int` (schema `prisma_tenant`, línea 327) → el nivel
  se deriva del curso, no hay que pedirlo.
- `AttendanceType` (schema línea 574) tiene columna `isPresent: Boolean`,
  `behavior: AttendanceBehavior`, `isSystem`, `@@unique([level, code])`.
- El seed (`ensure-attendance-types-for-level.use-case.ts`) crea por nivel el
  tipo `code:'P', description:'Presente', isPresent:true, behavior:NO_COMPUTA,
  isSystem:true`. Entre los tipos de sistema (SAB/DOM/P/X) **solo P** tiene
  `isPresent:true` / `behavior:NO_COMPUTA`.
- El port `AttendanceTypeRepository`
  (`packages/domain/src/attendance-type/repositories/attendance-type-repository.ts`)
  **NO** expone hoy un método para resolver el Presente por nivel. Tiene
  `findByLevelCode(level, code)`, `list({level,active,allowedLevels})`,
  `findById`, `existsByLevelCode`. → Resuelve Q1: **hay que agregar el método**.
- La entidad de dominio `AttendanceType` NO expone `isPresent` (solo `code`,
  `behavior`, etc.). El filtro `isPresent`/`behavior` se aplica en la query del
  repo; el use-case usa `presente.code.get()` como código a escribir.

### Descubrimiento crítico #3 — errores y wiring ya existentes

- Hay filtro global `AppExceptionFilter`
  (`api/src/presentation/shared/filters/exception.filter.ts`) que mapea
  `DomainError.code` → HTTP vía `DOMAIN_STATUS` (default 400). El front lee
  `error.response.data.error.code`.
- `PrismaAttendanceTypeRepository` **ya está provisto** en `asistencia.module.ts`
  (lo usa `RecordGeneralAttendanceDayUseCase`). Cablear el generate = agregar el
  repo a su `useFactory`/`inject`. Cambio mínimo.
- El botón "Generar" del front ya está `disabled={... || isMonthClosed}`: la UI
  bloquea generar en mes cerrado; el guard server-side es defensa en profundidad.

## Arquitectura elegida

Capas (Clean Arch, respetando el estándar del proyecto):

```
domain (puro)                 application                       infrastructure
─────────────                 ───────────                       ──────────────
fillHabilVacios(...)  ◄─────  GenerateMonthlyAttendanceUseCase  PrismaAttendance
buildLockedDayMap(...)        ├─ resuelve Presente por nivel ──► TypeRepository
PresenteTypeNotFound          ├─ arma days = fillHabilVacios     .findPresenteByLevel
AttendanceTypeRepo (port)     └─ generateMany(days)  ──────────► Prisma*Asistencia*
  .findPresenteByLevel                                            mergeFillOnly (flip)
```

Flujo de datos por generación:

1. Use-case resuelve el nivel (`cc.level`) y el `AttendanceType` Presente.
2. Construye `lockedMap = buildLockedDayMap(y,m)` (ya existe).
3. `targetDays = fillHabilVacios(lockedMap, presenteCode, y, m)` → locked +
   todos los hábiles = `presenteCode`. Este es el "day-map deseado para una fila
   nueva".
4. Pasa `targetDays` como `days` a `generateMany` (general y materia).
5. Infra: filas nuevas se crean con `targetDays` completo (createMany). Filas
   existentes → merge **fill-only**: `{ ...incoming, ...existing }` → el docente
   gana, los vacíos se rellenan con `P`.

## Componentes

### C1 — Helper de dominio puro `fillHabilVacios`

Ubicación: `packages/domain/src/asistencia/utils/calendar-utils.ts` (junto a
`buildLockedDayMap`; se exporta por el mismo barrel).

Contrato:

```ts
/**
 * Devuelve un NUEVO day-map con `presenteCode` en cada día HÁBIL cuya key esté
 * ausente. Nunca muta el input, nunca pisa una key existente (docente ni locked).
 * Un día es hábil si NO está en buildLockedDayMap (no es SAB/DOM/X).
 */
export function fillHabilVacios(
  days: Record<string, string>,
  presenteCode: string,
  year: number,
  month: number,
): Record<string, string>;
```

Pseudocódigo:

```ts
const locked = buildLockedDayMap(year, month); // SAB/DOM/X (y d>max = X)
const max = daysInMonth(year, month);
const out = { ...days };                        // inmutable: copia
for (let d = 1; d <= max; d++) {
  const key = String(d);
  if (locked[key] !== undefined) continue;      // no hábil → no tocar
  if (out[key] !== undefined) continue;         // ya tiene valor → NUNCA pisar
  out[key] = presenteCode;                       // hábil + vacío → Presente
}
return out;
```

Propiedades: puro, sin I/O, inmutable, determinístico. Idempotente
(`fill(fill(x)) === fill(x)`). Reusa `buildLockedDayMap` como única fuente de
verdad de "qué día es hábil" (no reimplementa la lógica de fin de semana).

### C2 — Puerto: resolución del Presente por nivel

Agregar al port `AttendanceTypeRepository`:

```ts
/**
 * Resuelve el AttendanceType Presente (marcador de asistencia) del nivel.
 * Filtra por el tipo de sistema con isPresent=true (equivalente: behavior
 * NO_COMPUTA + isSystem), activo y no borrado. Devuelve null si el nivel no
 * lo tiene configurado. NO hardcodea el string "P": devuelve el code real.
 */
findPresenteByLevel(level: number): Promise<AttendanceType | null>;
```

Impl en `PrismaAttendanceTypeRepository`:

```ts
async findPresenteByLevel(level: number): Promise<AttendanceType | null> {
  const r = await this.client.attendanceType.findFirst({
    where: { level, isPresent: true, isSystem: true, active: true, deletedAt: null },
    orderBy: { code: 'asc' },
  });
  return r ? this.toDomain(r) : null;
}
```

Decisión de filtro: `isPresent && isSystem` es unívoco (solo el 'P' seeded lo
cumple), evita el falso positivo de un tipo custom `absenceValue=0 && assignable`
al que el `save()` también le pone `isPresent=true`. Ver ADR-2.

### C3 — Error de dominio `PresenteTypeNotFoundError`

Nuevo: `packages/domain/src/attendance-type/errors/presente-type-not-found-error.ts`,
exportado por el barrel de `attendance-type` y por `packages/domain/src/index.ts`.

```ts
export class PresenteTypeNotFoundError extends DomainError {
  constructor(level: number, courseCycleId: string) {
    super(
      `No hay AttendanceType Presente configurado para el nivel ${level} (curso ${courseCycleId})`,
      'PRESENTE_TYPE_NOT_FOUND',
    );
  }
}
```

Registrar en `DOMAIN_STATUS` (exception.filter.ts): `PRESENTE_TYPE_NOT_FOUND: 422`
(config faltante recuperable → Unprocessable, coherente con los otros 422 del
mapa).

### C4 — Cambio en el merge de infra (fill-only)

En `prisma-asistencia-general.repository.ts` y
`prisma-asistencia-materia.repository.ts`, invertir el spread del merge:

```ts
// antes: incoming pisa  →  ahora: existing gana (fill-only)
export function mergeFillOnly(existing, incoming) {
  return { ...incoming, ...existing };
}
```

- Fila nueva: no pasa por merge (createMany usa `r.days` directo = targetDays). OK.
- Fila existente: existing gana → el `"3":"A"` del docente sobrevive; los hábiles
  ausentes se completan desde incoming con `P`; los locked ya presentes se
  preservan y, si faltaran, se agregan. `daysChanged` sigue evitando el UPDATE
  cuando no cambió nada (idempotencia real a nivel DB).

Se puede renombrar `mergeLocked`→`mergeFillOnly` (recomendado por claridad) o
mantener el nombre y sólo invertir el cuerpo + doc. La firma no cambia.

### C5 — Integración en el use-case (ambos ejes, mismo helper)

`GenerateMonthlyAttendanceUseCase`:

1. Constructor: agregar `attendanceTypeRepo: AttendanceTypeRepository` (7º dep).
2. Al leer el CC, incluir `level`: `select: { uuid: true, level: true }`.
3. Firma: `Promise<Result<GenerationResult, PresenteTypeNotFoundError>>` (ver ADR-3).
4. Después del guard de mes previo (paso 2b) y de asegurar el status (2c):
   - **Guard mes cerrado**: si `existingStatus?.isClosed()` → saltear autollenado
     (no escribir days). Devolver `ok({...counts en 0})` o los skipped actuales.
     Reusa el `existingStatus` ya leído en 2c (no query extra).
   - Resolver Presente: `const presente = await attendanceTypeRepo.findPresenteByLevel(cc.level);`
     `if (!presente) return err(new PresenteTypeNotFoundError(cc.level, courseCycleId));`
     (corte ANTES de cualquier escritura → sin escritura parcial).
   - `const presenteCode = presente.code.get();`
5. Reemplazar `days: lockedMap` por
   `days: fillHabilVacios(lockedMap, presenteCode, year, month)` en **ambos**
   armados de filas (`generalRows` y `subjectRows`). El MISMO helper, mismo
   `targetDays` calculado una vez y reutilizado en los dos ejes.
6. Envolver el return exitoso en `ok(...)`.

Los throws legacy (Forbidden/NotFound/PreviousMonthOpen) se mantienen tal cual
(fuera de scope refactorizarlos; ver ADR-3).

### C6 — Controller (presentación desenvuelve el Result)

En `asistencia.controller.ts#generateMonthly`, tras `execute(...)`:

```ts
const result = await this.generateMonthlyUC.execute({...});
if (result.isErr()) throw result.unwrapErr(); // DomainError → AppExceptionFilter → 422
return { data: result.unwrap() };
```

El `try/catch` existente (ForbiddenError→ForbiddenException) se conserva para los
throws legacy. El nuevo `PresenteTypeNotFoundError` viaja por el filtro global
con su `code`, que el front ya sabe leer.

### C7 — Wiring DI

`asistencia.module.ts`: en el provider de `GenerateMonthlyAttendanceUseCase`,
agregar `PrismaAttendanceTypeRepository` al `useFactory` (7º param) y al array
`inject`. El provider ya está registrado en el módulo (no hay que importarlo de
nuevo).

## Frontend

`web/src/pages/dashboard/asistencia-mensual.tsx#handleGenerate`: **sin cambios de
lógica**. El response `GenerationResult` mantiene su shape
(`generalCreated/Skipped`, `materiaCreated/Skipped`); el helper ya recarga la
grilla tras generar (`loadGeneralRows`/`loadSubjectRows`), por lo que las "P"
aparecen solas. Botón ya deshabilitado en mes cerrado.

Ajuste OPCIONAL (no bloqueante): agregar un mensaje de toast específico para el
code `PRESENTE_TYPE_NOT_FOUND` en el `catch` (hoy caería al genérico "Error al
generar la asistencia"). Recomendado por UX, no requerido por la regla central.

## Decisiones (ADR)

### ADR-1 — Merge fill-only en vez de merge locked-wins
- **Decisión**: invertir el spread del merge a `{ ...incoming, ...existing }` y
  pasar `fillHabilVacios(lockedMap, presenteCode)` como `days`.
- **Por qué**: es la única forma de topear hábiles vacíos en filas existentes SIN
  pisar al docente, reusando el mismo camino `generateMany` para nuevo y existente.
- **Rechazado**: (a) componer `fillHabilVacios` DENTRO del merge de infra →
  metería el `presenteCode` (regla de negocio) en infra, viola Clean Arch;
  (b) cargar filas existentes en el use-case y escribir con un método bulk nuevo
  → más queries, más código, duplica la partición create/update que ya hace infra.
- **Tradeoff aceptado**: se pierde la "corrección" de un locked-key ya guardado
  (era efectivamente dead-code: los locked son determinísticos y las celdas
  bloqueadas son read-only en UI). Mitigado con test explícito.

### ADR-2 — Resolver Presente por `isPresent && isSystem`, no por string "P"
- **Decisión**: nuevo `findPresenteByLevel(level)` que filtra
  `isPresent:true, isSystem:true, active, deletedAt:null`.
- **Por qué**: cumple "no string hardcodeado" del proposal y es unívoco. `isPresent`
  solo (sin `isSystem`) es ambiguo porque `save()` lo deriva de
  `absenceValue===0 && assignable` (un tipo custom podría marcarlo).
- **Rechazado**: `findByLevelCode(level,'P')` (hardcodea el string); filtrar solo
  por `behavior=NO_COMPUTA` (un custom NO_COMPUTA rompería la unicidad).

### ADR-3 — `Result` para el error nuevo, throws legacy intactos
- **Decisión**: `execute` pasa a `Promise<Result<GenerationResult,
  PresenteTypeNotFoundError>>`; el controller desenvuelve. Los throws previos se
  mantienen.
- **Por qué**: honra el estándar error-handling (no throw en application para
  fallas esperadas) y el proposal, con blast radius mínimo. "Nivel sin Presente"
  es una falla de config esperada y recuperable → `Result`.
- **Rechazado**: throwear `PresenteTypeNotFoundError` como los hermanos (menos
  churn, consistente con el archivo) — descartado por el estándar explícito;
  se documenta como alternativa por si se prefiere uniformidad total.
- **Nota**: método mixto (Result + throws legacy) es transicional; refactor
  total de los throws queda fuera de scope de este change.

### ADR-4 — Guard de mes CERRADO: saltear autollenado
- **Decisión**: si el status del mes actual está CLOSED, no escribir days
  (saltar create/fill), reusando el `existingStatus` ya leído.
- **Por qué**: grilla de mes cerrado es read-only; evita que un re-generate
  rellene "P" sobre un mes cerrado (caso borde: mes generado con lógica vieja
  —hábiles vacíos— luego cerrado).
- **Rechazado**: throw `MonthClosedError` → la UI ya bloquea el botón; server-side
  preferimos no-op silencioso (idempotente) como dice el proposal ("se omite").

## Impacto en tests (TDD estricto, Vitest, coverage ≥ 80%)

### Dominio (helper puro) — RED primero
- `packages/domain/src/asistencia/utils/__tests__/calendar-utils.spec.ts`
  (extender el existente) o nuevo `fill-habil-vacios.spec.ts`:
  - hábil vacío → `presenteCode`.
  - no pisa `"3":"A"` existente.
  - SAB/DOM/X nunca reciben `presenteCode`.
  - día > daysInMonth nunca se toca.
  - inmutabilidad: el input no se muta (misma referencia inalterada).
  - idempotencia: `fill(fill(x))` === `fill(x)`.
  - febrero bisiesto / no bisiesto (bordes de `daysInMonth`).

### Infra (merge fill-only)
- `.../__tests__/prisma-asistencia-general.repository.spec.ts` y
  `...-materia.repository.spec.ts`:
  - actualizar/añadir tests de `mergeFillOnly`: existing gana sobre incoming;
    hábiles ausentes se completan; locked preservados.
  - `daysChanged` sigue evitando UPDATE en no-op.
  - AJUSTAR tests que hoy asumen "locked corrige existing" (ADR-1 tradeoff).

### Aplicación (use-case) — integración con mocks de repos
- `api/src/application/asistencia/__tests__/generate-monthly-attendance.use-case.test.ts`:
  - grilla nueva → todos los hábiles quedan en el code de Presente (general y materia).
  - grilla existente con valores docentes → solo vacíos reciben Presente; los
    valores previos intactos (no-sobrescritura, AMBOS ejes).
  - nivel sin Presente → `Result.isErr()` con `PresenteTypeNotFoundError`, sin
    ninguna escritura (verificar que `generateMany` no se llamó).
  - mes CERRADO → no autollena (no escribe days).
  - idempotencia: segunda corrida no cambia nada.
  - mock del nuevo `attendanceTypeRepo.findPresenteByLevel`.

### Presentación (opcional)
- `exception.filter.spec.ts`: `PRESENTE_TYPE_NOT_FOUND` → 422 (si se agrega al mapa).
- Controller: desenvuelve `Result.err` → propaga DomainError.

## Archivos afectados

| Archivo | Acción |
|---|---|
| `packages/domain/src/asistencia/utils/calendar-utils.ts` | +`fillHabilVacios` |
| `packages/domain/src/asistencia/utils/__tests__/*.spec.ts` | +tests helper |
| `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts` | +`findPresenteByLevel` |
| `packages/domain/src/attendance-type/errors/presente-type-not-found-error.ts` | nuevo error |
| `packages/domain/src/attendance-type/index.ts` + `packages/domain/src/index.ts` | export error |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-attendance-type.repository.ts` | +impl `findPresenteByLevel` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-general.repository.ts` | merge fill-only |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-asistencia-materia.repository.ts` | merge fill-only |
| `api/src/application/asistencia/generate-monthly-attendance.use-case.ts` | resolver Presente + fill + Result + guard cerrado |
| `api/src/presentation/asistencia/asistencia.controller.ts` | desenvolver Result |
| `api/src/presentation/asistencia/asistencia.module.ts` | inyectar AttendanceTypeRepo en el generate |
| `api/src/presentation/shared/filters/exception.filter.ts` | +`PRESENTE_TYPE_NOT_FOUND: 422` |
| `web/src/pages/dashboard/asistencia-mensual.tsx` | sin cambios (ajuste toast opcional) |
| `**/__tests__` de infra y use-case | tests nuevos/ajustados |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Flip del merge rompe tests que asumían locked-wins | Ajustar esos tests (ADR-1); locked-correction era dead-code |
| Método `execute` mixto Result+throw confunde al caller | Documentado (ADR-3); controller maneja ambos caminos |
| Nivel sin Presente en tenants viejos | Error claro 422, sin escritura parcial |
| `isPresent` ambiguo si algún tenant tiene custom raro | Filtro `isPresent && isSystem` (ADR-2) lo desambigua |
