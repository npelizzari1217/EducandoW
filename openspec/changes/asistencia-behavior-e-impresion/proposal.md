# Proposal — asistencia-behavior-e-impresion

## Intención

Dar semántica real al ausentismo y permitir su impresión oficial. Hoy `AttendanceType`
tiene un peso numérico (`absenceValue`) y un flag `assignable`, pero NO tiene un concepto
explícito de "qué significa" cada tipo (ausente justificado, tarde, día no hábil, etc.).
Sin esa clasificación no se pueden calcular totales pedagógicamente correctos ni distinguir
días hábiles, y la grilla mensual no tiene salida imprimible para entregar a Secretaría /
Dirección.

Este cambio introduce el clasificador `behavior` (enum 1-7) sobre `AttendanceType` y, sobre
esa base, una impresión PDF apaisada server-side de la grilla mensual (general por curso y
por materia) con totales ponderados por alumno.

## Problema

- **No hay clasificación semántica.** `absenceValue` es solo un peso; no permite responder
  "¿esto es una tarde justificada o una ausencia injustificada?". Los totales que hoy se
  muestran son conteos/pesos crudos, no las 6 categorías que pide la institución.
- **`assignable` es un flag ad-hoc.** Codifica "no seleccionable en grilla" sin decir por qué.
  No cubre el caso feriado (día no hábil pero SÍ seleccionable).
- **La grilla mensual no se puede imprimir.** No hay documento oficial apaisado con la matriz
  alumnos × días + totales que pueda archivarse o firmarse.
- **La impresión por materia no existe** ni siquiera a nivel de agregación: hoy solo hay
  agregación general histórica en el boletín (`generate-boletin.use-case.ts buildAsistencia`).

## Por qué ahora

Los requisitos están cerrados y validados por el usuario (fuente de verdad: memoria #1655).
La Parte 2 (impresión) DEPENDE de la Parte 1 (behavior), porque los 6 totales y la etiqueta
de días hábiles se derivan del `behavior`. Hacerlas juntas evita una migración doble del
schema y mantener dos modelos mentales del ausentismo en paralelo.

## Éxito (qué significa "listo")

1. Cada `AttendanceType` tiene un `behavior` 1-7 válido; los system (P/SAB/DOM/X) quedan
   mapeados y bloqueados; los custom se crean/editan/borran eligiendo behavior.
2. La grilla mensual filtra los tipos con `behavior 3` (No elegible) del combo de selección,
   reemplazando funcionalmente a `assignable`.
3. Cada módulo de asistencia (general por curso y por materia) tiene botón "Imprimir" que
   descarga un PDF apaisado A4: alumnos × 31 días + 6 columnas de totales ponderados por
   alumno + etiqueta de días hábiles del mes.
4. Todos los totales son SUMAS PONDERADAS por `absenceValue` (no conteos) y cuadran con la
   definición de #1655.

## Alcance

### IN (dentro de este cambio)

**Parte 1 — AttendanceType con `behavior`:**
- Nuevo campo `behavior` (enum 1-7) en `AttendanceType` (tenant, `api/prisma_tenant`).
- Migración que puebla `behavior` en los tipos existentes (mapeo system + política para custom;
  ver Riesgo A).
- CRUD (crear/editar/borrar tipos custom) extendido para gestionar `behavior`; bloqueo real de
  edición/borrado sobre los system (P/SAB/DOM/X) vía `isSystem`.
- Semántica: `behavior 3` (No elegible) reemplaza el uso de `assignable` en el combo de la grilla;
  feriado = tipo custom `behavior 7` seleccionable.
- UI en `web/src/pages/dashboard/attendance-types.tsx` (ya existe) para elegir/mostrar `behavior`.

**Parte 2 — Impresión PDF apaisada (server-side):**
- Endpoint(s) que devuelven PDF apaisado A4 usando el stack de boletines
  (`pdf-generator.service.ts` Puppeteer + Handlebars `html-templates/*.hbs`,
  `reportes.controller.ts`).
- Nueva agregación para la grilla mensual: general por curso Y por materia, con los 6 totales
  ponderados por alumno (TardesJust Σbeh6, TardesInj Σbeh5, TotalTardes Σ5+6, AusJust Σbeh2,
  AusInj Σbeh1, AusTotal Σ1+2) y etiqueta de días hábiles = díasDelMes − (días behavior 3 o 7).
- Botón "Imprimir" en cada módulo de `web/src/pages/dashboard/asistencia-mensual.tsx`.

### OUT (fuera de este cambio)

- Rediseño del cálculo histórico de asistencia del boletín (`buildAsistencia`) — se usa solo
  como referencia, no se toca.
- Impresión client-side (`html2pdf` / `PremiumPrintReport.tsx`) — se descarta explícitamente.
- Reportes agregados institucionales (por nivel, anuales, comparativos) — no pedidos.
- Cambios en la captura diaria de asistencia más allá de filtrar `behavior 3` del combo.
- Eliminación física del campo `assignable` del schema (ver Riesgo A: se decide en design;
  este cambio no garantiza el drop de la columna).

## Partes y dependencia

```
Parte 1 (behavior + CRUD + UI)  →  Parte 2 (agregación + endpoint + template + botones)
```

La Parte 2 no puede empezar hasta que `behavior` exista y esté poblado, porque toda la
agregación y la etiqueta de días hábiles se derivan de él.

## Capacidades afectadas

- **attendance-types** (gestión de tipos de asistencia): nuevo atributo `behavior`, CRUD y
  bloqueo de system. Capacidad modificada.
- **asistencia-mensual** (grilla de carga/visualización): filtrado del combo por `behavior 3`.
  Capacidad modificada.
- **asistencia-reporting / impresión** (NUEVA): agregación + PDF apaisado general y por materia.
  Capacidad nueva, apoyada en la infraestructura de reporting existente (Puppeteer/Handlebars).

## Nivel pedagógico afectado

**ALL** (INICIAL | PRIMARIO | SECUNDARIO | TERCIARIO). El `behavior` y la impresión aplican a
todos los niveles; el seed de tipos system corre por nivel
(`ensure-attendance-types-for-level.use-case.ts`).

## Estrategia de entrega (PRs encadenados / stacked)

Auto-chain, cada PR verde y mergeable de forma independiente:

1. **PR 1 — Base `behavior`**: schema + migración de datos (poblado + mapeo system), Value Object
   / enum en domain, sin cambio de UI. Deja el campo listo y consistente.
2. **PR 2 — CRUD + UI**: use-cases y DTOs de create/update extendidos con `behavior`, bloqueo de
   system, y `attendance-types.tsx`. Incluye el filtrado del combo por `behavior 3` en la grilla.
3. **PR 3 — Agregación + endpoint + template impresión**: nueva agregación general y por materia,
   endpoint(s) PDF apaisado, template Handlebars. Sin botón todavía (probable feature flag / ruta
   directa para test).
4. **PR 4 — Botones front**: botón "Imprimir" en cada módulo de `asistencia-mensual.tsx`,
   cableado a los endpoints del PR 3.

Cada PR con TDD estricto (`pnpm test`, coverage ≥ 80) y Conventional Commits sin Co-Authored-By.

## Rollback plan

- **PR 4 (botones)**: revert del commit de front; los endpoints quedan pero sin entrada de UI.
  Impacto nulo en datos.
- **PR 3 (impresión)**: revert de endpoint/template/agregación. Es aditivo y read-only; no toca
  datos de asistencia. Rollback seguro.
- **PR 2 (CRUD/UI)**: revert del front + use-cases. El combo vuelve a basarse en `assignable`
  (mientras la columna siga viva). Sin pérdida de datos.
- **PR 1 (schema/migración)**: la migración es la parte sensible. Requiere migración de reversa
  que dropee/ignore `behavior` sin borrar filas de `AttendanceType`. **Regla**: la migración de
  Parte 1 NO debe eliminar `assignable` en el mismo PR (así el rollback de PR 2 sigue funcionando);
  cualquier drop de `assignable` va en un PR posterior separado y solo tras confirmar que nada lo
  lee. Backup de la tabla `AttendanceType` por tenant antes de aplicar en prod.

## Riesgos clave (a resolver en design)

**(A) Migración de datos + relación con `assignable`** — CRÍTICO.
- System: P→4 (No considerar ausentismo), SAB/DOM/X→3 (No elegible). Mapeo determinístico, OK.
- Custom existentes: ¿qué `behavior` por defecto? No hay mapeo obvio. Opciones a evaluar en design:
  derivar heurísticamente de `absenceValue`/`assignable` (p.ej. `assignable=false`→3,
  `absenceValue>0`→1, `absenceValue=0`→4), o marcar un default seguro y forzar revisión manual.
  Decisión pedagógica, no solo técnica.
- `assignable`: ¿se deriva de `behavior` (assignable = behavior≠3), se deja como columna muerta,
  o se elimina? Recomendación de scope: derivar/leer de `behavior` en Parte 1, y NO dropear la
  columna en el mismo PR (ver rollback). El drop definitivo, si se hace, es un cambio aparte.

**(B) Derivación de días hábiles** — a resolver en design.
- Dos fuentes de "no hábil": SAB/DOM/X del calendario (`calendar-utils.ts buildLockedDayMap`) y
  feriado marcado día por día en la grilla (tipo `behavior 7`). Hay que definir cómo se combinan
  sin doble conteo: díasDelMes − días con behavior 3 o 7, pero cuidando que un día ya lockeado por
  calendario y además con behavior 3 no se reste dos veces.

**(C) Impresión por materia necesita agregación nueva** — a resolver en design.
- Hoy solo existe agregación general (histórica) en el boletín. La grilla por materia usa
  `asistenciaXMateriaXAlumnoXCursoXCiclo` (days JSON). Hay que construir una agregación mensual
  nueva que resuelva código-de-día → `behavior` → `absenceValue`, tanto para el modelo general
  (`asistenciaXAlumnoXCursoXCiclo`) como para el por-materia. Es la pieza de mayor esfuerzo.
