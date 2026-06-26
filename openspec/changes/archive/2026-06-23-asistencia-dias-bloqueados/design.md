# Design — asistencia-dias-bloqueados

> HOW arquitectónico del change. Decisiones ya tomadas en proposal (ADR-1..4) y fijadas
> por el orquestador: enfoque **stored + lock + guard**; re-generación = **upsert/merge**
> sin pisar días hábiles; **el combo solo lista assignable**; **el calendario es la autoridad**
> del guard. Acá no se re-discuten; se especifican.

## 0. Principio rector: stored vs calendario (consistencia, punto #6)

Hay DOS fuentes de información sobre un día:

- **Calendario (domain util)** — verdad derivada y determinística: `dayOfWeek`, `daysInMonth`.
- **Stored (`days` JSONB)** — proyección persistida para **display**: SAB/DOM/X precargados.

Regla de autoridad, sin ambigüedad:

| Propósito | Autoridad | Por qué |
|---|---|---|
| **Bloquear edición en backend (guard)** | **Calendario** | No depende de que el dato se haya precargado; cubre filas legacy generadas antes del feature. |
| **Mostrar la celda bloqueada en el grid** | **Stored** (`days[d]` con código `assignable=false`) | El front NO recalcula calendario para lockear (ADR-1); usa el dato precargado. Fallback de seguridad: `d > daysInMonth`. |
| **Pre-cargar el dato** | **Calendario** (en `generateMany`) | Se computa una vez por mes y se mergea. |

Qué pasa si stored difiere del calendario (ej. fila legacy con `days[6]="P"` un sábado):
**el guard rechaza igual** (calendario manda), y el `generateMany` con merge **sobrescribe esa clave**
con `SAB` porque las claves bloqueadas no son días hábiles (ver §3, algoritmo de merge). El stored
nunca puede "habilitar" un día que el calendario considera bloqueado.

---

## 1. Domain — `calendar-utils.ts`

**Archivo nuevo:** `packages/domain/src/asistencia/utils/calendar-utils.ts`
TS puro, **cero dependencias** (solo `Date` nativo). Sin imports de infra, sin Prisma. Cumple clean-arch
(`domain/` no importa nada externo). Es la **única** fuente de lógica de calendario; elimina la
duplicación de `daysInMonth` en 3 archivos (2 use cases + frontend).

### Firmas exactas

```ts
/**
 * Días del mes calendario. `month` es 1-based (Enero=1 .. Diciembre=12).
 * Mantiene la convención YA usada en los use cases: new Date(year, month, 0).
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Día de la semana de (year, month-1based, day). Devuelve 0..6 → 0=Domingo, 6=Sábado.
 * Usa el constructor por COMPONENTES locales (year, monthIndex, day), NUNCA parseo de string,
 * para evitar el bug de timezone (ver nota abajo).
 */
export function dayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

/**
 * Mapa de días bloqueados del mes, listo para mergear en `days` JSONB.
 * Itera d = 1..31 fijo:
 *   - d > daysInMonth(year, month)      → "X"   (día inexistente)
 *   - dayOfWeek === 6 (Sábado)          → "SAB"
 *   - dayOfWeek === 0 (Domingo)         → "DOM"
 *   - resto (día hábil)                 → NO se agrega clave
 * Devuelve solo las claves bloqueadas: { "6":"SAB", "7":"DOM", "29":"X", ... }
 */
export function buildLockedDayMap(year: number, month: number): Record<string, string> {
  const max = daysInMonth(year, month);
  const out: Record<string, string> = {};
  for (let d = 1; d <= 31; d++) {
    if (d > max) { out[String(d)] = 'X'; continue; }
    const dow = dayOfWeek(year, month, d);
    if (dow === 6) out[String(d)] = 'SAB';
    else if (dow === 0) out[String(d)] = 'DOM';
  }
  return out;
}
```

### Nota timezone (obligatoria)

`new Date("2026-02-01")` (parseo de string ISO) se interpreta en **UTC**, y en husos negativos
(Argentina UTC-3) "retrocede" al día anterior → el `getDay()` daría un día equivocado.
La solución es usar SIEMPRE el constructor por componentes `new Date(year, monthIndex, day)`,
que se interpreta en **hora local**. Por eso `dayOfWeek` usa `month - 1` (monthIndex) y nunca strings.

### Códigos emitidos

`SAB`, `DOM`, `X`. Son AttendanceTypes de sistema con `assignable=false` que **ya existen** en el
catálogo y ya se exponen en `toResponse()`. La util NO valida catálogo (es responsabilidad app);
solo emite estos 3 literales.

### Export

```ts
// packages/domain/src/asistencia/index.ts  (agregar)
export { daysInMonth, dayOfWeek, buildLockedDayMap } from './utils/calendar-utils';

// packages/domain/src/index.ts  (agregar junto a los re-exports de asistencia)
export { daysInMonth, dayOfWeek, buildLockedDayMap } from './asistencia';
```

`web` ya declara `"@educandow/domain": "workspace:*"`, así que el frontend puede importar
`daysInMonth` desde el domain y borrar su copia local.

---

## 2. Domain — extensión de los ports `generateMany`

**Archivos:** `asistencia-general-repository.ts`, `asistencia-materia-repository.ts`

Agregar `days?` a cada input. Se decide pasar el mapa **por fila** (no como segundo argumento)
para mantener la firma `generateMany(rows)` estable y porque ya estaba acordado en la exploración.
El use case setea el mismo `lockedMap` en todas las filas (misma referencia, sin costo).

```ts
export interface GenerateGeneralInput {
  courseCycleId: string;
  studentId: string;
  year: number;
  month: number;
  days?: Record<string, string>; // NUEVO: días bloqueados precargados (lockedMap)
}

export interface GenerateMateriaInput {
  materiaXCursoXCicloId: string;
  studentId: string;
  year: number;
  month: number;
  days?: Record<string, string>; // NUEVO
}
```

Actualizar el JSDoc del método: ya no es `createMany + skipDuplicates` puro, sino
**read-merge-write** (ver §3). Reemplaza la semántica que el comentario actual describe.

---

## 3. Infra — nueva semántica de `generateMany` (merge)

**Archivos:** `prisma-asistencia-general.repository.ts`, `prisma-asistencia-materia.repository.ts`
(idéntico algoritmo en ambos, cambia el modelo Prisma y la natural key).

### Decisión: leer existentes + merge en memoria + write transaccional

Se descartan las otras dos opciones planteadas:

- **`upsert` por fila:** Prisma NO sabe hacer deep-merge de JSON en el `update` de un upsert.
  El `update` necesitaría el `days` actual para mergear, que no tiene sin leer antes. Inviable.
- **`createMany skipDuplicates` + `update` ciego posterior:** `createMany` no devuelve los ids ni
  cuáles filas se saltaron, y un `update` no puede mergear JSON sin leer el valor previo. Inviable
  sin una lectura igual.

Por eso: **una lectura** para traer las filas existentes del scope+mes, partición, y escritura.

### Algoritmo exacto

```
generateMany(rows):
  if rows.length === 0: return { created: 0, skipped: 0 }

  // 1) Una sola lectura de existentes del scope+mes (por natural key)
  existing = findMany({ where: { <scopeId>, year, month,
                                 studentId: { in: rows.map(r => r.studentId) } } })
  existingByStudent = Map(studentId -> { id, days })

  // 2) Partición
  toCreate = rows.filter(r => !existingByStudent.has(r.studentId))
  toUpdate = rows.filter(r =>  existingByStudent.has(r.studentId))

  // 3) Escritura transaccional ($transaction)
  await client.$transaction(async (tx) => {
    if (toCreate.length) {
      tx.<model>.createMany({
        data: toCreate.map(r => ({ ...keys, days: r.days ?? {}, updatedAt: new Date() })),
        skipDuplicates: true,   // red de seguridad ante carrera
      })
    }
    for (const r of toUpdate) {
      const cur = existingByStudent.get(r.studentId)
      const merged = mergeLocked(cur.days, r.days)   // ver abajo
      // Solo escribe si cambió, para no tocar filas ya consistentes
      if (changed(cur.days, merged)) {
        tx.<model>.update({ where: { id: cur.id }, data: { days: merged, updatedAt: new Date() } })
      }
    }
  })

  return { created: toCreate.length, skipped: toUpdate.length }
```

### `mergeLocked(existingDays, lockedMap)` — merge exacto

```ts
function mergeLocked(existing: Record<string,string>, locked?: Record<string,string>) {
  // lockedMap SOLO contiene claves de días bloqueados (SAB/DOM/X), nunca hábiles.
  // → { ...existing, ...locked } preserva TODAS las claves hábiles ya registradas
  //   y solo (re)escribe las claves bloqueadas. Las claves bloqueadas "ganan"
  //   sobre dato legacy en esa misma clave (un sábado con "P" legacy pasa a "SAB").
  return { ...existing, ...(locked ?? {}) };
}
```

Esto satisface la regla: **nunca se pisa una clave de día hábil ya seteada**, porque el lockedMap
no tiene claves hábiles. Las claves que sí se sobrescriben son exclusivamente fines de semana / días
inexistentes, donde el calendario es la autoridad.

### Transaccionalidad y performance (N alumnos)

- Costo: **1 read + 1 createMany (nuevos) + K updates (existentes que cambian)**, todo en un
  `$transaction`. Primera generación de un mes: K=0 → solo createMany (igual de barato que hoy).
- Re-generación / backfill legacy: K updates por fila que cambia. Para tamaños reales de curso
  (~20–40 alumnos) es trivial. El `if (changed)` evita writes redundantes en meses ya consistentes.
- Si en el futuro K escala (cientos de filas), la optimización es un `UPDATE ... SET days = days || $locked`
  en SQL crudo (operador `||` de jsonb), pero NO se hace ahora: complejidad innecesaria.
- **Correctitud no depende del merge en existentes:** aunque una fila legacy quede sin precargar,
  el guard (calendario) igual bloquea su edición. El merge en existentes es una mejora de display.

---

## 4. App — `generate-monthly-attendance.use-case.ts`

Construir el `lockedMap` **una sola vez** por invocación (es el mismo para todas las filas del mes)
e inyectarlo en ambos repos.

```ts
import { buildLockedDayMap } from '@educandow/domain';
// ...
const lockedMap = buildLockedDayMap(year, month);   // una vez

const generalRows = enrolled.map((e) => ({
  courseCycleId, studentId: e.studentId, year, month,
  days: lockedMap,            // NUEVO
}));

const subjectRows = alumnosXMateriaLists.flat().map((axm) => ({
  materiaXCursoXCicloId: axm.materiaXCursoXCicloId, studentId: axm.studentId, year, month,
  days: lockedMap,            // NUEVO
}));
```

Sin cambios en la firma del use case ni en su autorización (D3). El resto del flujo (counts) queda igual;
`skipped` ahora significa "ya existía" (sigue siendo correcto para el toast del front).

---

## 5. App — guards en `record-{general,subject}-attendance-day.use-case.ts`

Misma regla en ambos use cases. El **calendario es la autoridad**.

### Regla exacta (orden de chequeos)

La spec **distingue dos clases de rechazo** (no un único error): el problema del **DÍA**
(finde / inexistente → no se puede tomar asistencia ese día → **422**, regla de negocio) vs. el
problema del **CÓDIGO enviado** (statusCode que el cliente no debió mandar → **400**, input inválido).
Por eso son **dos errores de dominio tipados**, no uno (ver ADR-D2).

1. (existe) fila pre-generada → `NotFoundError` (sin cambios).
2. **Input malformado:** `day` entero fuera del rango sintáctico del grid `1..31` →
   `ValidationError` **400** (`VALIDATION_ERROR`). Cubre `day=0`, `day=99`, no-entero.
3. **NUEVO — día inexistente (calendario = autoridad):** si `day > daysInMonth(year, month)`
   (pero ≤ 31) → `DayNotAssignableError` **422** (`DAY_NOT_ASSIGNABLE`). REQ-GUARD-2 pide **422**,
   NO el 400 de rango. No se mira el `days` stored.
4. **NUEVO — fin de semana (calendario = autoridad):** si `dayOfWeek(year, month, day)` ∈
   {0 (DOM), 6 (SAB)} → `DayNotAssignableError` **422** (`DAY_NOT_ASSIGNABLE`). REQ-GUARD-1.
5. (existe) `statusCode` desconocido en catálogo → `ValidationError` **400** (sin cambios).
6. **NUEVO — guard de assignable:** localizar el `AttendanceType` del `statusCode`; si
   `type.assignable === false` → `StatusNotAssignableError` **400** (`STATUS_NOT_ASSIGNABLE`).
   REQ-GUARD-3 pide **400** (input que el combo ni ofrece), NO 422. Impide registrar SAB/DOM/X.

```ts
import {
  dayOfWeek,
  daysInMonth,
  DayNotAssignableError,
  StatusNotAssignableError,
} from '@educandow/domain';
// ...
// 2. input malformado: rango sintáctico del grid (400 VALIDATION_ERROR)
if (!Number.isInteger(day) || day < 1 || day > 31) {
  throw new ValidationError(`day must be an integer between 1 and 31`);
}

// 3. NUEVO: día inexistente en el mes → 422 DAY_NOT_ASSIGNABLE (calendario = autoridad)
const maxDay = daysInMonth(year, month);
if (day > maxDay) {
  throw new DayNotAssignableError(
    `day ${day} does not exist in ${month}/${year} (month has ${maxDay} days)`,
  );
}

// 4. NUEVO: fin de semana → 422 DAY_NOT_ASSIGNABLE
const dow = dayOfWeek(year, month, day);
if (dow === 0 || dow === 6) {
  throw new DayNotAssignableError(
    `day ${day} (${month}/${year}) is a ${dow === 6 ? 'Saturday' : 'Sunday'} and cannot be recorded`,
  );
}

// 5. catálogo (400 VALIDATION_ERROR si desconocido)
const types = await this.attendanceTypeRepo.list();
const type = types.find((t) => t.code.get() === statusCode);
if (!type) throw new ValidationError(`statusCode "${statusCode}" is not a valid AttendanceType code`);

// 6. NUEVO: statusCode no-assignable → 400 STATUS_NOT_ASSIGNABLE
if (!type.assignable) {
  throw new StatusNotAssignableError(`statusCode "${statusCode}" is not assignable`);
}

return this.<repo>.setDay(row.id.get(), day, statusCode);
```

Reemplazar el `daysInMonth` inline local de cada use case por el import del domain (dedup, ADR-4).

### Errores de dominio a crear (DOS, tipados)

Hoy NO existe un error apropiado: `ValidationError` (400) es para input malformado, no para
"regla de negocio que rechaza un input válido". El catálogo ya usa **422** para violaciones de regla
(`PARCIAL_YA_APROBADO`, `INVALID_INTERNAL_STATUS`, etc.). Se crean **dos** errores tipados, uno por
clase de rechazo (consistente con error-handling: errores de dominio tipados mapeados en el boundary):

```ts
// packages/domain/src/asistencia/errors/day-not-assignable-error.ts  (nuevo)
// Problema del DÍA (finde / inexistente) → 422. Regla de negocio.
import { DomainError } from '../../shared/errors/domain-error';
export class DayNotAssignableError extends DomainError {
  constructor(message: string) { super(message, 'DAY_NOT_ASSIGNABLE'); }
}

// packages/domain/src/asistencia/errors/status-not-assignable-error.ts  (nuevo)
// Problema del CÓDIGO enviado (statusCode con assignable=false) → 400. Input inválido.
import { DomainError } from '../../shared/errors/domain-error';
export class StatusNotAssignableError extends DomainError {
  constructor(message: string) { super(message, 'STATUS_NOT_ASSIGNABLE'); }
}
```

Exports: agregar ambos a `asistencia/index.ts` y al root `index.ts`.

### Mapeo HTTP (presentación)

`api/src/presentation/shared/filters/exception.filter.ts` → agregar al `DOMAIN_STATUS`:

```ts
DAY_NOT_ASSIGNABLE: 422,
STATUS_NOT_ASSIGNABLE: 400,
```

**Envelope (REQ-GUARD-7 / AC-19):** la spec exige `{ error: { code, message } }`. El filtro hoy emite
`{ error: { status, message } }` (sin `code`). Para cumplir la spec **sin romper** a los consumidores
actuales que leen `error.status`, se **agrega `code` de forma aditiva** exponiendo `DomainError.code`
(ver ADR-D6):

```ts
// AppExceptionFilter.catch(): capturar el code de los DomainError…
let code: string | undefined;
// } else if (exception instanceof DomainError) {
//   status = DOMAIN_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
//   message = exception.message;
//   code = exception.code;
// }
response.status(status).json({ error: { status, code, message } });
```

Controllers thin, sin cambios: el filtro global mapea el error de dominio. (Nota: el front actual hace
`catch` genérico y muestra toast; el 422/400 cae ahí. Mejora opcional: leer `error.message` para un
mensaje más claro — no requerido por este change.)

---

## 6. Frontend — `web/src/pages/dashboard/asistencia-mensual.tsx`

### a) Interface + combo filtrado por `assignable`

```ts
interface AttendanceTypeItem {
  id: string; code: string; name: string;
  active: boolean;
  assignable: boolean;   // NUEVO (ya viene del backend en toResponse)
}
// combo: solo activos Y assignable
const codes = attendanceTypes.filter((t) => t.active && t.assignable).map((t) => t.code);
```

### b) 31 columnas fijas

```ts
const numDays = daysInMonth(year, month);                 // import desde @educandow/domain
const dayColumns = Array.from({ length: 31 }, (_, i) => i + 1);   // antes: length: numDays
```

### c) Celda: decidir si está bloqueada (stored = autoridad de display)

```ts
const code = row.days[String(d)];
const at = code ? attendanceTypes.find((a) => a.code === code) : undefined;
const isLockedByCode = at?.assignable === false;     // SAB/DOM/X precargados
const isNonExistent  = d > numDays;                  // fallback para filas legacy sin "X" stored
const locked = isLockedByCode || isNonExistent;
```

### d) Render bloqueado (label en vez de select, estilo distinguible)

- `locked === true` → renderizar un `<span data-testid="cell-locked-{studentId}-{d}">` con el `code`
  (o `X`/`—` si vacío), con estilo apagado (fondo gris/rayado, `color: muted`, `cursor: not-allowed`),
  **sin** `<select>` ni `onChange`.
- `locked === false` → el `<select>` actual, sin cambios funcionales.

Definir un `cellLockedStyle` junto a `cellSelectStyle` para mantener coherencia visual con el grid
existente (mismos paddings/bordes, distinto fondo). No se toca la estructura de `<table>`/`<thead>`.

---

## 7. Diagrama de capas y orden de implementación

### Qué archivo toca qué (por capa, clean-arch)

```
domain (no importa nada externo)
 ├─ asistencia/utils/calendar-utils.ts            [NUEVO]  daysInMonth, dayOfWeek, buildLockedDayMap
 ├─ asistencia/errors/day-not-assignable-error.ts     [NUEVO]  DayNotAssignableError (DAY_NOT_ASSIGNABLE → 422)
 ├─ asistencia/errors/status-not-assignable-error.ts  [NUEVO]  StatusNotAssignableError (STATUS_NOT_ASSIGNABLE → 400)
 ├─ asistencia/repositories/asistencia-general-repository.ts   [EDIT] +days? en GenerateGeneralInput
 ├─ asistencia/repositories/asistencia-materia-repository.ts   [EDIT] +days? en GenerateMateriaInput
 ├─ asistencia/index.ts                           [EDIT]  export utils + error
 └─ index.ts                                       [EDIT]  re-export utils + error

application (importa solo domain)
 ├─ asistencia/generate-monthly-attendance.use-case.ts        [EDIT] buildLockedDayMap → days
 ├─ asistencia/record-general-attendance-day.use-case.ts      [EDIT] guard calendario+assignable, dedup daysInMonth
 └─ asistencia/record-subject-attendance-day.use-case.ts      [EDIT] idem

infrastructure (importa domain + application)
 ├─ .../repositories/prisma-asistencia-general.repository.ts  [EDIT] generateMany read-merge-write
 └─ .../repositories/prisma-asistencia-materia.repository.ts  [EDIT] idem

presentation (importa application)
 └─ shared/filters/exception.filter.ts            [EDIT]  DAY_NOT_ASSIGNABLE→422, STATUS_NOT_ASSIGNABLE→400, +code en envelope

web (consume API + @educandow/domain)
 └─ pages/dashboard/asistencia-mensual.tsx        [EDIT]  31 cols, assignable, combo filtrado, celda lock
```

Ningún cambio de schema Prisma (DayMap/JSONB tolera el dato). Sin migración.

### Orden sugerido (TDD, domain-first, de adentro hacia afuera)

1. **Domain util** `calendar-utils.ts` + tests (incluye casos timezone, Feb no bisiesto/bisiesto,
   sábado/domingo, d>max). Export.
2. **Domain errors** `DayNotAssignableError` (422) y `StatusNotAssignableError` (400) + exports.
3. **Domain ports** `+days?` en ambos inputs.
4. **Infra** `generateMany` read-merge-write en ambos repos + tests (merge no pisa hábiles; pisa
   legacy en clave bloqueada; primera generación; re-generación idempotente).
5. **App** `generate-monthly-attendance` (build lockedMap → days) + test.
6. **App** guards en ambos record-day use cases (422 fin de semana, 422 no-assignable, dedup
   daysInMonth) + tests.
7. **Presentation** `DAY_NOT_ASSIGNABLE → 422` y `STATUS_NOT_ASSIGNABLE → 400` en el exception filter
   + agregar `code` al envelope (`{ error: { status, code, message } }`).
8. **Frontend** grid 31 cols + assignable + combo filtrado + celda lock + tests.

Cada paso compila y pasa tests antes del siguiente; los pasos 1–3 desbloquean 4–6; 7 puede ir junto
a 6; 8 es independiente del backend (consume contrato ya existente + el `assignable` ya expuesto).

---

## ADRs (refinan los de la proposal con detalle de diseño)

- **ADR-D1 — Calendario como autoridad del guard, stored como display.** El backend deriva el bloqueo
  de `dayOfWeek`/`daysInMonth`, no del JSONB. El stored solo alimenta el render. Rechazada: confiar en
  `days[d]` stored para el guard (frágil ante filas legacy o data manipulada).
- **ADR-D2 — DOS errores de dominio tipados, alineados a la spec (fuente de verdad).**
  `DayNotAssignableError` (`DAY_NOT_ASSIGNABLE` → **422**) para finde + día inexistente;
  `StatusNotAssignableError` (`STATUS_NOT_ASSIGNABLE` → **400**) para statusCode no-assignable.
  La spec (contrato, RFC 2119) separa el problema del **DÍA** (no se puede tomar asistencia ese día →
  422, regla de negocio, consistente con el catálogo 422) del problema del **CÓDIGO enviado** (input
  que el combo ni ofrece → 400, input inválido). Rechazada: un único `BLOCKED_DAY 422` (mezcla las dos
  semánticas y contradice REQ-GUARD-3, que exige 400 para el code no-assignable). Rechazada: reusar
  `ValidationError 400` para el día inexistente (REQ-GUARD-2 exige 422).
- **ADR-D3 — `generateMany` = read-merge-write transaccional.** Única forma de mergear JSON sin pisar
  hábiles; `upsert` y `createMany+update ciego` no pueden deep-merge en Prisma. Merge = `{...existing, ...locked}`.
  Rechazadas: ver §3.
- **ADR-D4 — `days?` por fila en el input del port.** Mantiene firma `generateMany(rows)` estable.
  Rechazada: segundo parámetro `lockedDays` (cambia firma sin beneficio; el mapa es uniforme igual).
- **ADR-D5 — Front lockea por código stored `assignable=false` (+ fallback `d>numDays`).** No recalcula
  calendario para lockear (ADR-1). Rechazada: recalcular fin de semana en el front (duplica autoridad,
  riesgo de divergencia con backend).
- **ADR-D6 — Envelope: agregar `code` de forma aditiva, no renombrar `status`.** El filtro real hoy
  emite `{ error: { status, message } }`. Para cumplir REQ-GUARD-7 / AC-19 (`{ error: { code, message } }`)
  sin romper a los consumidores actuales que leen `error.status`, se emite `{ error: { status, code, message } }`
  (`code` = `DomainError.code`; ausente para errores no-dominio). Rechazada: renombrar `status` → `code`
  (cambio global fuera de scope que rompe el resto del proyecto y los tests existentes).

## Riesgos / supuestos a validar

- **Catálogo:** se asume que `SAB`, `DOM`, `X` existen como AttendanceTypes de sistema con
  `assignable=false` y `active=true` en todos los niveles que usan asistencia. Si faltara alguno, el
  combo no los listaría (ok) pero el precargado guardaría un código sin entry en catálogo → la celda
  no se lockearía por `isLockedByCode` (sí por `d>numDays` para X). **Validar el seed.**
- **Filas legacy** (meses ya generados antes del feature): el merge en existentes los backfillea solo
  cuando se vuelve a "Generar". Hasta entonces, el grid puede no mostrar SAB/DOM pero el guard igual
  bloquea. Aceptado (display-only).
- **Performance re-generación:** K updates por fila cambiada; trivial a escala de curso. Documentado el
  camino de optimización SQL `jsonb ||` si hiciera falta.
- **Front catch genérico:** los rechazos del guard (422 día / 400 código) caen en el `catch` actual con
  toast genérico; mensaje específico (leer `error.code`/`error.message`) es mejora opcional fuera de scope.
- **Timezone:** mitigado usando constructor por componentes; cubrir con test explícito en CI (que puede
  correr en UTC).
