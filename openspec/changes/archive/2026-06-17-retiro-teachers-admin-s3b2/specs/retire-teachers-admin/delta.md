# Delta Spec: Retire `/teachers` Admin CRUD — S3b-2

> Phase: sdd-spec · Store: hybrid · 2026-06-17
> Change: retiro-teachers-admin-s3b2 · Approach A

---

## Scope Statement

This spec describes **what MUST be true** after the `/teachers` admin CRUD is
retired from the API and web layers. It does NOT prescribe implementation order
or internal structure. The Teacher Prisma model, domain entity, repository
interface, and the `TEACHERS` module-permission record are intentionally out of
scope for removal in this change.

---

## RFC 2119 Key Words

The key words MUST, MUST NOT, SHALL, SHOULD, and MAY in this document are to
be interpreted as described in RFC 2119.

---

## REQ-1 — API: `/teachers` endpoints are removed

**MUST** — All five `/teachers` REST endpoints (POST, GET collection, GET by
id, PATCH, DELETE) MUST return HTTP 404 after this change is applied. No
routing registration for `/teachers` SHALL exist in the NestJS application.

### Acceptance Scenarios

**SC-1.1 — POST /teachers returns 404**

Given the NestJS application has started successfully  
When a client sends `POST /teachers` with a valid JSON body  
Then the server MUST respond with HTTP 404  
And the response MUST NOT reach any controller handler  

**SC-1.2 — GET /teachers returns 404**

Given the NestJS application has started successfully  
When a client sends `GET /teachers`  
Then the server MUST respond with HTTP 404  

**SC-1.3 — GET /teachers/:id returns 404**

Given the NestJS application has started successfully  
When a client sends `GET /teachers/some-uuid`  
Then the server MUST respond with HTTP 404  

**SC-1.4 — PATCH /teachers/:id returns 404**

Given the NestJS application has started successfully  
When a client sends `PATCH /teachers/some-uuid` with a JSON body  
Then the server MUST respond with HTTP 404  

**SC-1.5 — DELETE /teachers/:id returns 404**

Given the NestJS application has started successfully  
When a client sends `DELETE /teachers/some-uuid`  
Then the server MUST respond with HTTP 404  

---

## REQ-2 — API: NestJS teacher module artifacts are removed

**MUST** — The following source files MUST NOT exist in the API workspace after
this change:

- `teacher.controller.ts`
- `teacher.module.ts`
- `dto/create-teacher.dto.ts`
- `dto/update-teacher.dto.ts`
- `application/teacher/use-cases/teacher.use-cases.ts`
- `infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts`
- `infrastructure/persistence/prisma/repositories/prisma-teacher.repository.spec.ts`

**MUST** — `app.module.ts` MUST NOT import `TeacherModule` in its `imports[]`
array. No other module or provider in the DI graph MUST reference
`TeacherModule` or any of its providers.

**MUST NOT** — There MUST NOT be any dangling dependency injection reference to
removed artifacts. `pnpm --filter api typecheck` MUST report zero new TypeScript
errors introduced by this change.

### Acceptance Scenarios

**SC-2.1 — TeacherModule absent from app.module.ts**

Given the file `app.module.ts` is read  
When its `imports[]` array is inspected  
Then `TeacherModule` MUST NOT appear as an entry  

**SC-2.2 — Removed files do not exist**

Given the API workspace source tree is inspected  
When searching for any of the seven listed file names  
Then none of those files MUST be found in any subdirectory of `api/src/`  

**SC-2.3 — No dangling DI**

Given `pnpm --filter api typecheck` is run after the files are removed  
When the TypeScript compiler resolves all imports and decorators  
Then zero errors MUST be reported that were not present before this change  

---

## REQ-3 — Web: `/teachers` page, route, and sidebar entry are removed

**MUST** — The file `pages/dashboard/teachers.tsx` MUST NOT exist in the web
workspace after this change.

**MUST** — The `/teachers` client-side route MUST NOT be registered in
`App.tsx`. Any import of the teachers page component in `App.tsx` MUST be
removed.

**MUST** — The "Docentes" navigation entry that links to `/teachers` MUST NOT
appear in `components/layout/sidebar.tsx`. No link, anchor, or navigation item
that targets the path `/teachers` SHALL remain in the sidebar.

### Acceptance Scenarios

**SC-3.1 — teachers.tsx page does not exist**

Given the web workspace source tree is inspected  
When searching for `pages/dashboard/teachers.tsx`  
Then that file MUST NOT be found  

**SC-3.2 — No /teachers route in App.tsx**

Given the file `App.tsx` is read  
When its route definitions and imports are inspected  
Then no `Route` or dynamic import referencing the path `/teachers` or the
teachers page component MUST appear  

**SC-3.3 — No Docentes→/teachers entry in sidebar**

Given the file `components/layout/sidebar.tsx` is read  
When its navigation items are inspected  
Then no entry with the target path `/teachers` MUST appear  

---

## REQ-4 — Prisma schema: Teacher model and all FK targets remain unchanged

**MUST** — The `Teacher` model in the tenant Prisma schema MUST remain exactly
as it was before this change. No field, relation, or index on `Teacher` SHALL be
removed, renamed, or altered.

**MUST NOT** — No SQL migration MUST be generated or applied as part of this
change. The database schema MUST be identical before and after.

**MUST** — The following FK relationships that reference `Teacher` MUST remain
intact and functional:
- `MesaExamen.presidenteId → Teacher.id`
- `ActaExamen.presidenteId → Teacher.id`
- `SubjectAssignment.teacherId → Teacher.id`

### Acceptance Scenarios

**SC-4.1 — No new Prisma migration file**

Given the `api/prisma_tenant/migrations/` directory is inspected after this
change  
When listing migration folders  
Then no new migration folder created by this change MUST be present  

**SC-4.2 — Teacher model unchanged in schema.prisma**

Given `api/prisma_tenant/schema.prisma` is read  
When the `Teacher` model block is inspected  
Then it MUST contain the same fields and relations as before this change  

**SC-4.3 — FK columns remain in dependent models**

Given the tenant Prisma schema is read  
When inspecting `MesaExamen`, `ActaExamen`, and `SubjectAssignment` models  
Then `presidenteId` (on mesa and acta) and `teacherId` (on SubjectAssignment)
MUST each reference the `Teacher` model  

---

## REQ-5 — TEACHERS module-permission record is preserved

**MUST** — The `TEACHERS` permission record in the master database MUST NOT be
deleted or altered. This record is consumed by `docente-ciclo.controller.ts`
via its `@Roles` guard (`{ module: 'TEACHERS', action: 'READ' }`).

**MUST** — `GET /docentes-x-ciclo` MUST continue to be accessible to roles that
hold the `TEACHERS:READ` permission after this change.

### Acceptance Scenarios

**SC-5.1 — /docentes-x-ciclo still enforces TEACHERS:READ guard**

Given a user with `TEACHERS:READ` permission  
When that user sends `GET /docentes-x-ciclo?cycleId=<valid-id>`  
Then the server MUST respond with HTTP 200 and the expected payload  

**SC-5.2 — /docentes-x-ciclo blocked for unauthorized users**

Given a user without `TEACHERS:READ` permission  
When that user sends `GET /docentes-x-ciclo?cycleId=<valid-id>`  
Then the server MUST respond with HTTP 401 or HTTP 403  

---

## REQ-6 — Domain Teacher entity and TeacherRepository interface may remain

**MAY** — The domain `Teacher` entity and the `TeacherRepository` interface MAY
remain as dead code in `packages/@educandow/domain` or `api/src/`. Their
presence is acceptable; their removal is deferred to S3b-final.

**MUST** — If these artifacts remain, they MUST NOT cause any TypeScript
compilation error when `pnpm --filter api typecheck` is run.

**MUST NOT** — Neither the `Teacher` entity nor the `TeacherRepository`
interface MUST be injected into any NestJS provider, module, or controller after
this change (since `TeacherModule` and all its providers are removed).

### Acceptance Scenarios

**SC-6.1 — Dead code does not cause typecheck failure**

Given the domain `Teacher` entity and `TeacherRepository` interface remain in
the codebase  
When `pnpm --filter api typecheck` is run  
Then zero TypeScript errors MUST be reported that originate from those files  

---

## REQ-7 — Docente management continuity via /users and /docentes-x-ciclo

**MUST** — After this change, persona docente management MUST be served
exclusively by:
- `POST /users` — creates a user with docente persona (UP-R1)
- `GET /users`, `PATCH /users/:id` — reads and updates docente persona
- `GET /docentes-x-ciclo?cycleId=` — lists enrolled docentes per cycle

This change MUST NOT add, alter, or remove any endpoint in the `/users` or
`/docentes-x-ciclo` surface. No new capability is introduced; the spec records
the retirement only.

### Acceptance Scenarios

**SC-7.1 — /users endpoints unaffected**

Given `POST /users`, `GET /users`, and `PATCH /users/:id` exist before this
change  
When this change is applied  
Then those three endpoints MUST continue to respond with the same HTTP status
codes and payload shapes as before  

**SC-7.2 — /docentes-x-ciclo unaffected**

Given `GET /docentes-x-ciclo` exists and returns enrolled docentes  
When this change is applied  
Then the endpoint MUST return the same data with the same shape as before  

---

## REQ-8 — R-GAP: known operational gap documented and accepted

**MUST** — After this change, no code path in the API MUST create new rows in
the `Teacher` table (the sole creator, `CreateTeacherUseCase`, is removed along
with its module).

**ACCEPTED GAP** — Creating a `MesaExamen` or `ActaExamen` with a
`presidenteId` that does not correspond to an existing `Teacher` row WILL be
rejected by the database (FK constraint violation). This is a known, accepted
operational window. It affects only new docentes (created via `/users` after
S3b-2 is deployed) when acting as `presidente`.

**MUST NOT** — This spec MUST NOT introduce any workaround, bypass, or
migration to close R-GAP. Resolution is deferred to S3b-3.

**SHOULD** — The known gap SHOULD be documented in the PR description and in
any relevant runbook so operations is aware.

### Acceptance Scenarios

**SC-8.1 — Existing Teacher rows still work as presidenteId**

Given a `Teacher` row exists in the tenant DB with id `existing-uuid`  
When `CreateMesaExamenUseCase` is called with `presidenteId: 'existing-uuid'`  
Then the mesa MUST be created successfully (no FK violation)  

**SC-8.2 — Non-existent presidenteId is rejected by the DB (gap)**

Given no `Teacher` row exists for id `new-user-uuid`  
When `CreateMesaExamenUseCase` is called with `presidenteId: 'new-user-uuid'`  
Then Postgres MUST raise a foreign key constraint violation  
And the use-case MUST propagate that error (no silent swallow)  
And this behavior is ACCEPTED until S3b-3  

---

## REQ-9 — Build integrity after removal

**MUST** — After all deletions and edits, the following commands MUST pass with
zero new failures:

| Command | Acceptance criterion |
|---|---|
| `pnpm --filter api typecheck` | Exit 0, zero new TS errors |
| `pnpm build` (monorepo) | Exit 0, all workspaces compiled |
| `pnpm test` (monorepo) | All previously passing tests still pass; test coverage MUST NOT drop below 80% in `api` |

**MUST NOT** — No test that existed before this change and was passing MUST be
left in a failing state because of this change (deleted files reduce test count,
but remaining tests MUST stay green).

### Acceptance Scenarios

**SC-9.1 — Typecheck passes**

Given all seven API files are deleted and `app.module.ts` is edited  
When `pnpm --filter api typecheck` is run  
Then the exit code MUST be 0  

**SC-9.2 — Full build passes**

Given all deletions and edits are applied  
When `pnpm build` is run from monorepo root  
Then the exit code MUST be 0 for every workspace  

**SC-9.3 — Remaining tests pass**

Given all deletions and edits are applied  
When `pnpm test` is run  
Then no previously-passing test MUST fail  
And `api` coverage MUST remain ≥ 80%  

---

## Out of Scope (deferred)

| Item | Deferred to |
|---|---|
| Close R-GAP: migrate `presidenteId` FK → User | S3b-3 |
| Delete domain `Teacher` entity + `TeacherRepository` interface | S3b-final |
| Drop `Teacher` table + Prisma model | S3b-final |

---

## Summary Checklist

- [ ] REQ-1: `/teachers` (POST/GET/GET:id/PATCH/DELETE) → 404
- [ ] REQ-2: 7 API files deleted; `TeacherModule` removed from `app.module.ts`; no dangling DI
- [ ] REQ-3: `teachers.tsx` deleted; route + sidebar entry removed
- [ ] REQ-4: Prisma `Teacher` model unchanged; no migration; all FKs intact
- [ ] REQ-5: `TEACHERS` module-permission preserved; `/docentes-x-ciclo` guard works
- [ ] REQ-6: Domain dead code (if kept) causes zero TS errors
- [ ] REQ-7: `/users` + `/docentes-x-ciclo` unaffected
- [ ] REQ-8: R-GAP documented, no workaround introduced
- [ ] REQ-9: `typecheck` + `build` + `test` pass; coverage ≥ 80%
