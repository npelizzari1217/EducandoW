# Delta Spec: homeroom-titular-source

> Change: retiro-homeroom-titular-s3a
> Phase: sdd-spec · Store: hybrid · 2026-06-17
> Scope: Migrate homeroom resolution in `ListTeacherCourseCyclesUseCase` from legacy `Teacher` path to `AsignacionCursoXCiclo(rol=TITULAR)`.

---

## 1. Context

`ListTeacherCourseCyclesUseCase` exposes two modes: `subject` and `homeroom`.
Subject mode already resolves via `DocenteXCiclo`. This spec covers only the homeroom branch migration.
No product decision is required — this is a technical migration.

---

## 2. Delta Requirements

The keywords MUST, MUST NOT, SHALL, SHOULD, and MAY are used as defined in RFC 2119.

### 2.1 Homeroom resolution path (replaces legacy path)

**REQ-01** — After S3a, the homeroom branch of `ListTeacherCourseCyclesUseCase` MUST resolve course-cycles exclusively via the following path:
`userId → DocenteXCiclo(active=true) → AsignacionCursoXCiclo(rol=TITULAR) → courseCycleId[]`

**REQ-02** — The homeroom branch MUST NOT read the `Teacher` table. Specifically:
- `teacherRepo.findByUserId` MUST NOT be called in homeroom mode.
- `courseCycleRepo.findByHomeroomTeacher` MUST NOT be called in homeroom mode.

**REQ-03** — The resolution MUST be scoped to the tenant Prisma client. Cross-tenant queries are not permitted.

**REQ-04** — The homeroom branch MUST apply the existing Primario decade filter after resolving the course-cycles from TITULAR assignments, preserving the same filter semantics as before.

**REQ-05** — The homeroom branch MUST pass the resolved `courseCycleId[]` list to `CourseCycleRepository.findByUuids`. If the list is empty, `findByUuids` returns `[]` and the use-case returns `[]` without error.

### 2.2 Empty-result behavior

**REQ-06** — When a `userId` has no active `DocenteXCiclo` record, or has active `DocenteXCiclo` records but none are linked to an `AsignacionCursoXCiclo` with `rol=TITULAR`, the use-case MUST return `[]`. It MUST NOT throw or propagate an error.

**REQ-07** — The empty-result behavior MUST be indistinguishable from the pre-S3a behavior when no `Teacher` record existed for the given `userId`.

### 2.3 New port method

**REQ-08** — `AsignacionCursoXCicloRepository` MUST expose a method with the signature:
```
findTitularCourseIdsByUser(userId: string): Promise<string[]>
```
The returned array MUST contain deduplicated `courseCycleId` UUIDs. It MUST return `[]` (not throw) when no matching rows exist.

### 2.4 Removed port method

**REQ-09** — `CourseCycleRepository.findByHomeroomTeacher` MUST be removed from the port and its Prisma implementation. After S3a there are zero callers; its presence is dead code.

### 2.5 Dependency injection

**REQ-10** — `TeacherRepository` MUST NOT be provided or injected into `CourseCycleModule` after S3a.

**REQ-11** — `PrismaAsignacionCursoXCicloRepository` MUST be registered directly in the `providers` array of `CourseCycleModule`. It MUST NOT be imported via `AsignacionCursoModule` to avoid circular dependency (R5).

### 2.6 Output contract (preserved — no change)

**REQ-12** — The return type of the use-case MUST remain `Array<{ cycle: CourseCycle; modality: number | null }>` for both subject and homeroom modes. No field may be added, removed, or renamed.

**REQ-13** — The HTTP contract `GET /course-cycles?teacherUserId=...&role=homeroom` MUST remain unchanged: same query parameters, same response shape, same HTTP status codes.

### 2.7 Subject mode (unchanged)

**REQ-14** — The subject branch of `ListTeacherCourseCyclesUseCase` MUST NOT be modified. Its behavior, dependencies, and tests are out of scope for S3a.

### 2.8 Schema (no change)

**REQ-15** — The `CourseCycle.homeroomTeacherId` column, its foreign key, and its index MUST remain in the database schema after S3a. The drop is deferred to a subsequent slice.

### 2.9 Operational precondition (non-code)

**REQ-16 (operational)** — Before deploying S3a to production, operators MUST verify the skip count produced by the Fase 4 backfill script (`backfill-asignacion-curso.ts`) per tenant. A skipped course-cycle (logged with ⚠️ due to `Teacher.userId=null` or missing `DocenteXCiclo`) will produce an empty homeroom navigation for that CC (silent degradation, not an error). This degradation is accepted and documented; no code-level guard is required.

---

## 3. Acceptance Scenarios

### Scenario A — Happy path: user is TITULAR of multiple CCs

```
Given a tenant with three CourseCycles (CC-1, CC-2, CC-3)
  And CC-1 and CC-2 have AsignacionCursoXCiclo(rol=TITULAR, docenteXCiclo.userId=U1, docenteXCiclo.active=true)
  And CC-3 has no TITULAR assignment for U1
  And CC-1 and CC-2 pass the Primario decade filter
When ListTeacherCourseCyclesUseCase is called with (userId=U1, mode='homeroom')
Then the use-case returns exactly [{cycle: CC-1, modality: ...}, {cycle: CC-2, modality: ...}]
  And the Teacher table is not queried
  And no error is thrown
```

### Scenario B — No TITULAR assignment: returns empty array

```
Given a tenant where userId=U2 has active DocenteXCiclo records
  But none are linked to AsignacionCursoXCiclo(rol=TITULAR)
When ListTeacherCourseCyclesUseCase is called with (userId=U2, mode='homeroom')
Then the use-case returns []
  And no error is thrown
  And the Teacher table is not queried
```

### Scenario C — No DocenteXCiclo record: returns empty array

```
Given a tenant where userId=U3 has no DocenteXCiclo records at all
When ListTeacherCourseCyclesUseCase is called with (userId=U3, mode='homeroom')
Then the use-case returns []
  And no error is thrown
```

### Scenario D — TITULAR CC filtered out by decade: returns empty array

```
Given a tenant where userId=U4 has AsignacionCursoXCiclo(rol=TITULAR) for CC-5
  And CC-5 does NOT pass the Primario decade filter
When ListTeacherCourseCyclesUseCase is called with (userId=U4, mode='homeroom')
Then the use-case returns []
  And no error is thrown
```

### Scenario E — DocenteXCiclo exists but is inactive: treated as no assignment

```
Given a tenant where userId=U5 has a DocenteXCiclo record with active=false
  And that record is linked to AsignacionCursoXCiclo(rol=TITULAR) for CC-6
When ListTeacherCourseCyclesUseCase is called with (userId=U5, mode='homeroom')
Then the use-case returns []
  And CC-6 is not included in the response
```

### Scenario F — Subject mode: unaffected by S3a

```
Given any valid userId with DocenteXCiclo records in subject assignments
When ListTeacherCourseCyclesUseCase is called with (userId, mode='subject')
Then the subject branch executes without change
  And no TITULAR query is performed
```

### Scenario G — Multitenant isolation

```
Given the same userId=U6 exists in tenants T-A and T-B
  And U6 has TITULAR assignment for CC-7 in T-A only
When the use-case is called for T-A with (userId=U6, mode='homeroom')
Then CC-7 is returned
When the use-case is called for T-B with (userId=U6, mode='homeroom')
Then [] is returned
  And no cross-tenant data leaks
```

---

## 4. Explicitly Out of Scope

- Drop of `CourseCycle.homeroomTeacherId` (column, FK, index): deferred slice.
- Any change to `/teachers` admin CRUD endpoints.
- `MesaExamen.presidenteId` / `ActaExamen.presidenteId` FK behavior.
- Frontend code changes.
- Backfill script (`backfill-asignacion-curso.ts`): already executed in Fase 4.
- Schema migrations of any kind.

---

## 5. Assumptions Forced by Proposal Ambiguities

| # | Assumption | Source |
|---|-----------|--------|
| A1 | `findByUuids([])` returns `[]` without hitting the DB — treating this as a known contract from the explore artifact. | explore.md: "ya existe, maneja `[]`" |
| A2 | Deduplication of `courseCycleId` is done at the repo method level (not in the use-case) to keep the use-case branch agnostic to duplicate UUIDs. | proposal.md: "dedup de UUIDs" |
| A3 | The Primario decade filter logic is unchanged and lives downstream of `findByUuids` — spec does not prescribe its implementation. | proposal.md: "filtro década + findGradingContextsByUuids + map" |
