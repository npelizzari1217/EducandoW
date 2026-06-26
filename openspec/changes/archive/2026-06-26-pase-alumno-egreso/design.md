# Technical Design — pase-alumno-egreso

> Clean/Hexagonal. Solo schema **tenant**. Marca de egreso por pase (reversible, global al alumno).
> Mirror pattern de referencia: `TogglePrintableUseCase` + slice `AlumnosXCursoXCiclo`.

## 1. Architecture approach

Reusamos el **slice existente** `course-cycle-alumnos` (controller + module ya montados) y el
patrón de mutación puntual ya probado por `printable`: un `PATCH` anidado bajo
`/course-cycles/:ccId/alumnos/:id/...` con guard IDOR en el use-case.

La diferencia estructural clave respecto a `printable`: el dato **no vive en la fila puente**
(`alumnos_x_curso_x_ciclo`) sino en el **agregado `Student`** (`students.fecha_de_pase`). Por eso
la escritura cruza dos agregados dentro de un único use-case orquestador (igual que
`RemoveStudentFromCourseCycleUseCase` ya orquesta `CourseCycleRepository` + `AlumnosXCursoXCicloRepository`):

```
Presentation (controller fino + Zod DTO)
   │  PATCH /course-cycles/:ccId/alumnos/:id/pase  { fechaDePase: "YYYY-MM-DD" | null }
   ▼
Application (RegistrarPaseUseCase)
   ├─ CourseCycleRepository.findByUuid(ccId)            → existe?
   ├─ AlumnosXCursoXCicloRepository.findById(rowId)     → IDOR: pertenece al cc?  → resuelve studentId
   ├─ StudentRepository.findById(studentId)            → carga agregado
   ├─ student.registrarPase(fecha) | student.revertirPase()   ← invariante en el dominio
   └─ StudentRepository.setFechaDePase(studentId, value)       ← persistencia puntual
   ▼
Infrastructure (PrismaStudentRepository.setFechaDePase  +  enrich del JOIN existente)
   ▼
Persistence (tenant: students.fecha_de_pase TIMESTAMPTZ NULL)
```

Regla de dependencias respetada: domain no conoce a nadie; application depende de **puertos**
de domain; infrastructure implementa puertos; presentation sólo orquesta use-cases.

## 2. Resolución de la open question — forma del endpoint

**Decisión: Opción B — `PATCH /course-cycles/:ccId/alumnos/:id/pase`** (`:id` = rowId de inscripción).
Se descarta la Opción A (`PATCH /students/:studentId/pase`).

Comparación:

| Criterio | A `/students/:studentId/pase` | B `/course-cycles/:ccId/alumnos/:id/pase` ✅ |
|---|---|---|
| Consistencia con rutas existentes | Rompe el patrón anidado del slice | Idéntico a `:id/printable` y `:id/cascade` |
| Guard IDOR | Sólo "¿puede editar Student?"; sin scope de contexto | Reusa el guard probado: la fila debe pertenecer al `ccId` (si no → 404) |
| Multitenant | OK vía `TenantContext` | OK vía `TenantContext` |
| Dato que maneja el panel | Tiene `studentId` pero su unidad de trabajo es `rowId` | El panel ya opera con `rowId` para DELETE/printable/cascade |
| Acoplamiento UI→backend | UI debería mandar `studentId` | UI manda lo que ya tiene (`rowId`) |

Por qué B aunque el efecto sea **global** al `Student`: la acción se **inicia desde el contexto
del curso/ciclo** (es ahí donde el administrativo ve al alumno y decide el pase). El guard IDOR
nos da una verificación barata y consistente (la fila existe y es de ESTE ciclo) antes de tocar el
agregado global. El use-case resuelve `studentId` desde la fila, así la UI nunca elige a quién
marca por `studentId` directo (defensa contra IDOR por id de alumno arbitrario).

> Nota de semántica documentada: la ruta vive bajo `course-cycles` pero el efecto es global al
> alumno (aparece tachado en TODOS sus cursos). Es una decisión consciente de pragmatismo +
> consistencia; queda registrada para que nadie la lea como "pase por ciclo".

### Contrato del endpoint

```
PATCH /course-cycles/:ccId/alumnos/:id/pase
Guards: AuthGuard, RolesGuard  → @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
HttpCode: 204 No Content

Request body (Zod):
  RegistrarPaseSchema = z.object({
    fechaDePase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD').nullable(),
  })
  // Registrar pase: { "fechaDePase": "2026-06-25" }
  // Revertir pase:  { "fechaDePase": null }

Respuestas:
  204 No Content  → ok (registrado o revertido)
  400 Bad Request → body inválido (Zod) | fecha futura (invariante de dominio, code PASE_FECHA_INVALIDA)
  404 Not Found   → cc inexistente | fila inexistente o de otro ciclo (IDOR, code NOT_FOUND)
  401/403         → auth/roles
```

**Por qué `regex(YYYY-MM-DD)` y no `z.string().datetime()`**: el modal usa `<input type="date">`
nativo (no hay date-picker compartido), que emite `"YYYY-MM-DD"`, NO un ISO datetime completo.
`z.string().datetime()` rechazaría ese valor. Se valida con regex (version-agnostic frente a la
versión de Zod) y el use-case construye `new Date(`${fechaDePase}T00:00:00.000Z`)`. La ruta de
reversión usa `null` por el mismo endpoint (un solo PATCH set+clear, igual que `printable` toma un
`value`).

## 3. Capa por capa — archivos y cambios

### 3.1 Persistence (Prisma · tenant · migración aditiva)

- **Modify** `api/prisma_tenant/schema.prisma` — model `Student` (`@@map("students")`), agregar:
  ```prisma
  fechaDePase DateTime? @db.Timestamptz(6) @map("fecha_de_pase")
  ```
  Nullable, sin default. Prisma property `fechaDePase` (camelCase como el resto del modelo),
  columna `fecha_de_pase`, tipo `TIMESTAMPTZ(6)`.
- **Create** `api/prisma_tenant/migrations/<TS>_add_fecha_de_pase_to_student/migration.sql`
  (generada por `pnpm --filter api prisma:migrate:tenant`, **nunca a mano**). SQL esperado:
  ```sql
  ALTER TABLE "students" ADD COLUMN "fecha_de_pase" TIMESTAMPTZ(6);
  -- Rollback: ALTER TABLE "students" DROP COLUMN "fecha_de_pase";
  ```
  Patrón ADD COLUMN nullable a la `20260620150000_boletin_printable_migration`. Aditiva → sin backfill.
- **Regen** clientes: `pnpm --filter api prisma:generate` (master + tenant).

### 3.2 Domain (`packages/domain`)

- **Modify** `src/personnel/entities/student.ts`:
  - `StudentProps` += `fechaDePase?: Date`.
  - getter `get fechaDePase(): Date | undefined`.
  - getter de conveniencia `get tienePase(): boolean { return this.props.fechaDePase != null; }`.
  - método `registrarPase(fecha: Date): void` — invariante: `fecha` MUST NOT ser futura
    (`> new Date()` → `throw new PaseFechaInvalidaError()`); setea `props.fechaDePase = fecha`.
  - método `revertirPase(): void` — setea `props.fechaDePase = undefined`.
  - `create()` y `reconstruct()` propagan `fechaDePase` (en `create` queda `undefined`).
- **Create** `src/shared/errors/pase-fecha-invalida-error.ts` — extiende `DomainError`,
  code `PASE_FECHA_INVALIDA` → 400 (registrar en `DOMAIN_STATUS` del filter).
- **Create** `src/shared/errors/student-has-pase-error.ts` — extiende `DomainError`,
  code `STUDENT_HAS_PASE` → **409** (defensa de "Quitar", ver 3.3); mensaje
  "No se puede quitar un alumno con pase registrado; revertí el pase primero".
- **Modify** `src/personnel/repositories/student-repository.ts` (puerto):
  ```ts
  setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void>;
  ```
  Mutación puntual (mirror de `setPrintable`), no `save()` del agregado completo. Rationale: el
  resto del codebase usa mutaciones focalizadas (`setPrintable`, `setPrintableBulk`); evita reescribir
  todo `Student` y reduce riesgo de clobber. La invariante igual vive en el dominio porque el
  use-case carga el `Student`, llama `registrarPase/revertirPase` y recién persiste el valor resultante.
- **Modify** `src/course-cycle/repositories/alumnos-x-curso-x-ciclo-repository.ts` — interfaz
  `AlumnoCursoCicloEnriched` += `fechaDePase: string | null;` (ISO o null).
- **Barrels**: exportar los dos nuevos errores desde el index de `shared/errors`.

> **Override explícito de la exploración**: el método NO va en `AlumnosXCursoXCicloRepository`
> (la expl. asumía el campo en la inscripción). Va en `StudentRepository`. Beneficio colateral:
> los mocks de `AlumnosXCursoXCicloRepository` NO necesitan método nuevo; sólo los de `StudentRepository`.

### 3.3 Application (`api/src/application/course-cycle`)

- **Create** `registrar-pase.use-case.ts` — `RegistrarPaseUseCase` (mirror de `TogglePrintableUseCase`
  + orquestación de `Remove`):
  ```ts
  execute(input: { courseCycleId: string; id: string; fechaDePase: Date | null }): Promise<void>
  ```
  Flujo:
  1. `ccRepo.findByUuid(courseCycleId)` → `NotFoundError('CourseCycle')` si falta.
  2. `alumnosRepo.findById(id)`; si `!row || row.courseCycleId !== courseCycleId` → `NotFoundError` (IDOR).
  3. `studentRepo.findById(row.studentId)` → `NotFoundError('Student')` si falta.
  4. `fechaDePase ? student.registrarPase(fechaDePase) : student.revertirPase()` (invariante en dominio).
  5. `studentRepo.setFechaDePase(student.id.get(), student.fechaDePase ?? null)`.
  - Inyección por constructor: `CourseCycleRepository`, `AlumnosXCursoXCicloRepository`, `StudentRepository`.
- **Modify** `remove-student-from-course-cycle.use-case.ts` — **defensa backend de "Quitar"**
  (decisión 4: defensa en backend, no sólo UI). Antes del `remove`:
  ```ts
  const student = await this.studentRepo.findById(enrollment.studentId);
  if (student?.tienePase) throw new StudentHasPaseError();
  ```
  Requiere inyectar `StudentRepository` en este use-case (hoy sólo tiene `ccRepo` + `alumnosRepo`).
- **Modify** `list-students-by-course-cycle.use-case.ts` — **sin cambios de firma**: ya devuelve
  `AlumnoCursoCicloEnriched[]`, que ahora incluye `fechaDePase` (enriquecido en infra). El use-case
  no toca nada salvo que el tipo se propaga solo.

### 3.4 Infrastructure (`api/src/infrastructure/persistence/prisma/repositories`)

- **Modify** `prisma-student.repository.ts`:
  - implementar `setFechaDePase(studentId, fechaDePase)`:
    ```ts
    await this.client.student.update({ where: { id: studentId }, data: { fechaDePase } });
    ```
  - `toDomain(record)` += `fechaDePase: record.fechaDePase ?? undefined`.
- **Modify** `prisma-alumnos-x-curso-x-ciclo.repository.ts` → `findByCourseCycleEnriched`:
  - en el `student.findMany({ select })` agregar `fechaDePase: true`.
  - en el `studentMap` guardar `fechaDePase`.
  - en la proyección: `fechaDePase: s?.fechaDePase ? s.fechaDePase.toISOString() : null`.
  - el `sort` (apellido+nombre, es-AR) **no cambia** (decisión 5: alumnos con pase quedan en su lugar).
- **Mocks a actualizar** (todos los que implementan `StudentRepository`): sumar `setFechaDePase`.
  Buscar con `rg "implements StudentRepository"` y los object-literal mocks en tests de
  `add-student-to-course-cycle`, `remove-student-from-course-cycle`, etc. (riesgo de compilación, ver §6).

### 3.5 Presentation (`api/src/presentation/course-cycle-alumnos`)

- **Modify** `dto/alumnos-x-curso-x-ciclo.dto.ts`:
  - `RegistrarPaseSchema` + `type RegistrarPaseDto` (ver §2).
  - `interface AlumnoCursoCicloItem` += `fechaDePase: string | null;`.
- **Modify** `alumnos-x-curso-x-ciclo.controller.ts`:
  - nuevo handler `registrarPase` con `@Patch('course-cycles/:ccId/alumnos/:id/pase')`, `@HttpCode(204)`,
    `@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })`, body validado con
    `ZodValidationPipe(RegistrarPaseSchema)`. Convierte string→Date:
    `const fecha = body.fechaDePase ? new Date(`${body.fechaDePase}T00:00:00.000Z`) : null;`
    y llama `registrarPaseUC.execute({ courseCycleId: ccId, id, fechaDePase: fecha })`.
  - **Orden de rutas**: declararla junto a `:id/printable`. No colisiona con la estática
    `/alumnos/printable` (esta es `:id/pase`, no hay `/alumnos/pase` bulk). Igual respetá el orden:
    estáticas antes que `:id/...`.
- **Modify** `alumnos-x-curso-x-ciclo.module.ts`:
  - provider `RegistrarPaseUseCase` vía `useFactory` inyectando
    `[PrismaCourseCycleRepository, PrismaAlumnosXCursoXCicloRepository, 'StudentRepository']`.
  - actualizar el factory de `RemoveStudentFromCourseCycleUseCase` para inyectar también
    `'StudentRepository'` (3er arg). `StudentModule` ya está importado y exporta el token.
- **Modify** `exception.filter.ts` → `DOMAIN_STATUS`: `PASE_FECHA_INVALIDA: 400`, `STUDENT_HAS_PASE: 409`.

### 3.6 Web (`web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`)

- `interface AlumnoCursoCicloItem` (local) += `fechaDePase: string | null;`.
- **Botón "Pase"** por fila, junto a "Asignar materias y competencias" y "Quitar"
  (`variant="action"`, `data-testid={`btn-pase-${alumno.id}`}`). Si `alumno.fechaDePase` está seteada,
  el botón pasa a **"Revertir pase"** (`variant="danger-soft"`, llama `handleRevertirPase`).
- **Modal de fecha** (reusar `<Modal>` de `web/src/components/ui/modal.tsx`):
  - estado local `paseTarget: AlumnoCursoCicloItem | null` + `paseFecha: string` (YYYY-MM-DD).
  - contenido: `<input type="date" data-testid="input-fecha-pase" value={paseFecha} onChange=...>`
    + botón confirmar (deshabilitado si `paseFecha` vacío).
- **Acciones / apiClient**:
  - `handleRegistrarPase(rowId, fecha)` → `apiClient.patch(`/course-cycles/${ccId}/alumnos/${rowId}/pase`, { fechaDePase: fecha })` → cerrar modal → `load()`.
  - `handleRevertirPase(rowId)` → `apiClient.patch(`/course-cycles/${ccId}/alumnos/${rowId}/pase`, { fechaDePase: null })` → `load()`.
  - manejar toast success/error como las acciones existentes.
- **Fila tachada**: cuando `alumno.fechaDePase` → `style={{ textDecoration: 'line-through', opacity: 0.7 }}`
  en el `studentName`. El alumno **sigue en la lista, en su lugar** (sort sin cambios).
- **Columnas nuevas** dentro de la fila (el panel es flex por fila, no `<table>`): dos `<span>`
  — **"Pase"** (badge "Sí" / vacío) y **"Fecha de pase"** (formateada `dd/mm/aaaa` desde el ISO).
- **Deshabilitar "Quitar"**: `disabled={!!alumno.fechaDePase}` + `title="Revertí el pase antes de quitar"`.
  (UI + backend = defensa en profundidad; el backend igual responde 409 `STUDENT_HAS_PASE`.)

## 4. ADRs (decisiones con rationale)

- **ADR-1 — Endpoint Opción B (`/course-cycles/:ccId/alumnos/:id/pase`)**. Rechazada A
  (`/students/:studentId/pase`): rompe consistencia del slice y pierde el guard IDOR barato. Ver §2.
- **ADR-2 — `fecha_de_pase` en `Student` (global)**. Heredada del proposal (override de la expl.,
  que la ponía en la inscripción). El pase es del alumno, agnóstico al curso → tachado en TODOS sus cursos.
- **ADR-3 — Pase reversible vía mismo PATCH set+clear** (`fechaDePase: null`). Rechazado un
  `DELETE` separado: un único endpoint con payload nullable mirror de `printable` es más simple y menos superficie.
- **ADR-4 — Defensa de "Quitar" en backend + UI**. `RemoveStudentFromCourseCycleUseCase` lanza
  `StudentHasPaseError` (409) si el alumno tiene pase. Rechazado "sólo UI": la UI no es frontera de
  seguridad; un DELETE directo no debe borrar el rastro de un alumno con pase.
- **ADR-5 — Puerto `setFechaDePase` en `StudentRepository`, no en `AlumnosXCursoXCicloRepository`**.
  El dato vive en `Student`; además reduce el blast radius de mocks. Mutación puntual (no `save()`)
  por consistencia con `setPrintable`. Invariante de fecha igual en el dominio (`Student.registrarPase`).
- **ADR-6 — DTO acepta `YYYY-MM-DD` (regex), no `datetime()`**. El `<input type="date">` nativo no
  emite ISO completo. El use-case normaliza a `Date` UTC midnight. Rechazado `z.string().datetime()`: rechazaría el valor real del input.
- **ADR-7 — Orden del listado sin cambios**. Los alumnos con pase quedan en su lugar (apellido+nombre),
  sólo tachados. Rechazado "mandar al final": el proposal pide visibilidad en su lugar.

## 5. Data flow (resumen)

1. Admin abre el panel del CC → `GET /course-cycles/:ccId/alumnos` (ahora con `fechaDePase` por fila).
2. Click "Pase" → modal → elige fecha → `PATCH .../:id/pase { fechaDePase }`.
3. Backend: valida cc + IDOR → resuelve `studentId` → `Student.registrarPase` → persiste columna.
4. UI recarga: fila tachada + columnas "Pase=Sí" / "Fecha de pase" + "Quitar" deshabilitado.
5. Reversión: "Revertir pase" → `PATCH .../:id/pase { fechaDePase: null }` → fila vuelve a normal.

## 6. Riesgos / supuestos a validar en tasks

- **Mocks de `StudentRepository`**: agregar `setFechaDePase` a TODOS los mocks/stubs o rompe la
  compilación de tests (TDD estricto). Inventariar con `rg "implements StudentRepository"` + literales.
- **DI de `Remove`**: cambiar su factory en el module suma una dependencia; revisar que ningún otro
  módulo construya `RemoveStudentFromCourseCycleUseCase` con la firma vieja.
- **Invariante "fecha futura"**: decisión por defecto = rechazar futura (400). Si negocio quiere
  permitir pase futuro, relajar `Student.registrarPase`. Confirmar en spec.
- **Timezone**: se normaliza a `YYYY-MMDDT00:00:00.000Z`. Mostrar en UI con `toLocaleDateString('es-AR')`
  puede correr un día por TZ negativa; aceptable para "fecha de pase" (sólo día). Documentar.
- **Token `'StudentRepository'`**: confirmar que `StudentModule` lo exporta (el module doc lo afirma);
  validar en apply.
- **Cobertura ≥80%**: nuevos tests en domain (`Student.registrarPase/revertirPase` + invariante),
  application (`RegistrarPaseUseCase` happy/IDOR/revert, `Remove` con pase → 409) y web (modal, tachado,
  columnas, Quitar deshabilitado, llamadas apiClient).
</content>
</invoke>
