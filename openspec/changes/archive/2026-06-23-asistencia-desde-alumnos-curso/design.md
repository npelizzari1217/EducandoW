# Design — asistencia-desde-alumnos-curso

> Phase: design (the HOW at architectural level). Reads: proposal. Pedagogical level: level-agnostic.
> Architecture: Clean / Hexagonal. Enrichment happens at the repo/application boundary; the domain entity stays ID-only.

## 1. Executive summary

Two coordinated changes over the existing Asistencia Mensual feature:

- **Part A (frontend navigation):** an attendance-gated button inside `AlumnosCursoCicloPanel` navigates to `/asistencia-mensual?ccId=<ccId>`; the page reads the query param and pre-selects that CourseCycle in **General** mode after the async CC list resolves.
- **Part B (backend enrichment + display fix):** both attendance repos gain a dedicated **enriched** read method that resolves `studentName` via a single Prisma `include` of the existing `student` relation, sorted by `lastName, firstName`. The name flows up through the list use cases and controller mappers into `studentName` on both response DTOs; the grid renders the name instead of the raw UUID.

No DB migration (both Prisma models already have the `student` relation — schema lines 1353 and 1375). No guard changes (list endpoints already enforce `@Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })`).

## 2. Architecture approach

- **Pattern:** mirror the established `findByCourseCycle` (pure domain) vs `findByCourseCycleEnriched` (enriched DTO) coexistence in `PrismaAlumnosXCursoXCicloRepository`. We do NOT mutate the existing `findByScopeAndMonth`; we ADD an enriched sibling. This keeps the canonical "rows in scope" port intact (still used by generate/independence integration tests) and isolates display enrichment as an explicitly-named boundary method.
- **Layering / boundaries:**
  - Domain (`@educandow/domain`): entity `AsistenciaXAlumnoXCursoXCiclo` stays **ID-only** (no `studentName`). We add only *port types* (the enriched wrapper) + the new port method signatures.
  - Infrastructure (Prisma repos): single `include` query resolves the name; maps each Prisma row to `{ attendance: <domain entity>, studentName }`. No N+1.
  - Application (list use cases): pass the enriched array through unchanged in shape (auth logic untouched).
  - Presentation (controller mappers + DTOs): map the wrapper → response DTO, setting `studentName`. Thin controller, presentation imports application only.
  - Web: container component reads the query param, gates the button, renders the name.

## 3. Component & data-flow map

### Part B data flow (the bug fix)

```
GET /course-cycles/:ccId/asistencia-mensual?year=&month=
  AsistenciaController.listGeneral
    -> ListGeneralAttendanceUseCase.execute            (auth Door2 unchanged)
       -> generalRepo.findByScopeAndMonthEnriched(...)  [NEW]
          -> prisma.findMany({
               include: { student: { select: { firstName, lastName } } },
               orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
             })
          -> map row -> { attendance: toDomain(row), studentName: `${lastName}, ${firstName}` }
    <- EnrichedGeneralAttendance[]
  -> toGeneralResponse(enriched)  -> { ...domain fields, studentName }
<- AsistenciaGeneralResponse[]  (studentName present)
```

Materia path is symmetric: `listSubject -> ListSubjectAttendanceUseCase -> materiaAsistRepo.findByScopeAndMonthEnriched -> toMateriaResponse`. The optional `grupoId` student filter is preserved (the `studentIds?` argument stays).

### Part A data flow (navigation + pre-selection)

```
AlumnosCursoCicloPanel (has ccId prop)
  useCan().can('ATTENDANCE','READ') === true  -> render button
  onClick -> navigate(`/asistencia-mensual?ccId=${ccId}`)

AsistenciaMensualPage
  useSearchParams() -> ccIdParam (available synchronously on mount)
  mount effect: GET /course-cycles (async) -> setCourseCycles(ccs)
  param effect (keyed [courseCycles, ccIdParam]): once ccs loaded & param valid -> setSelectedCCId(ccIdParam), setMode('general')
  -> existing loadGeneralRows effect fires on selectedCCId change
```

## 4. ADR-style decisions

### ADR-1 — Add an enriched sibling method; do NOT mutate `findByScopeAndMonth`
- **Decision:** add `findByScopeAndMonthEnriched(...)` to both `AsistenciaGeneralRepository` and `AsistenciaMateriaRepository`; the list use cases switch to it. Keep `findByScopeAndMonth` returning pure domain entities.
- **Rationale:** exactly mirrors the existing `findByCourseCycle` / `findByCourseCycleEnriched` convention in this codebase. Avoids breaking the integration tests (`api/test/integration/asistencia/*.db.test.ts`) that call `findByScopeAndMonth` and assert on plain rows. Keeps the canonical port honest and enrichment opt-in.
- **Rejected:** changing `findByScopeAndMonth`'s return type to the wrapper — wider blast radius (integration tests, generate flow callers) and conflates "rows in scope" with "rows for display".

### ADR-2 — Enriched wrapper type, entity stays ID-only
- **Decision:** introduce port-level types in the domain repository files:
  ```ts
  export interface EnrichedGeneralAttendance {
    attendance: AsistenciaXAlumnoXCursoXCiclo;
    studentName: string;   // "Apellido, Nombre"
  }
  // and EnrichedMateriaAttendance { attendance: AsistenciaXMateriaXAlumnoXCursoXCiclo; studentName: string }
  ```
  Repo method returns `Promise<EnrichedGeneralAttendance[]>` / `Promise<EnrichedMateriaAttendance[]>`.
- **Rationale:** the domain entity `AsistenciaXAlumnoXCursoXCiclo` MUST stay ID-only (it has no name concept). The wrapper composes the entity with display data at the boundary — clean-arch compliant. A wrapper (not a flat DTO like `AlumnoCursoCicloEnriched`) is chosen because the controller mapper still needs the entity's value objects (`id.get()`, `days.toJSON()`).
- **Rejected:** putting `studentName` on the entity (pollutes domain); returning a fully flat DTO from the repo (loses the entity's VO methods the mapper relies on).

### ADR-3 — Single `include` query (no N+1, better than the reference)
- **Decision:** resolve the name with one `findMany` using `include: { student: { select: { firstName, lastName } } }` plus DB-side `orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }]`.
- **Rationale:** both attendance models have a direct `student` relation, so a single query suffices — strictly better than `findByCourseCycleEnriched`, which issues a second `student.findMany` because its model needed manual resolution. Repository-pattern standard: single query, returns enriched data, no N+1.
- **Note:** sorting is done DB-side via the relation; no in-memory `localeCompare` needed. (Accent handling differs slightly from the JS `localeCompare('es')` used by the reference — acceptable; DB collation governs.)

### ADR-4 — Name format `"Apellido, Nombre"` (intentional inconsistency)
- **Decision:** mappers build `studentName = `${lastName}, ${firstName}``, matching `Student.fullName` (Argentine standard).
- **Rationale:** the user asked for "Apellido y Nombre" sorted alphabetically; the domain `Student.fullName` getter already uses `${lastName}, ${firstName}`.
- **Documented inconsistency:** `findByCourseCycleEnriched` returns `${firstName} ${lastName}` ("Nombre Apellido"). We deliberately do NOT match it (proposal Scope-OUT keeps that screen unchanged). Two different display conventions coexist by design.

### ADR-5 — PATCH `/dia` response `studentName` (shared mapper/DTO tradeoff)
- **Decision:** the shared mappers `toGeneralResponse` / `toMateriaResponse` take `(row, studentName)`. The **list** path passes the enriched real name. The **record/PATCH `/dia`** path passes `studentName: ''` with an explicit code comment.
- **Rationale:** `studentName` is required on the DTO, but the record-day use cases return a plain entity (no name) and the frontend's optimistic merge for PATCH only reads `updated.days` (asistencia-mensual.tsx ~lines 300-305, 319-322) — it preserves the already-displayed name via `{ ...r, days: updated.days }` and never reads the PATCH response name. Enriching the record path (via `setDay` include) would widen scope into the record use cases + their tests for zero UI benefit.
- **Rejected:** enriching `setDay` to return a wrapper (scope creep, churns record use-case + integration tests); making `studentName` optional (proposal locked it as required `string`).
- **Risk flagged:** the PATCH contract returns an empty `studentName`. If a future consumer reads it, enrich `setDay` then. The user-facing bug (line 543, the list view) is fully fixed.

### ADR-6 — Navigation via query string `?ccId=`; button gated by `useCan`
- **Decision:** button uses `useNavigate()` -> `/asistencia-mensual?ccId=${ccId}`; visibility gated by `const { can } = useCan(); can('ATTENDANCE','READ')`.
- **Rationale:** no new route (reuse existing page), shareable/bookmarkable URL, simplest. `useCan` is the single source of truth for module-action checks (ROOT bypasses). Confirmed signature: `useCan()` returns `{ can, isRoot }`, `can(moduleCode, ...actions)`.
- **Rejected:** router `state` (not shareable); a new dedicated route (unneeded duplication).

### ADR-7 — Race-free pre-selection via param-keyed effect
- **Decision:** `useSearchParams()` exposes `ccIdParam` synchronously. The mount effect sets the default first-CC selection **only when there is no pending valid param** (`!ccIdParam`). A separate effect keyed on `[courseCycles, ccIdParam]` applies the param once the CC list has resolved: if `ccIdParam` exists in the loaded list -> `setSelectedCCId(ccIdParam)` + `setMode('general')`; if invalid -> fall back to first CC. A one-shot guard (`useRef`) prevents re-applying after the user manually changes the selector.
- **Rationale:** the CC list loads async via `GET /course-cycles`; applying the param inside a list-keyed effect guarantees the target CC exists before selection, eliminating the race. The existing `loadGeneralRows` effect (keyed on `selectedCCId`) then fires exactly once with the correct CC — no flicker, no double fetch.
- **No-regression guarantee:** with no `ccIdParam`, the `!ccIdParam` branch keeps the current "auto-select first CC, default general mode" behavior unchanged.
- **Rejected:** applying the param inside the mount `Promise.all().then` (works but conflates loading and param-application responsibilities; the param-keyed effect is the explicit, testable separation the design calls for).

## 5. Integration points (confirmed against code)

| Concern | Location | Change |
|---|---|---|
| Domain port (general) | `packages/domain/src/asistencia/repositories/asistencia-general-repository.ts` | add `EnrichedGeneralAttendance` + `findByScopeAndMonthEnriched` |
| Domain port (materia) | `packages/domain/src/asistencia/repositories/asistencia-materia-repository.ts` | add `EnrichedMateriaAttendance` + `findByScopeAndMonthEnriched` |
| Repo (general) | `api/.../repositories/prisma-asistencia-general.repository.ts` | implement enriched method (include + orderBy) |
| Repo (materia) | `api/.../repositories/prisma-asistencia-materia.repository.ts` | implement enriched method (include + orderBy + `studentIds?` filter) |
| Use case (general) | `api/src/application/asistencia/list-general-attendance.use-case.ts:50` | call `findByScopeAndMonthEnriched`; return `EnrichedGeneralAttendance[]` |
| Use case (materia) | `api/src/application/asistencia/list-subject-attendance.use-case.ts:64` | call `findByScopeAndMonthEnriched`; return `EnrichedMateriaAttendance[]` |
| DTOs | `api/src/presentation/asistencia/dto/asistencia.dto.ts:76,85` | add `studentName: string` to both responses |
| Controller mappers | `api/src/presentation/asistencia/asistencia.controller.ts:229,240` | mappers take `(row, studentName)`; list passes enriched name; record passes `''` |
| Controller list handlers | `asistencia.controller.ts:123,186` | `rows.map(e => toGeneralResponse(e.attendance, e.studentName))` |
| Frontend row types | `web/src/pages/dashboard/asistencia-mensual.tsx:60-76` | add `studentName: string` to both row interfaces |
| Frontend grid cell | `asistencia-mensual.tsx:543` | render `row.studentName` (materia path shares same `<td>`) |
| Frontend pre-selection | `asistencia-mensual.tsx:158-176` | add `useSearchParams`, param-keyed effect, guard ref |
| Panel button | `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx` | gated `useNavigate` button using `ccId` prop |

Note: line 543 renders one shared `<td>{row.studentId}` for both modes (the grid maps over `AnyRow`), so a single edit fixes both General and Por-Materia.

## 6. TDD impact (Strict TDD active — test first)

**Backend — new test files:**
- `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-general.repository.test.ts` (NEW): `findByScopeAndMonthEnriched` issues `include: { student: { select } }`, `orderBy` lastName→firstName, maps to `{ attendance, studentName: "Apellido, Nombre" }`. Mock `TenantContext.getClient()`.
- `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-asistencia-materia.repository.test.ts` (NEW): same + `studentIds?` filter still applied.

**Backend — update existing:**
- `api/src/application/asistencia/__tests__/list-general-attendance.use-case.test.ts`: mock `findByScopeAndMonthEnriched` returning wrappers; assert use case returns enriched array; auth assertions unchanged.
- `api/src/application/asistencia/__tests__/list-subject-attendance.use-case.test.ts`: same; keep grupoId-filter assertions (now against the enriched method).
- `api/src/presentation/asistencia/__tests__/asistencia.controller.test.ts`: list responses include `studentName` in `"Apellido, Nombre"` format; PATCH `/dia` response includes `studentName: ''` (documented per ADR-5).

**Frontend:**
- `web/src/pages/dashboard/__tests__/asistencia-mensual.test.tsx` (update): fixtures add `studentName`; assert the grid renders `studentName` (not the UUID) in both modes; assert pre-selection — render under a router with `initialEntries: ['/asistencia-mensual?ccId=CC2']`, assert `cc-selector` value === `CC2`, mode general, rows loaded for CC2; assert no-param path still auto-selects first CC.
- `web/src/pages/dashboard/components/__tests__/AlumnosCursoCicloPanel.test.tsx` (NEW): button renders when `can('ATTENDANCE','READ')` is true; hidden when false; click calls `navigate('/asistencia-mensual?ccId=<ccId>')` (mock `useNavigate` + `useCan`/`useAuth`).

**Out of scope to break:** `api/test/integration/asistencia/*.db.test.ts` keep using `findByScopeAndMonth` (unchanged) — they stay green.

## 7. Confirmations
- **No migration:** both Prisma models already declare `student Student @relation(...)` (schema 1353, 1375).
- **Guards unchanged:** list endpoints already `@Roles('ROOT', { module: 'ATTENDANCE', action: 'READ' })`; Door-2 logic in use cases untouched.
- **Format inconsistency with `findByCourseCycleEnriched` is intentional** (ADR-4).
</content>
</invoke>
