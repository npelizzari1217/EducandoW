# Tasks — tipos-asistencia-nivel-e-impresion

> TDD estricto: `pnpm test` (Vitest), cobertura ≥80%. Cada task de implementación va
> precedida por su test en rojo (RED → GREEN → REFACTOR). Orden test-first respetado.
> Capas: domain → application → infrastructure → presentation → web (Clean/Hexagonal).
> Controllers THIN. Cada task/commit es una unidad reviewable coherente (conventional commits).

## Slicing en PRs encadenados (ver Review Workload Forecast en la respuesta de fase)

- **PR1** — Domain: `baseLevels` (fundación, bloquea todo lo demás)
- **PR2** — Application + presentation: scope de Listar + Crear (REQ-17/REQ-18 originales)
- **PR3** — Application + presentation: scope de Editar/Eliminar/Get-by-id (decisión cerrada en este delta)
- **PR4** — Impresión PDF (use-case + template + endpoint + wiring)
- **PR5** — Web: selector adaptado al scope + botón Imprimir

PR1 → PR2 → PR3 → PR4 → PR5 son **secuenciales entre sí** (cada uno depende del anterior:
PR2-5 necesitan `baseLevels`; PR3 reedita los mismos archivos que PR2; PR4 reusa el mismo
patrón de scope que PR2; PR5 consume el contrato ya estabilizado por PR2-4).
**Dentro de cada PR**, los tasks marcados `[parallel-ok]` pueden ejecutarse en paralelo
(archivos/tests distintos); el resto es secuencial (mismo archivo, requiere el paso anterior en verde).

---

## PR1 — Domain: nivel base (`baseLevels`)

- [x] **T1 (RED)** `packages/domain/src/auth/__tests__/access-scope.test.ts` — agregar casos:
  `compositeLevels=[10,20,21] → baseLevels=[1,2]` (distinct, ordenado asc); ROOT/ADMIN →
  `allLevels=true` independiente de `levels`; `levels=[]` (no ROOT/ADMIN) → `baseLevels=[]`.
  Cubre REQ-16 / Escenarios ADD-1.1, ADD-1.2, ADD-1.3.
- [x] **T2 (GREEN)** `packages/domain/src/auth/access-scope.ts` — agregar `baseLevels: number[]`
  a la interface `AccessScope` y calcularlo en `resolveAccessScope`:
  `baseLevels = [...new Set(compositeLevels.map(c => Math.floor(c / 10)))].sort((a,b)=>a-b)`.
  Precedente de la fórmula: `levels.guard.ts:44`. Única derivación del sistema (ADR-02).
- [x] **T3** Correr `pnpm --filter @educandow/domain test` — confirmar T1 en verde y cobertura
  ≥80% de `access-scope.ts`.

*Depende de: nada. Bloquea: PR2, PR3, PR4, PR5.*

---

## PR2 — Application + presentation: scope de Listar y Crear

*Depende de: PR1 (usa `AccessScope.baseLevels`).*

- [x] **T4** `packages/domain/src/attendance-type/repositories/attendance-type-repository.ts` —
  agregar `allowedLevels?: number[]` a `AttendanceTypeFilters` (cambio de tipo, sin lógica;
  documentar en el JSDoc que `undefined` = sin restricción, usado por ROOT/ADMIN). Cubre Q4/ADR-07.
  Incluye además (fuera del wording literal del task pero necesario para Q4/ADR-07 y explícito en
  el pedido de ejecución de PR2): `PrismaAttendanceTypeRepository.list()` aplica
  `WHERE level IN (allowedLevels)` (RED/GREEN en `prisma-attendance-type.repository.test.ts`).
- [x] **T5 (RED)** `api/src/application/attendance-type/__tests__/attendance-type.use-cases.test.ts`
  — casos para `ListAttendanceTypesUseCase.execute(filters, currentUser)`:
  docente 1 nivel base → `repo.list` llamado con `allowedLevels=[base]`; docente multi-nivel →
  `allowedLevels` = union de niveles base; ROOT/ADMIN → `repo.list` llamado SIN `allowedLevels`;
  `filters.level` explícito fuera de `baseLevels` → lanza `ForbiddenError`, `repo.list` NUNCA
  invocado. Cubre REQ-17 (MODIFIED) / Escenarios 8.5–8.9.
- [x] **T6 (GREEN)** `api/src/application/attendance-type/use-cases/attendance-type.use-cases.ts`
  — `ListAttendanceTypesUseCase.execute(filters, currentUser)`: llama `resolveAccessScope`;
  si `!scope.allLevels`, valida `filters?.level` ∈ `scope.baseLevels` (si no, `throw ForbiddenError`)
  y setea `filters.allowedLevels = scope.baseLevels`.
- [x] **T7 (RED)** mismo archivo de test — casos para `CreateAttendanceTypeUseCase.execute(input, currentUser)`:
  `input.level` ∈ scope → crea (sin cambios de comportamiento); fuera de scope → `ForbiddenError`,
  `repo.save` NUNCA invocado; ROOT/ADMIN → cualquier nivel. Cubre REQ-18 (MODIFIED) / Escenarios 3.3–3.5.
- [x] **T8 (GREEN)** mismo archivo de producción — `CreateAttendanceTypeUseCase.execute(input, currentUser)`:
  agrega validación de scope ANTES del chequeo de duplicado
  (`if (!scope.allLevels && !scope.baseLevels.includes(input.level)) throw new ForbiddenError(...)`).
- [x] **T9 (RED)** `api/src/presentation/attendance-type/__tests__/attendance-type.controller.test.ts`
  — `list()` y `create()` reciben `@CurrentUser()` y lo pasan al use case; `ForbiddenError` mapeado
  a HTTP 403 con envelope `{ error: { code: 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE', message } }`,
  NUNCA HTTP 200 con `{ data: [] }` como sustituto. Cubre ADD-4.1. Además:
  `attendance-type.controller.e2e.test.ts` (nuevo) verifica el mapeo REAL vía supertest contra el
  pipeline HTTP completo (guards stub + controller real + `AppExceptionFilter` real): 403 real con
  `error.code === 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'` para `?level=` fuera de scope, 200 con
  `data:[]` para nivel en scope.
- [x] **T10 (GREEN)** `api/src/presentation/attendance-type/attendance-type.controller.ts` —
  inyectar `@CurrentUser() user: AuthenticatedUser` en `list()` y `create()`, pasarlo a los use
  cases. **Desviación de diseño (documentada):** en vez del `try/catch handleError` manual
  (patrón `asistencia-reporting.controller.ts:124-126`, pensado para controllers `@Res()`), se creó
  `AttendanceTypeLevelOutOfScopeError extends DomainError` (código
  `ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE`) registrado en `exception.filter.ts` → 403, siguiendo el
  patrón YA usado por `AttendanceTypeNotFoundError`/`AttendanceTypeCodeDuplicateError` en este mismo
  controller (que no usa `@Res()`, así que el filtro global ya intercepta cualquier throw). Mismo
  contrato HTTP observable, controller más THIN, cero código nuevo de manejo de errores por endpoint.
- [x] **T11** Corrido `pnpm --filter api test -- attendance-type` (103/103 verde) y
  `pnpm --filter api test` completo (197 archivos / 1993 tests verde, sin regresiones) +
  `pnpm --filter @educandow/domain test` (110/110, 1275 tests verde) + `pnpm --filter api typecheck`
  (verde). Cobertura confirmada ≥80% (100% en `attendance-type.use-cases.ts`, 97.43% en
  `attendance-type.controller.ts`, 90.32% en `prisma-attendance-type.repository.ts`).
  `ensure-attendance-types-for-level.use-case.ts` (usa Prisma directo, NO estos use cases) sigue sin
  romperse (confirmado en la corrida completa). **Fix no planeado pero necesario:** `pnpm typecheck`
  reveló una regresión preexistente de PR1 — 4 mocks de `AccessScope` en
  `list-grupos-global.use-case.test.ts` no tenían el nuevo campo `baseLevels` (requerido desde PR1).
  Corregido en un commit `fix:` separado de los commits de feature de PR2.

*Bloquea: PR3 (mismos archivos), PR4 (reusa el mismo patrón de scope), PR5.*

---

## PR3 — Application + presentation: scope de Editar/Eliminar/Get-by-id

> **Decisión ya tomada (no diferir):** Update/Delete/Get-by-id quedan level-scoped igual que
> Listar/Crear. El design y la spec marcaron esto como riesgo abierto; se cierra acá.

*Depende de: PR2 (reedita `attendance-type.use-cases.ts` y `attendance-type.controller.ts`).*

- [x] **T12 (RED)** `attendance-type.use-cases.test.ts` — `UpdateAttendanceTypeUseCase.execute(id, input, currentUser)`:
  `entity.level` ∈ scope → actualiza (comportamiento REQ-4 original sin cambios); fuera de scope →
  `ForbiddenError`, `repo.save` NUNCA invocado, registro sin cambios; ROOT/ADMIN → cualquier nivel.
  Cubre REQ "Editar tipo no-sistema" (MODIFIED) / Escenarios 4.3–4.5.
- [x] **T13 (GREEN)** `attendance-type.use-cases.ts` — `UpdateAttendanceTypeUseCase.execute(id, input, currentUser)`:
  después de `findById` y ANTES de `assertMutable`, valida
  `scope.allLevels || scope.baseLevels.includes(entity.level)`, sino `throw ForbiddenError`.
- [x] **T14 (RED)** mismo test file — `DeleteAttendanceTypeUseCase.execute(id, currentUser)` (nueva
  firma): `entity.level` ∈ scope → elimina; fuera de scope → `ForbiddenError`, `repo.delete` NUNCA
  invocado; ROOT/ADMIN → cualquier nivel. Cierra el riesgo "Delete NO scopeado" del design §9.
- [x] **T15 (GREEN)** `attendance-type.use-cases.ts` — `DeleteAttendanceTypeUseCase.execute(id, currentUser)`:
  mismo patrón de validación de scope que T13, antes de `repo.delete`.
- [x] **T16 (RED)** mismo test file — `GetAttendanceTypeUseCase.execute(id, currentUser)` (nueva
  firma): `entity.level` ∈ scope → retorna la entidad; fuera de scope → `ForbiddenError`. Cierra el
  riesgo "Get by id NO scopeado" del design §9.
- [x] **T17 (GREEN)** `attendance-type.use-cases.ts` — `GetAttendanceTypeUseCase.execute(id, currentUser)`:
  mismo patrón de validación de scope que T13, después de `findById`.
- [x] **T18 (RED)** `attendance-type.controller.test.ts` — `update()`, `remove()`, `getOne()` reciben
  `@CurrentUser()` y lo pasan al use case; `ForbiddenError → 403` para los tres handlers, mismo
  envelope de error que T9. Además `attendance-type.controller.e2e.test.ts` extendido con 6 casos
  reales (PATCH/DELETE/GET :id) contra el pipeline HTTP completo (guards stub + controller real +
  `AppExceptionFilter` real): 403 real con `error.code === 'ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE'`
  para nivel fuera de scope, 200/204 para nivel en scope.
- [x] **T19 (GREEN)** `attendance-type.controller.ts` — inyectar `@CurrentUser() user` en `update()`,
  `remove()` y `getOne()`, pasarlo a `updateUC`/`deleteUC`/`getUC`. Controller sigue THIN.
- [x] **T20** Corrido `pnpm --filter api test -- attendance-type` (124/124 verde, +21 tests vs PR2) y
  `pnpm --filter api test` completo (197 archivos / 2014 tests verde, sin regresiones) +
  `pnpm --filter api typecheck` (verde). Cobertura confirmada ≥80% (100% en
  `attendance-type.use-cases.ts`, 97.43% en `attendance-type.controller.ts`). Sin otros callers de
  estos 3 use cases fuera del controller (confirmado en la corrida completa).

*Bloquea: PR5 (el front asume que el backend YA cierra el agujero de scope en las 5 operaciones).*

---

## PR4 — Impresión de tipos de asistencia (PDF síncrono)

*Depende de: PR1 (scope). Reusa el mismo patrón de PR2/T6, pero es una feature nueva
independiente de PR3 — podría desarrollarse en paralelo a PR3 si dos personas trabajan el
change, aunque se lista después por orden de complejidad creciente.*

- [ ] **T21 (RED)** `[parallel-ok]` nuevo archivo
  `api/src/application/attendance-type/__tests__/generate-attendance-types-pdf.use-case.test.ts`
  — `GenerateAttendanceTypesPdfUseCase.execute({ level?, active?, currentUser })`: aplica
  EXACTAMENTE el mismo scope que `ListAttendanceTypesUseCase` (docente 1 nivel/multi-nivel/ROOT-ADMIN/
  nivel explícito fuera de scope → `ForbiddenError`, `PdfGeneratorService.generatePdf` NUNCA
  invocado); arma el view-model esperado (filas ordenadas, mapeo de campos); llama
  `PdfGeneratorService.generatePdf(html)` exactamente una vez (stub/mock, sin Puppeteer real —
  ADR-06). Cubre REQ Impresión / Escenarios ADD-3.1–ADD-3.4.
- [ ] **T22 (GREEN)** nuevo archivo
  `api/src/application/attendance-type/use-cases/generate-attendance-types-pdf.use-case.ts` —
  `GenerateAttendanceTypesPdfUseCase.execute({ level?, active?, currentUser }): Promise<Buffer>`:
  reusa `resolveAccessScope` + `repo.list({ ...filters, allowedLevels })` idéntico a
  `ListAttendanceTypesUseCase` (NO reimplementa la lógica de scope — reutiliza el mismo cálculo,
  criterio transversal de aceptación de la spec); resuelve institución/logo (paridad con
  `resolveInstitution` privado de `generate-asistencia-mensual-pdf.use-case.ts:287-300`); renderiza
  la plantilla `.hbs` (T24) con Handlebars; llama `PdfGeneratorService.generatePdf(html)` SIN
  `landscape` (portrait A4, default del servicio).
- [ ] **T23** Definir interface `AttendanceTypesReportData` / `AttendanceTypesTemplateContext` en
  el mismo archivo del use-case (ADR-05: interface en application, no en domain, paridad con
  `AsistenciaMensualTemplateContext`).
- [ ] **T24** `[parallel-ok]` nuevo archivo
  `api/src/infrastructure/reporting/html-templates/attendance-types.hbs` — tabla portrait
  (código, descripción, nivel, valor de ausencia, comportamiento, estado); header con nombre de
  institución + logo, reusando el patrón de `asistencia-mensual.hbs`. Verificado manualmente contra
  T22 (el use-case referencia el nombre del archivo).
- [ ] **T25 (RED)** `[parallel-ok]` nuevo archivo
  `api/src/presentation/attendance-type/dto/__tests__/print-attendance-types.dto.test.ts` (o
  agregar casos a `dto-validation.test.ts` existente) — `PrintAttendanceTypesQuerySchema` (Zod):
  `level` opcional ∈ `{1,2,3,4}`, `active` opcional boolean-like; valores inválidos → falla de
  parseo (400 en el pipe). Cubre ADD-4.2.
- [ ] **T26 (GREEN)** nuevo archivo
  `api/src/presentation/attendance-type/dto/print-attendance-types.dto.ts` — Zod schema +
  tipo inferido `PrintAttendanceTypesDTO`.
- [ ] **T27 (RED)** `attendance-type.controller.test.ts` (o nuevo archivo e2e) — `GET
  /attendance-types/print`: 200 `application/pdf` + `Content-Disposition: attachment` para nivel
  en scope; 403 (sin generar PDF) para nivel fuera de scope; 400 para query DTO inválido ANTES de
  evaluar scope (orden: transporte → scope, ADD-4.2). Cubre ADD-3.1, ADD-3.2, ADD-4.2.
- [ ] **T28 (GREEN)** `attendance-type.controller.ts` — agregar handler
  `printList(@CurrentUser() user, @Query(new ZodValidationPipe(PrintAttendanceTypesQuerySchema)) query, @Res() res)`
  en `GET /attendance-types/print`, espejando `asistencia-reporting.controller.ts:53-78` (headers
  `Content-Type`/`Content-Disposition`/`Content-Length`, `handleError` mapeando `ForbiddenError →
  ForbiddenException`). Registrar la ruta ANTES de `@Get(':id')` en el archivo si Nest resuelve por
  orden de declaración (evitar que `/print` matchee como `:id`) — verificar y reordenar si hace falta.
- [ ] **T29 (GREEN)** `api/src/presentation/attendance-type/attendance-type.module.ts` — registrar
  `PdfGeneratorService` como provider (hoy solo vive en el módulo de reporting) y wirear
  `GenerateAttendanceTypesPdfUseCase` vía `useFactory(repo, pdfGenerator)`. Antes de duplicar el
  provider, revisar si existe un `ReportingModule` compartido exportando `PdfGeneratorService`
  para importarlo en vez de instanciar un segundo Puppeteer singleton (design §9, riesgo de doble
  instancia de browser) — documentar la decisión tomada en el commit.
- [ ] **T30** Correr `pnpm --filter api test -- attendance-type` — confirmar T21/T25/T27 en verde,
  cobertura ≥80% en los archivos nuevos.

*Bloquea: PR5 (el botón "Imprimir" del front pega contra este endpoint).*

---

## PR5 — Web: selector adaptado al scope + impresión

*Depende de: PR2, PR3, PR4 (consume el contrato de API ya estabilizado: 403 fuera de scope en
las 5 operaciones + endpoint de impresión). Antes de arrancar, confirmar con el harness de
testing del proyecto (`sdd-init` cache) si `attendance-types.tsx` tiene cobertura de tests de
componente; si el harness no soporta tests de React en este momento, marcar T31/T33/T35 como
`SKIP (sin harness)` y dejarlo documentado — no inventar un test runner nuevo fuera de alcance.*

- [ ] **T31 (RED)** test de `availableLevels` (ubicación según harness — junto a
  `attendance-types.tsx` o `__tests__/attendance-types.test.tsx`): 1 nivel base → selector de
  filtro visible+disabled+valor fijo; N niveles → selector ofrece solo esos; 0 niveles
  (no-ROOT/no-ADMIN) → estado vacío explícito, sin selector ni tabla; ROOT/ADMIN → todos los
  niveles pedagógicos de `LEVEL_CATALOG`. Cubre REQ Selector / Escenarios ADD-2.1–ADD-2.4.
- [ ] **T32 (GREEN)** `web/src/pages/dashboard/attendance-types.tsx` —
  - importar `useAuth` de `../../context/auth-context` (además del `useCan` existente).
  - derivar `isRootOrAdmin = (user?.roles ?? []).some(r => r === 'ROOT' || r === 'ADMIN')`.
    **Nota de corrección explícita:** NO usar `useCan().isRoot` para esto — ese hook solo chequea
    `ROOT` (`use-can.ts:10`), no `ADMIN`; el design confirma en §2 que "ADMIN = allLevels (como
    ROOT)" para este delta, así que hace falta el chequeo propio de roles, igual que
    `gestion-grupos.tsx:95` pero incluyendo `ADMIN`.
  - derivar `userLevelBases = [...new Set((user?.userLevels ?? []).map(ul => ul.level))]`
    (colapso de modalidad, réplica trivial de la fórmula de dominio — Q1, front no importa
    runtime de domain).
  - derivar `availableLevels = isRootOrAdmin ? LEVEL_CATALOG.filter(e => e.pedagogical) : LEVEL_CATALOG.filter(e => e.pedagogical && userLevelBases.includes(e.levelCode ?? e.code))`
    (ajustar al shape real de `LEVEL_CATALOG` importado de `../../constants/levels`).
  - eliminar el `LEVEL_OPTIONS` hardcodeado (líneas 15-20) y reemplazar sus dos usos (combo de
    filtro y combo del form de alta) por `availableLevels`.
- [ ] **T33 (RED)** `[parallel-ok]` test — filtro de nivel: `disabled` + valor fijo cuando
  `availableLevels.length === 1`; habilitado con solo esas opciones cuando `length > 1`; form de
  alta: `level` pre-seteado y `disabled` cuando `length === 1`, `EMPTY_FORM.level` inicializado al
  único nivel disponible (no hardcodeado a `2`).
- [ ] **T34 (GREEN)** `attendance-types.tsx` — conectar el `<select>` de filtro y el `<select>` del
  form de alta (líneas ~325-337 y ~387-398) a `availableLevels`/branch 1-N; agregar prop
  `disabled={availableLevels.length === 1}`; ajustar `EMPTY_FORM.level` (hoy hardcodeado a `2`,
  línea 53) para setearse dinámicamente al único nivel cuando corresponda (via `useEffect` o al
  abrir el form).
- [ ] **T35 (RED)** `[parallel-ok]` test — botón "Imprimir": `onClick` llama
  `apiClient.get('/attendance-types/print', { params: { level: filterLevel || undefined, active: filterActive || undefined }, responseType: 'blob' })`
  y dispara `triggerPdfDownload(blob, filename)`; deshabilitado mientras `printLoading`.
- [ ] **T36 (GREEN)** `attendance-types.tsx` — agregar helper `triggerPdfDownload` (reusar patrón
  literal de `asistencia-mensual.tsx:389-397`), estado `printLoading`, handler `handlePrint` y
  botón "Imprimir" junto a los filtros existentes, pasando el filtro actual (`filterLevel`,
  `filterActive`) como query params.
- [ ] **T37 (RED)** test — 0 niveles base (no-ROOT/no-ADMIN): la página renderiza un estado vacío
  explícito ("No tenés acceso a ningún nivel" o similar) y NO renderiza selector con opciones ni
  tabla vacía sin contexto, NI el botón "Nuevo tipo". Cubre Escenario ADD-2.4.
- [ ] **T38 (GREEN)** `attendance-types.tsx` — agregar branch de estado vacío ANTES del render
  principal, cuando `!isRootOrAdmin && availableLevels.length === 0` (patrón similar al guard
  existente de ROOT sin institución seleccionada, líneas 266-273).
- [ ] **T39** Correr `pnpm --filter web test` (si aplica) + `pnpm --filter web build` — confirmar
  T31/T33/T35/T37 en verde (o documentar SKIP si no hay harness), sin romper
  `asistencia-mensual.tsx` (no tocado) ni `gestion-grupos.tsx` (no tocado).

---

## Cierre transversal

- [ ] **T40** Correr `pnpm build && pnpm test && pnpm lint` en la raíz del monorepo — build,
  suite completa y lint sin regresiones; cobertura ≥80% en los paquetes tocados
  (`packages/domain`, `api`, `web` si aplica).
- [ ] **T41** Verificar los 4 criterios de aceptación transversales de la spec (sección final del
  delta): ningún test asume 200+vacío como sustituto de 403; `resolveAccessScope` es la única
  fuente de verdad de scope (grep para confirmar que ningún use-case reimplementa el colapso de
  modalidad); un request directo a la API fuera de scope (bypaseando el front) sigue devolviendo
  403; impresión usa exactamente el mismo cálculo de scope/filtro que el listado.
