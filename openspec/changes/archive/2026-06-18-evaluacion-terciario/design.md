# Design: evaluacion-terciario

> Fase: sdd-design · Store: hybrid · 2026-06-18 · Clean Architecture
> Lee: proposal.md, specs/nota-cursada-terciario/spec.md, specs/final-attempts/spec.md
> Decisiones firmes: engram #1158 (AUSENTE consume intento, auto-LIBRE al 3º; #2 ANUAL/1C/2C; #5 confirmación manual; #7 fechas libres)

## 1. Contexto del código actual (grounding)

Verificado leyendo el repo, no inventado:

- **Schema tenant** (`api/prisma_tenant/schema.prisma`):
  - `InscripcionMateria` (línea 1145) tiene `estado String` (`INSCRIPTO|CURSANDO|REGULAR|APROBADO|LIBRE`), `notaCursada Float?`, `notaFinal Float?`. **NO existe** un campo `condicion` ni el valor `PROMOCIONAL`.
  - `ActaExamen` (1167) es el evento de mesa (materiaCarrera + fecha + tribunal). `ActaExamenNota` (1190) tiene `condicion String`, `@@unique([actaId, studentId])`. **NO existe** `intento`.
- **Dominio** (`packages/domain/src/terciario/`): entidades `ActaExamen` (con `ActaExamenNota` como interface plana), `InscripcionMateria`; VOs `EstadoInscripcion`, `CondicionExamen` (auto-validantes, `create()` lanza `Error` solo en construcción). `@educandow/domain` es zero-deps.
- **Aplicación** (`api/src/application/nivel-terciario/use-cases/`): `RegistrarNotaUC`, `UpdateInscripcionEstadoUC` ya existen y devuelven `Result<T,E>`; `RegistrarNotaUC` ya hace el efecto colateral de marcar `APROBADO`.
- **Errores → HTTP**: `AppExceptionFilter` (`api/src/presentation/shared/filters/exception.filter.ts`) mapea `DomainError.code → status` vía la tabla `DOMAIN_STATUS`. Los controllers hacen `throw result.unwrapErr()` y el filtro traduce. **Para agregar códigos HTTP nuevos solo hay que registrar el `code` en esa tabla.**
- **Transacción atómica multitenant**: YA EXISTE el port `TenantTransactionRunner` (`api/src/application/shared/ports/tenant-transaction-runner`) con impl `PrismaTenantTransactionRunner`. Envuelve un unit-of-work en `client.$transaction` y rebindea el `TenantContext` por AsyncLocalStorage, de modo que los repos internos usan el `tx` de forma transparente. **El auto-LIBRE atómico se resuelve con esta primitiva existente, sin inventar nada nuevo.**

## 2. Arquitectura — enfoque

Clean Architecture estricta, respetando la regla de dependencias `domain → application → infrastructure → presentation`. Patrón por capa idéntico al ya usado en `nivel-terciario`:

- **Dominio (zero-deps)**: entidad `NotaCursadaTerciario` + VOs (`SlotCursadaTerciario`, `CondicionCursada`, `IntentoFinal`); las invariantes y guards de negocio se modelan como **policies puras** que devuelven `Result<_, DomainError>`. Nada de I/O, nada de throw fuera de constructores de VO.
- **Aplicación (NestJS)**: use cases que orquestan repos + policies + `TenantTransactionRunner`, devolviendo `Result<T,E>`. Mapean cada fallo a una subclase de `DomainError` con `code` estable.
- **Infraestructura**: repos Prisma **tenant** (nunca master), nueva tabla + columna, migración con backfill.
- **Presentación**: controllers con `@Roles GRADES` + `@Levels TERCIARIO`, validación Zod, `throw result.unwrapErr()`; el `AppExceptionFilter` traduce a HTTP.

### ADR-1 — `condicion` de la spec MAPEA a `InscripcionMateria.estado` (no se agrega columna nueva)

La spec habla de `InscripcionMateria.condicion ∈ {REGULAR, PROMOCIONAL, LIBRE}`. El modelo real tiene `estado ∈ {INSCRIPTO, CURSANDO, REGULAR, APROBADO, LIBRE}`. `REGULAR` y `LIBRE` ya coinciden; solo falta `PROMOCIONAL`.

**Decisión**: tratar `estado` como el eje canónico de condición de cursada y **extender `EstadoInscripcion` con `PROMOCIONAL`**. Los guards leen `inscripcion.estado`.

- **Rationale**: agregar una columna `condicion` paralela duplica estado con `estado` y abre la puerta a inconsistencias (¿qué manda si `estado=APROBADO` y `condicion=LIBRE`?). Un solo eje = una sola fuente de verdad.
- **Rechazado**: columna `condicion` nueva. Rechazado por duplicación de estado y mayor superficie de migración/sincronización.
- **Consecuencia**: en tasks/apply, donde la spec dice `condicion`, leer/escribir `estado`. El endpoint de confirmación acepta `condicion` en el payload (term de negocio) y lo persiste en `estado`.

### ADR-2 — `intento` vive en `ActaExamenNota`; el contador es DERIVADO, no autoritativo

Confirmado por exploración: `intento` va en `ActaExamenNota` (no en `ActaExamen`, que es un evento compartido por varios alumnos).

**Decisión**: `intento` (1|2|3) es un dato **denormalizado** de la fila (para auditoría/boletín). La VERDAD del límite se calcula contando filas `ActaExamenNota` (join a `ActaExamen` por `materiaCarreraId`) del alumno con `condicion IN (DESAPROBADO, AUSENTE)`. El use case ASIGNA `intento = intentosPrevios + 1` y NO confía en el valor entrante para el conteo.

- **Rationale**: una mesa (`ActaExamen`) agrupa muchos alumnos; el intento es por-alumno-por-materiaCarrera, atravesando varias actas. Un contador en `ActaExamen` sería incorrecto.
- **Rechazado**: confiar en el `intento` que envía el cliente para validar el límite → manipulable y desincronizable. El cliente solo informa, el server cuenta.
- **Nota**: el `@@unique([actaId, studentId])` se mantiene (una nota por alumno por acta). Distintos intentos viven en **distintas actas**.

### ADR-3 — Guards como policies puras de dominio, compuestas en el use case

Cada guard es una función/clase de dominio sin I/O que recibe datos ya cargados y devuelve `Result`:

- `RecuperatorioPolicy.check(slotNuevo, slotsExistentes)` → `PREREQUISITE_SLOT_MISSING` | `PARCIAL_YA_APROBADO` | `SLOT_ALREADY_EXISTS`.
- `FinalEligibilityPolicy.check({ estado, tpSlot, intentosPrevios })` → `ALUMNO_LIBRE_NO_PUEDE_RENDIR` | `CURSADA_NO_CONFIRMADA` | `TP_OBLIGATORIO_FALTANTE` | `MAX_INTENTOS_ALCANZADO`; en éxito devuelve `IntentoFinal` (el nº asignado).
- `FinalEligibilityPolicy.shouldTransitionToLibre(intento, condicion)` → boolean puro.

El use case hace I/O (cargar inscripción, slots, contar intentos), invoca las policies con esos datos, y traduce el `Result` a persistencia. **Composición**: el orden de evaluación de guards es fijo y documentado (ver §5) para que el código de error sea determinista.

- **Rationale**: cumple "business guards en dominio, aplicados en application" del CLAUDE.md; testeable sin DB (cobertura ≥80% en domain barata).

## 3. Modelo de dominio

### 3.1 Entidad `NotaCursadaTerciario` (nueva)

`packages/domain/src/terciario/entities/nota-cursada-terciario.ts`

```
NotaCursadaTerciarioProps {
  id: Id;
  inscripcionMateriaId: string;
  slot: SlotCursadaTerciario;     // VO
  nota?: number;                  // nullable
  condicion: CondicionCursada;    // VO
  fecha?: string;                 // ISO date, nullable (fechas libres, sin GradingPeriodDate)
  creadoAt: Date;
  actualizadoAt: Date;
}
static create(...) / static reconstruct(...)   // patrón idéntico a ActaExamen
```

VOs nuevos (`packages/domain/src/terciario/value-objects/`), auto-validantes igual que `CondicionExamen`:

- `SlotCursadaTerciario`: enum exacto `PARCIAL_1 | PARCIAL_2 | RECUPERATORIO_PARCIAL_1 | RECUPERATORIO_PARCIAL_2 | TP`. Helpers: `esRecuperatorio()`, `parcialBase()` (mapea `RECUPERATORIO_PARCIAL_1 → PARCIAL_1`).
- `CondicionCursada`: enum exacto `APROBADO | DESAPROBADO | AUSENTE`.

> El `condicion` de cursada (slot) y el `CondicionExamen` (final) comparten valores pero son ejes distintos; se mantienen VOs separados para no acoplar semánticas.

### 3.2 Campo `intento` en `ActaExamenNota`

- Dominio: agregar `intento: IntentoFinal` a la interface `ActaExamenNota` y propagarlo en `ActaExamen.registrarNota(...)` y `reconstruct`.
- VO `IntentoFinal` (`packages/domain/src/terciario/value-objects/intento-final.ts`): acepta solo `1|2|3`; `create(n)` inválido lanza en construcción; expone `get()`. El use case usa el código `INVALID_INTENTO` cuando el valor entrante (informativo) está fuera de rango antes de construir.

### 3.3 Extensión `EstadoInscripcion`

Agregar `PROMOCIONAL` a `EstadoInscripcionValue` y a `VALID` (ver ADR-1). Helpers de lectura: `esRegular()`, `esLibre()`, `esPromocional()`, `esConfirmada()` (true si `∈ {REGULAR, PROMOCIONAL, LIBRE, APROBADO}`).

### 3.4 Errores de dominio (nuevas subclases de `DomainError`)

`packages/domain/src/terciario/errors/` — cada una con su `code` (el `AppExceptionFilter` los traduce):

| Error class | code | HTTP |
|---|---|---|
| `SlotAlreadyExistsError` | `SLOT_ALREADY_EXISTS` | 409 |
| `PrerequisiteSlotMissingError` | `PREREQUISITE_SLOT_MISSING` | 422 |
| `ParcialYaAprobadoError` | `PARCIAL_YA_APROBADO` | 422 |
| `InvalidIntentoError` | `INVALID_INTENTO` | 422 |
| `AlumnoLibreNoPuedeRendirError` | `ALUMNO_LIBRE_NO_PUEDE_RENDIR` | 422 |
| `CursadaNoConfirmadaError` | `CURSADA_NO_CONFIRMADA` | 422 |
| `TpObligatorioFaltanteError` | `TP_OBLIGATORIO_FALTANTE` | 422 |
| `MaxIntentosAlcanzadoError` | `MAX_INTENTOS_ALCANZADO` | 422 |
| `CondicionCursadaInvalidaError` | `CONDICION_INVALIDA` | 422 |

**Acción en presentación**: registrar estos 9 `code` en `DOMAIN_STATUS` del `AppExceptionFilter`. (409 para `SLOT_ALREADY_EXISTS`, 422 para el resto.)

## 4. Flujo de datos y use cases (aplicación)

Nuevo módulo de archivos en `api/src/application/nivel-terciario/use-cases/`.

### 4.1 Cursada (Fase A)

`nota-cursada-terciario.use-cases.ts`:

- **`CreateNotaCursadaSlotUC`** — `POST /v1/terciario/cursada/:inscripcionMateriaId/slots`
  1. Cargar slots existentes de la inscripción (`repo.findByInscripcion`).
  2. `RecuperatorioPolicy.check(slotNuevo, existentes)`:
     - si `(inscripcionMateriaId, slot)` ya existe → `SlotAlreadyExistsError` (409).
     - si slot es recuperatorio: exigir parcial base con `condicion ∈ {DESAPROBADO, AUSENTE}`; ausencia → `PrerequisiteSlotMissingError`; parcial base `APROBADO` → `ParcialYaAprobadoError`.
  3. Persistir → 201.
- **`UpdateNotaCursadaSlotUC`** — `PATCH /.../slots/:slot` → 200 (actualiza `nota`/`condicion`/`fecha`).
- **`ListNotaCursadaSlotsUC`** — `GET /.../slots` → 200.
- **`ConfirmarNotaCursadaUC`** — `PATCH /.../confirmar`, payload `{ notaCursada, condicion }` con `condicion ∈ {REGULAR, PROMOCIONAL, LIBRE}`:
  - validar `condicion` contra ese subconjunto (no acepta `APROBADO`/`INSCRIPTO`/etc.) → `CondicionCursadaInvalidaError` (422).
  - escribir `estado` (ADR-1) + `notaCursada` en `InscripcionMateria`. Reusa el patrón de `UpdateInscripcionEstadoUC`. Sin cómputo automático desde slots.

### 4.2 Finales (Fase B)

`acta-examen.use-cases.ts` (extender `RegistrarNotaUC` o crear `RegistrarNotaFinalTerciarioUC`):

`RegistrarNotaFinalUC.execute(actaId, { studentId, nota, condicion, intento })` → `Result<{ libreTransicion: boolean }, DomainError>`:

1. Cargar `acta` (→ `NotFoundError` si no existe) y obtener `materiaCarreraId`.
2. Cargar `inscripcion = inscripcionRepo.findByStudentAndMateria(studentId, materiaCarreraId)`.
3. `intentosPrevios = actaRepo.countIntentosFinal(studentId, materiaCarreraId)` (cuenta `condicion IN (DESAPROBADO, AUSENTE)`).
4. Cargar `tpSlot = notaCursadaRepo.findSlot(inscripcion.id, 'TP')`.
5. Validar `intento` entrante in `[1,3]` → `InvalidIntentoError`.
6. `FinalEligibilityPolicy.check({ estado, tpSlot, intentosPrevios })` (orden §5) → si err, propagar. Si ok, devuelve `IntentoFinal = intentosPrevios + 1`.
7. `condicionFinal = CondicionExamen.create(condicion)`.
8. `transicionar = FinalEligibilityPolicy.shouldTransitionToLibre(intentoAsignado, condicionFinal)`.
9. Persistir (ver §6 transacción): `acta.registrarNota(...)` + si `transicionar`, `inscripcion.updateEstado(LIBRE)`.
10. Devolver `ok({ libreTransicion: transicionar })`.

**PROMOCIONAL bypass [SUPUESTO]** — use case separado `RegistrarPromocionalUC` (`POST /v1/terciario/cursada/:inscripcionMateriaId/promocionar`): exige `estado=PROMOCIONAL`, marca resultado APROBADO en `InscripcionMateria.notaFinal`/`estado=APROBADO` SIN crear `ActaExamenNota` y SIN tocar el contador de intentos. Marcado como supuesto en código (comentario `// [SUPUESTO]`).

### 4.3 Presentación

Extender `acta-examen.controller.ts` y crear `nota-cursada-terciario.controller.ts` (`@Controller('terciario/cursada')`), ambos con `@UseGuards(AuthGuard, RolesGuard, LevelsGuard)`, `@Levels(TERCIARIO)`, `@Roles('ROOT', { module: 'GRADES', ... })`. Schemas Zod nuevos (slot, confirmar, registrar-final con `intento`). La respuesta del 3er intento incluye `{ ..., libreTransicion: true }`.

## 5. Orden determinista de guards del final

Para que el `code` de error sea predecible cuando varios fallan a la vez:

1. `estado` no confirmada (null/INSCRIPTO/CURSANDO) → `CURSADA_NO_CONFIRMADA`
2. `estado = LIBRE` → `ALUMNO_LIBRE_NO_PUEDE_RENDIR`
3. `estado != REGULAR` (y no es flujo PROMOCIONAL) → `ALUMNO_LIBRE_NO_PUEDE_RENDIR`/`CURSADA_NO_CONFIRMADA` según corresponda
4. TP faltante o `TP=AUSENTE` → `TP_OBLIGATORIO_FALTANTE`
5. `intentosPrevios >= 3` → `MAX_INTENTOS_ALCANZADO`
6. OK → asignar `intento = intentosPrevios + 1`

## 6. Cambios de schema Prisma (tenant) + migración

`api/prisma_tenant/schema.prisma` (NUNCA master):

### 6.1 Nueva tabla `nota_cursada_terciario`

```prisma
model NotaCursadaTerciario {
  id                   String   @id @default(uuid())
  inscripcionMateriaId String   @map("inscripcion_materia_id")
  slot                 String                       // SlotCursadaTerciario
  nota                 Float?
  condicion            String                       // CondicionCursada
  fecha                String?                      // ISO date, fechas libres
  inscripcion          InscripcionMateria @relation(fields: [inscripcionMateriaId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")
  @@unique([inscripcionMateriaId, slot])
  @@index([inscripcionMateriaId])
  @@map("nota_cursada_terciario")
}
```
+ relación inversa `notasCursada NotaCursadaTerciario[]` en `InscripcionMateria`.

### 6.2 Columna `intento` en `acta_examen_notas`

```prisma
intento Int @default(1)   // 1|2|3 (validado en dominio)
```

### 6.3 `estado` admite `PROMOCIONAL`

Sigue siendo `String` (no es enum en DB) → sin cambio de columna; solo cambia el set válido en el VO (ADR-1) y se documenta en el comentario del schema.

### 6.4 Migración + backfill idempotente

Una sola migración (`prisma:migrate:tenant`) que:

```sql
-- 1. tabla nueva (CREATE TABLE ...)
-- 2. columna con default → backfilea filas existentes a 1 atómicamente
ALTER TABLE "acta_examen_notas" ADD COLUMN "intento" INTEGER NOT NULL DEFAULT 1;
-- 3. red de seguridad idempotente (no-op si ya está migrado):
UPDATE "acta_examen_notas" SET "intento" = 1 WHERE "intento" IS NULL;
```

- **Idempotencia**: `ADD COLUMN ... DEFAULT 1` ya deja todas las filas preexistentes en `1` en la misma operación. El `UPDATE ... WHERE intento IS NULL` es la red de seguridad exigida por la spec; re-ejecutarlo no modifica filas (constraint NOT NULL ⇒ `WHERE intento IS NULL` matchea 0 filas). Cumple "re-ejecutar no modifica ninguna fila".
- **Scope**: tenant-only. Se aplica por tenant con el runner de migraciones tenant existente.

### 6.5 Transacción atómica auto-LIBRE (REUSO de infra existente)

El use case inyecta el port **`TenantTransactionRunner`** (ya existe) y envuelve el unit-of-work:

```
await runner.run(async () => {
  await actaRepo.saveNota(actaId, studentId, nota, condicion, intento);
  if (transicionar) await inscripcionRepo.save(inscripcion); // estado=LIBRE
});
```

`PrismaTenantTransactionRunner` rebindea el `TenantContext` al `tx`, así que ambos repos escriben dentro del mismo `$transaction`. Si la 2ª escritura falla, la nota NO persiste → cumple "rollback si LIBRE falla → 500". No se inventa primitiva nueva.

### 6.6 Métodos de repositorio nuevos

- `ActaExamenRepository`: `saveNota(..., intento: number)` (extender firma) + `countIntentosFinal(studentId, materiaCarreraId): Promise<number>` (cuenta join acta donde `condicion IN (DESAPROBADO,AUSENTE)`).
- Nuevo `NotaCursadaTerciarioRepository`: `findByInscripcion(id)`, `findSlot(inscripcionId, slot)`, `save(entity)`, `update(entity)`. Impl Prisma tenant en `infrastructure/persistence/prisma/repositories/`.

## 7. Archivos (crear / modificar)

**Crear**
- `packages/domain/src/terciario/entities/nota-cursada-terciario.ts`
- `packages/domain/src/terciario/value-objects/{slot-cursada-terciario,condicion-cursada,intento-final}.ts`
- `packages/domain/src/terciario/errors/*.ts` (9 errores)
- `packages/domain/src/terciario/policies/{recuperatorio-policy,final-eligibility-policy}.ts`
- `packages/domain/src/terciario/repositories/nota-cursada-terciario-repository.ts`
- `api/src/application/nivel-terciario/use-cases/nota-cursada-terciario.use-cases.ts`
- `api/src/infrastructure/persistence/prisma/repositories/prisma-nota-cursada-terciario.repository.ts`
- `api/src/presentation/nivel-terciario/nota-cursada-terciario.controller.ts`
- migración tenant en `api/prisma_tenant/migrations/`
- tests Vitest correspondientes (domain + api), TDD primero.

**Modificar**
- `packages/domain/src/terciario/entities/acta-examen.ts` (+`intento`)
- `packages/domain/src/terciario/value-objects/estado-inscripcion.ts` (+`PROMOCIONAL`)
- `packages/domain/src/terciario/index.ts` (exports)
- `packages/domain/src/terciario/repositories/acta-examen-repository.ts` (+`countIntentosFinal`, firma `saveNota`)
- `api/src/application/nivel-terciario/use-cases/acta-examen.use-cases.ts` (guards + transición)
- `api/src/infrastructure/persistence/prisma/repositories/prisma-acta-examen.repository.ts`
- `api/src/presentation/nivel-terciario/{acta-examen.controller.ts, inscripcion-materia.controller.ts}`
- `api/src/presentation/nivel-terciario/nivel-terciario.module.ts` (providers/controllers + `TenantTransactionRunner`)
- `api/src/presentation/shared/filters/exception.filter.ts` (9 códigos)
- `api/prisma_tenant/schema.prisma`

## 8. Riesgos arquitectónicos

- **R1 — Backfill sobre filas huérfanas/duplicadas**: `ADD COLUMN DEFAULT 1` es seguro ante huérfanas (no requiere join). El `@@unique([actaId,studentId])` ya impide duplicados por acta; el `intento` derivado se calcula a futuro, no se reconstruye en backfill (todas las históricas quedan en `1`, asumiendo 1 intento). **Asunción**: las actas históricas representan a lo sumo 1 intento por alumno/materia. Si hubiera multiplicidad histórica real, el contador derivado podría arrancar desfasado. Validar con el PO antes de apply.
- **R2 — ADR-1 (estado vs condicion)**: si más adelante negocio exige separar "estado administrativo" de "condición pedagógica", habrá que escindir. Hoy un solo eje es correcto y más simple. Documentado para revisión.
- **R3 — Supuestos de producto sin validar** (#1 PROMOCIONAL bypass, #3 TP bloquea, #4 recuperatorio DESAPROBADO+AUSENTE): diseñados como en la spec pero marcados `[SUPUESTO]`. Cambios de reglamento = cambios localizados en las policies puras (bajo costo).
- **R4 — Boletín Terciario sigue roto** (lee `NotaTrimestral`): fuera de scope, lo arregla Fase C. Comunicado en proposal.
- **R5 — Contador derivado vs columna `intento`**: si alguien edita `intento` a mano en DB, la columna y el conteo real pueden divergir. Mitigación: el use case SIEMPRE recomputa; la columna es informativa (ADR-2).

## 9. Cumplimiento de convenciones

- `@educandow/domain` zero-deps ✓ (policies/VOs sin imports de infra).
- `Result<T,E>` sin throw en application ✓; throw solo en constructores de VO ✓.
- Tenant-only Prisma ✓ (master intacto).
- Zod en controllers ✓. Vitest + TDD estricto + cobertura ≥80% en domain/api del código nuevo ✓.
- HTTP codes vía `DomainError.code` + `AppExceptionFilter` (patrón existente) ✓.
