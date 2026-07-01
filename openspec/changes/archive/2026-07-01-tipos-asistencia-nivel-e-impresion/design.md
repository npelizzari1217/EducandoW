# Design — tipos-asistencia-nivel-e-impresion

> Arquitectura técnica (el CÓMO) para scopear "Tipos de asistencia" por nivel base del usuario
> (backend-first, 403 fuera de scope) y agregar impresión PDF respetando el MISMO filtro.
> Clean/Hexagonal por capas. Reusa `resolveAccessScope`, `PdfGeneratorService` y el patrón
> de descarga blob de `asistencia-mensual`. No toca `asistencia-mensual` ni el modelo `UserLevel`.

## 0. Resumen ejecutivo del enfoque

La autorización de nivel vive en el **use-case de application**, con la regla de nivel expresada en
**domain** (`AccessScope`). El nivel base (1-4) se colapsa desde los códigos compuestos en UNA sola
derivación de dominio (`AccessScope.baseLevels`), reutilizada por listar/crear/imprimir. El repo Prisma
gana un filtro `allowedLevels?: number[]` (`WHERE level IN (...)`) que el use-case arma desde el scope.
Controllers THIN inyectan `@CurrentUser`. La impresión es **síncrona**, con un nuevo use-case que reusa
`PdfGeneratorService.generatePdf` y una plantilla `.hbs` nueva. El front deriva `availableLevels`
idénticamente y descarga el blob con el idiom ya existente.

---

## 1. Preguntas abiertas resueltas (con cita de archivo:línea)

### Q1 — Fuente de verdad del nivel base (UNA sola derivación)

**Decisión:** el nivel base se deriva DENTRO de `resolveAccessScope`, agregando un campo `baseLevels: number[]`
al `AccessScope`. Es la única derivación en el sistema y la comparte listar/crear/imprimir.

- Hoy `AccessScope` (packages/domain/src/auth/access-scope.ts:3-21) expone `compositeLevels: number[]`
  tomados de `user.levels` (códigos compuestos: 10, 20, 30…).
- La colapsación a base ya existe informalmente en `levels.guard.ts:44` → `userBases = userLevels.map(c => Math.floor(c / 10))`.
- El front ya deriva base con la misma aritmética en `gestion-grupos.tsx:112-115`
  (`userLevelCodes = userLevels.map(ul => ul.level * 10 + ul.modality)`, y base = `ul.level`).

**Regla canónica (dominio):** `baseLevels = distinct(compositeLevels.map(c => Math.floor(c / 10)))`, ordenado asc.
Equivale a `distinct(userLevels[].level)` en el front (porque `code = level*10 + modality ⇒ floor(code/10) = level`).

**Por qué extender `resolveAccessScope` y no un helper suelto:** todos los consumidores backend ya lo llaman;
un campo derivado evita que cada use-case recalcule y evita duplicar la fórmula. El front NO importa runtime del
dominio (ver levels.ts:10-11, restricción CJS/ESM), así que replica el `map` trivial — una línea, sin lógica de negocio.

### Q2 — "Institución activa": ¿el JWT ya está scopeado?

**Sí. No hacen falta lookups a `InstitutionLevel`.** Confirmado leyendo el login:

- `login.use-case.ts:58` → `instId` sale de la ÚNICA institución del usuario (`user.institutionId`).
- `login.use-case.ts:71-80` → `levels`/`userLevels` se construyen desde `user.levels` (los niveles de ESE
  usuario en ESA institución) y se firman junto con `institutionId: instId`.
- `auth.guard.ts:36-44` → `AuthenticatedUser` re-hidrata `institutionId`, `levels`, `userLevels` del payload.

Conclusión: los niveles del JWT YA están scopeados a la institución activa del usuario. Para ROOT/ADMIN
`allLevels=true`, así que el scope de nivel no aplica (ven todos). El tenant DB ya aísla por institución
(`TenantContext`, prisma-attendance-type.repository.ts:15-19). **No agregamos `institutionId` a `AttendanceType`
ni cross-check a `InstitutionLevel`.**

### Q3 — Impresión: síncrona

**Decisión: SÍNCRONA**, idéntico a `asistencia-mensual` print. El catálogo es chico (≤ pocas decenas de filas),
no justifica cola/async. Reusa `PdfGeneratorService.generatePdf(html, options?)` (pdf-generator.service.ts:30).

- Endpoint nuevo: `GET /attendance-types/print?level=&active=` → `application/pdf` con `Content-Disposition: attachment`.
- Plantilla nueva: `api/src/infrastructure/reporting/html-templates/attendance-types.hbs` (portrait, tabla simple).
- El use-case recibe `{ level?, active?, currentUser }`, aplica el mismo scope que `list`, arma el view-model y renderiza.

### Q4 — Cómo se aplica el scope en el repo Prisma

**Decisión:** extender `AttendanceTypeFilters` con `allowedLevels?: number[]`. El use-case lo arma desde el scope;
el repo hace `WHERE level IN (allowedLevels)`. Controllers THIN.

Firma nueva (packages/domain/src/attendance-type/repositories/attendance-type-repository.ts:3-6):

```ts
export interface AttendanceTypeFilters {
  level?: number;          // filtro explícito (query ?level=)
  active?: boolean;
  allowedLevels?: number[]; // scope de nivel base; undefined = sin restricción (ROOT/ADMIN)
}
```

`list()` en prisma-attendance-type.repository.ts:33-43 agrega:
```ts
if (filters?.allowedLevels !== undefined) where.level = { in: filters.allowedLevels };
if (filters?.level !== undefined) where.level = filters.level; // explícito gana, pero el use-case ya validó pertenencia
```

### Q5 — Contrato UI en attendance-types.tsx

Ver §5. En síntesis: `availableLevels` derivado del usuario (ROOT/ADMIN → `LEVEL_CATALOG` pedagógico colapsado a
base; else → distinct de `userLevels[].level`), branch 1/N/0, selector `disabled` cuando hay 1 nivel, y botón
"Imprimir" que descarga el blob pasando el filtro actual, reusando `triggerPdfDownload`.

---

## 2. Decisiones confirmadas (no re-litigar)

ADMIN = `allLevels` (como ROOT). Nivel base colapsa modalidad. Scope por institución activa (ya en el JWT).
1 nivel → selector visible pero disabled y fijado. Seguridad backend-first (403). Sin tocar `asistencia-mensual`.
Sin modificar `UserLevel`.

---

## 3. Arquitectura por capas (dónde va cada pieza)

### 3.1 domain (`packages/domain`) — importa NADA externo
- **`auth/access-scope.ts`**: agregar `baseLevels: number[]` a `AccessScope` y computarlo en `resolveAccessScope`.
  Regla de negocio pura (colapsar modalidad → nivel base). Único punto de verdad.
- **Contrato de datos del PDF**: `AttendanceTypesReportData` (view-model del reporte) definido en domain para que
  la plantilla no imponga forma desde infra (reporting-documents: "domain define el contrato de datos"). Alternativa
  pragmática: definirlo como `interface` en el use-case (paridad con `AsistenciaMensualTemplateContext`,
  generate-asistencia-mensual-pdf.use-case.ts:74-82). **Elegido:** interface en application, ver ADR-05.
- **`AttendanceTypeFilters`**: sumar `allowedLevels?` (lenguaje de dominio del repo).
- **`ForbiddenError`** (ya existe, exportado en '@educandow/domain') para el 403.

### 3.2 application (`api/src/application/attendance-type`)
- **`ListAttendanceTypesUseCase`**: nueva firma `execute(filters, currentUser)`. Llama `resolveAccessScope(currentUser)`,
  arma `allowedLevels` y valida `level` explícito ∈ scope (si no, 403).
- **`CreateAttendanceTypeUseCase`**: recibe `currentUser`; valida `input.level ∈ scope.baseLevels` salvo `allLevels`,
  sino `ForbiddenError`. (Update/Delete/Get quedan igual en esta iteración — ver Riesgos.)
- **`GenerateAttendanceTypesPdfUseCase`** (NUEVO): `execute({ level?, active?, currentUser }) → Buffer`. Reusa el
  mismo scoping que List, arma view-model, resuelve institución/logo (idéntico a la privada `resolveInstitution`,
  generate-asistencia-mensual-pdf.use-case.ts:287-300) y llama `PdfGeneratorService.generatePdf(html)` (portrait).

### 3.3 infrastructure (`api/src/infrastructure`)
- **`prisma-attendance-type.repository.ts`**: `list()` soporta `allowedLevels` (`WHERE level IN`).
- **`reporting/html-templates/attendance-types.hbs`** (NUEVO): tabla portrait (código, descripción, nivel,
  valor ausencia, comportamiento, estado). Header institución + logo reusando el patrón de asistencia-mensual.hbs.
- **`PdfGeneratorService`**: SIN cambios (se reusa tal cual).

### 3.4 presentation (`api/src/presentation/attendance-type`)
- **`attendance-type.controller.ts`**: THIN. `list()` y `create()` reciben `@CurrentUser() user` y lo pasan al use-case.
  Nuevo handler `printList()` (`GET /attendance-types/print`) con `@Res()`, DTO Zod de query, y seteo de headers PDF
  copiando asistencia-reporting.controller.ts:69-77 + `handleError` para mapear `ForbiddenError → ForbiddenException`.
- **`dto/print-attendance-types.dto.ts`** (NUEVO): Zod query `{ level?: 1|2|3|4, active?: boolean }`.
- **`attendance-type.module.ts`**: wiring del nuevo use-case (inyecta `PdfGeneratorService`, `PrismaService`,
  `'AttendanceTypeRepository'`). Registrar `PdfGeneratorService` como provider (hoy no está en este módulo).

### 3.5 web (`web/src/pages/dashboard/attendance-types.tsx`)
- Derivar `availableLevels` del usuario; branch 1/N/0; selector `disabled` en 1; form de creación pre-seteado y
  bloqueado en 1 nivel; botón "Imprimir" que descarga blob con el filtro actual (reusa `triggerPdfDownload`).
- `useAuth()` para `user.roles`/`user.userLevels` (idiom gestion-grupos.tsx:91-115).

---

## 4. Flujo de datos

### 4.1 Listado scopeado
```
GET /attendance-types?level=&active=
  → AuthGuard (hidrata AuthenticatedUser) → RolesGuard (ATTENDANCE_TYPES/READ)
  → Controller.list(@CurrentUser user, query)
  → ListAttendanceTypesUseCase.execute(filters, user)
      scope = resolveAccessScope({ roles: user.roles, levels: user.levels })
      if (!scope.allLevels) {
        if (query.level && !scope.baseLevels.includes(query.level)) throw ForbiddenError  // 403
        filters.allowedLevels = scope.baseLevels
      }
      repo.list(filters)  → WHERE deletedAt IS NULL [AND level IN (...)] [AND level=..] [AND active=..]
  → { data: [...] }
```

### 4.2 Creación scopeada
```
POST /attendance-types  (body.level)
  → Controller.create(@CurrentUser user, body)
  → CreateAttendanceTypeUseCase.execute(input, user)
      scope = resolveAccessScope(user)
      if (!scope.allLevels && !scope.baseLevels.includes(input.level)) throw ForbiddenError  // 403
      ...duplicate check + save (sin cambios)
```

### 4.3 Impresión (síncrona)
```
GET /attendance-types/print?level=&active=
  → Controller.printList(@CurrentUser user, query, @Res res)
  → GenerateAttendanceTypesPdfUseCase.execute({ level, active, currentUser: user })
      scope = resolveAccessScope(user)  // MISMO gate que list (incl. 403 si level fuera de scope)
      rows = repo.list(filtersConScope)
      { institucionNombre, logoDataUri } = resolveInstitution()
      html = template(viewModel)
      buffer = pdfGenerator.generatePdf(html)   // portrait A4
  → res.set(application/pdf, attachment) ; res.send(buffer)
  Front: apiClient.get(url, { responseType: 'blob' }) → triggerPdfDownload(blob, filename)
```

---

## 5. Contrato UI (attendance-types.tsx)

```
availableLevels (base 1-4):
  ROOT/ADMIN → distinct de LEVEL_CATALOG.filter(pedagogical).map(e => e.levelCode)  // [1,2,3,4]
  else       → distinct((user.userLevels ?? []).map(ul => ul.level))                // p.ej. [2]

Branch:
  0 niveles → estado vacío accesible ("No tenés niveles asignados"), sin form ni tabla
  1 nivel   → selector de filtro RENDERIZADO pero disabled y fijado a ese nivel;
              form de creación con <select nivel> pre-seteado a ese nivel y disabled;
              EMPTY_FORM.level = ese nivel
  N niveles → selector con solo esos niveles (no LEVEL_OPTIONS hardcodeado global)

Botón Imprimir:
  visible junto a filtros; onClick =>
    params = { level: filterLevel || undefined, active: filterActive || undefined }
    apiClient.get('/attendance-types/print', { params, responseType: 'blob' })
    triggerPdfDownload(res.data, `tipos-asistencia-${filterLevel||'todos'}.pdf`)
  disabled mientras printLoading

Estados (ui-patterns): loading (tabla "Cargando…"), empty (0 niveles / 0 filas), error (toast/inline).
```

**Reemplazos concretos:** `LEVEL_OPTIONS` global (líneas 15-20) deja de ser la fuente de los combos de filtro y de
creación; se derivan de `availableLevels`. El filtro de nivel client-side (líneas 203-208) puede permanecer como UX,
pero la fuente de verdad del scope es el backend (el server ya filtra; el front no debe "recuperar" niveles ajenos).

---

## 6. ADRs

- **ADR-01 — Autorización de nivel en application, regla en domain.** El use-case decide (llama `resolveAccessScope`
  y lanza `ForbiddenError`); el dominio expresa la regla (`baseLevels`). *Rechazado:* Guard Nest de nivel
  (`LevelsGuard`) — sirve para gatear por ruta pero no puede filtrar filas ni validar `body.level` con lógica de
  negocio, y mezcla AuthZ de datos con transporte. *Rechazado:* filtrar solo en el front — viola backend-first.

- **ADR-02 — `baseLevels` como campo derivado de `AccessScope`.** Una sola fórmula en domain.
  *Rechazado:* helper suelto `toBaseLevels()` llamado por cada use-case (más superficie para desincronizar) y
  recomputar en cada capa. *Rechazado:* leer `userLevels` del JWT en el controller (lógica en transporte).

- **ADR-03 — JWT como fuente de institución/niveles activos.** No se consulta `InstitutionLevel` (login ya scopea,
  Q2). *Rechazado:* cross-check `InstitutionLevel.active` — fuera de scope por proposal, agrega I/O sin beneficio hoy.

- **ADR-04 — Impresión síncrona reusando `PdfGeneratorService`.** Catálogo chico; paridad con asistencia-mensual.
  *Rechazado:* async/cola — sobre-ingeniería. *Rechazado:* generación client-side (html2pdf) — el proyecto ya
  estandarizó PDF server-side (asistencia-mensual.tsx:385-387).

- **ADR-05 — View-model del reporte como `interface` en application (no en domain).** Paridad con
  `AsistenciaMensualTemplateContext`. El generador no tiene lógica de negocio (solo mapea entidades → filas).
  *Tradeoff:* reporting-documents sugiere "domain define el contrato de datos"; se prioriza consistencia con el
  reporte existente y se mantiene el generador sin reglas. Si aparece un segundo consumidor del contrato, se sube a domain.

- **ADR-06 — Inyectar `PdfGeneratorService` concreto en el use-case (no un port nuevo).** Consistencia con
  generate-asistencia-mensual-pdf.use-case.ts:108. *Tradeoff:* reporting-documents pide "PDF detrás de un port en
  application". Se documenta la deuda: si se testea el use-case en aislamiento del navegador, se introduce
  `PdfPort` con impl en infra. Para esta iteración se stubbea `PdfGeneratorService` en los tests.

- **ADR-07 — `allowedLevels` en los filtros del repo (no un método nuevo).** `WHERE level IN`. Métodos del repo
  en lenguaje de dominio, sin filtrar de más en application (no traer todo y filtrar en memoria).

---

## 7. Puntos de integración y contratos

| Contrato | Antes | Después |
|---|---|---|
| `AccessScope` | `{ isAdministrative, allLevels, compositeLevels }` | `+ baseLevels: number[]` |
| `AttendanceTypeFilters` | `{ level?, active? }` | `+ allowedLevels?: number[]` |
| `ListAttendanceTypesUseCase.execute` | `(filters?)` | `(filters, currentUser)` |
| `CreateAttendanceTypeUseCase.execute` | `(input)` | `(input, currentUser)` |
| Controller `list`/`create` | sin user | `@CurrentUser() user` inyectado |
| Endpoint impresión | — | `GET /attendance-types/print` → `application/pdf` |
| Front combos | `LEVEL_OPTIONS` global | `availableLevels` derivado del usuario |

Compatibilidad: la respuesta de `list` mantiene el envelope `{ data }` y `toResponse` (controller líneas 20-32) sin cambios.

---

## 8. Plan de tests (test-first para sdd-tasks)

**domain (Vitest, packages/domain)**
- `access-scope.test.ts` (ampliar): `baseLevels` colapsa `[10,20,21] → [1,2]`, distinct y ordenado; `allLevels`
  para ROOT/ADMIN independiente de niveles; `baseLevels=[]` sin niveles. (Req: Q1/ADR-02)

**application (Vitest, api) — con repo/pdf mockeados**
- `ListAttendanceTypesUseCase`: docente 1 nivel → `allowedLevels=[base]`; multi-nivel → union; ROOT/ADMIN →
  sin `allowedLevels`; `level` explícito fuera de scope → `ForbiddenError`. (Req: scope listado / 403)
- `CreateAttendanceTypeUseCase`: `level` en scope → crea; fuera de scope → `ForbiddenError`; ROOT/ADMIN cualquier nivel. (Req: scope creación / 403)
- `GenerateAttendanceTypesPdfUseCase`: aplica el mismo scope que list; `level` fuera de scope → 403; arma el
  view-model esperado y llama `PdfGeneratorService.generatePdf` una vez (stub). (Req: impresión scopeada)

**infrastructure (Vitest, api)**
- `PrismaAttendanceTypeRepository.list`: `allowedLevels` genera `where.level = { in: [...] }`; sin él, sin restricción. (Req: Q4)

**presentation / e2e (Vitest + Nest testing, api)**
- `attendance-type.controller`: `GET` y `POST` pasan `@CurrentUser` al use-case; `ForbiddenError → 403`.
- `GET /attendance-types/print`: 200 `application/pdf` con `Content-Disposition` para nivel en scope;
  403 para nivel fuera de scope; query DTO inválido → 400. (Req: endpoint impresión)

**web (si aplica en el harness front)**
- `availableLevels`: 1 nivel → selector disabled y fijado; 0 niveles → estado vacío; N → solo esos niveles.
- Botón Imprimir dispara `get(..., { responseType: 'blob' })` con el filtro actual y llama `triggerPdfDownload`.

Cobertura objetivo ≥ 80% (TDD estricto, `pnpm test`).

---

## 9. Riesgos y supuestos

- **Update/Delete/Get NO reciben scope en esta iteración.** Un docente podría editar/borrar por `id` un tipo de
  otro nivel si adivina el UUID. Mitigación mínima sugerida (a decidir en tasks): validar en `Get/Update/Delete`
  que `entity.level ∈ scope.baseLevels`. Se marca como riesgo, no bloqueante para el objetivo (listar/crear/imprimir).
- **Wiring del módulo:** `useFactory` inyecta el nuevo use-case; hay que registrar `PdfGeneratorService` en
  `attendance-type.module.ts` (hoy solo está en el módulo de reporting). Verificar que no haya doble instancia de
  browser Puppeteer (es `@Injectable` singleton por módulo; aceptable, o mover a un `ReportingModule` compartido).
- **Front sin import runtime de domain** (levels.ts:10-11): la derivación base se replica manualmente; si el
  catálogo de dominio cambia, mantener en sync (ya es una convención existente del repo).
- **ROOT selector de institución** (attendance-types.tsx:72-90): ROOT ve todos los niveles; su `availableLevels`
  es `[1,2,3,4]` y no depende de `userLevels`. Confirmar que el filtro por `institutionId` (query param ROOT) sigue
  funcionando junto al nuevo scoping (para ROOT `allLevels=true`, no hay conflicto).
- **Supuesto:** `PdfGeneratorService.generatePdf` sin `landscape` produce portrait A4 (pdf-generator.service.ts:41-46). Confirmado.
