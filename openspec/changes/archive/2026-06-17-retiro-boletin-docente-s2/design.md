# Design: retiro-boletin-docente-s2

> Fase: sdd-design · Store: hybrid · 2026-06-17
> S2 de `retiro-teacher-legacy`. Approach B (student-scoped, bulk IN). Single PR.

## Executive summary

Source `docente` from the new model (`DocenteXCiclo` → master `User`) instead of the legacy `Teacher` table, removing the **last live reader of `Teacher`** from `generate-boletin.use-case.ts`. Primario/Secundario drop their `subjectAssignment` query entirely (`docente=''`, no render). The legacy Inicial/Terciario branch KEEPS `subjectAssignment` for the subject list + `NotaTrimestral` join, drops only the `teacher` include, and resolves `docente` for Inicial via a new private bulk resolver.

## ⚠️ STOP-and-report: explore/proposal mischaracterize the legacy site

The explore and proposal treat lines 223–226 as "the teacher lookup". **That is incorrect and load-bearing.** In the legacy `buildMaterias` else-branch (lines 204–283), `subjectAssignment.findMany` is the BACKBONE of the entire Inicial+Terciario path:

| Produced by `subjectAssignment` | Consumed as | Renders? |
|---|---|---|
| `assignment.subject.name` | `materia.nombre` (subject list itself) | Inicial + Terciario |
| `assignment.id` → `NotaTrimestral.assignmentId` | `notas`/`promedio`/`valoracion`/`aprobado` | Terciario (`promedio`,`valoracion`,`aprobado`), Inicial (`valoracion`) |
| `assignment.teacher` | `docente` | Inicial only |

Confirmed in schema: `NotaTrimestral` (schema.prisma:680) has **no `subjectId`** — its only FK is `assignmentId → SubjectAssignment.id` (line 693). Confirmed in templates: `boletin-terciario.hbs` renders `{{promedio}}/{{valoracion}}/{{aprobado}}` (no `docente`); `boletin-inicial.hbs` renders `{{nombre}}/{{docente}}/{{valoracion}}` (line 48–50).

**Consequence:** removing `subjectAssignment` from the legacy branch would erase the entire materia list AND all grades for Inicial and Terciario — a catastrophic regression, not a blank `docente` cell. Therefore:

- The proposal's success criterion "**cero referencias a `subjectAssignment` en NINGUNA rama**" and "deja la tabla sin consumidores de aplicación" is **NOT achievable in S2**. `subjectAssignment` stays as the subject/grade backbone for Inicial/Terciario until their grading migrates off `NotaTrimestral` (out of S2 scope).
- **What S2 actually delivers (the true `retiro-teacher-legacy` goal):** remove every read of the legacy `Teacher` table. The boletín is the last reader (`include/select: { teacher }`). After S2 nothing reads `Teacher`. That unblocks **S3's drop of `Teacher`** (and the `teacherId` FK column on `SubjectAssignment`) — NOT the drop of `SubjectAssignment` itself.
- **S3 premise must be corrected**: S3 can archive+drop `Teacher`; it CANNOT drop `SubjectAssignment` while Inicial/Terciario still read it. A future stage (migrate Inicial/Terciario grading off `NotaTrimestral`) is the real precondition for dropping `SubjectAssignment`.

This does not block S2 implementation; it corrects the epic's framing and the S3 scope.

## Decision 1 — Branch map (precise)

Dispatch in `buildMaterias` (use-case lines 178–284) keyed on `Math.floor(level/10)`:

| Branch | Level | `subjectAssignment` after S2 | `docente` source | Renders docente? |
|---|---|---|---|---|
| Primario (`buildMateriasPrimario`) | 2x | **REMOVED** (was teacher-only) | `''` | No |
| Secundario (`buildMateriasSecundario`) | 3x | **REMOVED** (was teacher-only) | `''` | No |
| Legacy → Inicial | 1x | **KEPT** for subjects+notas; `teacher` include dropped | **new-model resolver** | **Yes** |
| Legacy → Terciario | 4x | **KEPT** for subjects+notas; `teacher` include dropped | `''` (no resolver call) | No |

Terciario shares the legacy `buildMaterias` else-branch with Inicial (confirmed: both fall through Primario/Secundario guards). **Design decision (deviation from proposal P3):** the proposal suggested Terciario also resolve via the new model. Since `boletin-terciario.hbs` does NOT render `docente` (confirmed), resolving for Terciario is wasted I/O. We gate the resolver to Inicial only (`Math.floor(level/10) === 1`); Terciario gets `docente=''`. Visible output is identical; avoids N pointless query chains. If a future Terciario template wants `docente`, flip one boolean.

## Decision 2 — The bulk resolver (Approach B, student-scoped, per CC)

Private helper on `GenerateBoletinUseCase`. Keyed per **(student, CourseCycle)** — the boletín is single-student, so the student is fixed; the legacy branch already iterates `courseCycles`, so we call once per CC and merge into one `Map<subjectId, string>`.

```ts
/**
 * Resolves docente display names for ONE student within ONE CourseCycle,
 * via the new model (DocenteXCiclo → master User). Student-scoped (Approach B):
 * only the docentes of the grupos the student actually belongs to.
 * Co-docencia → names joined with " / "; docenteXCicloId deduped (dropped @@unique).
 * Returns subjectId → "Apellido, Nombre[ / Apellido2, Nombre2]". Missing → absent key.
 * 5 tenant IN-queries + 1 master IN-query. No per-subject query (no N+1).
 */
private async resolveDocentesForStudentCC(
  client: TenantPrismaClient,
  studentId: string,
  courseCycleId: string,            // CourseCycle.uuid
): Promise<Map<string, string>>      // subjectId → joined docente names
```

Ordered chain (queries 1–5 TENANT via `client`, query 6 MASTER):

1. **`client.materiaXCursoXCiclo.findMany`** `{ where: { courseCycleId }, select: { id, subjectId } }`
   → `subjectIdByMateriaId: Map<materiaId, subjectId>`. Empty ⇒ return `new Map()`.
2. **`client.alumnosXMateriaXCursoXCiclo.findMany`** `{ where: { materiaXCursoXCicloId: { in: [...materiaIds] }, studentId }, select: { id, materiaXCursoXCicloId } }`
   → student's memberships. `materiaIdByAlumnoMateriaId: Map<alumnoMateriaId, materiaId>`. Empty ⇒ return `new Map()`. (The `studentId` filter is what makes this student-scoped.)
3. **`client.alumnosXGrupoXCursoXMateriaXCiclo.findMany`** `{ where: { alumnosXMateriaXCursoXCicloId: { in: [...alumnoMateriaIds] } }, select: { grupoId, alumnosXMateriaXCursoXCicloId } }`
   → list of `{ grupoId, alumnoMateriaId }`. One membership may map to N grupos (co-docencia / materia partida). Empty ⇒ return `new Map()`.
4. **`client.grupoXCursoXMateriaXCiclo.findMany`** `{ where: { id: { in: [...grupoIds] } }, select: { id, docenteXCicloId } }`
   → `docenteXCicloIdByGrupoId: Map<grupoId, docenteXCicloId>`.
5. **`client.docenteXCiclo.findMany`** `{ where: { id: { in: [...dedupedDocenteXCicloIds] } }, select: { id, userId } }`
   → `userIdByDocenteXCicloId: Map<docenteXCicloId, userId>`. **Dedup `docenteXCicloId` before this query** (the `@@unique([materiaXCursoXCicloId, docenteXCicloId])` on `GrupoXCursoXMateriaXCiclo` was dropped — confirmed absent in schema, only two `@@index`).
6. **`this.prisma.getMasterClient().user.findMany`** `{ where: { id: { in: [...dedupedUserIds] } }, select: { id, firstName, lastName } }`
   → `nameByUserId: Map<userId, "Apellido, Nombre">` (`` `${lastName}, ${firstName}` ``). Mirrors `ListDocentesXCicloUseCase` exactly.

Assembly (in-memory, no queries):
- Build `subjectId → Set<docenteXCicloId>`: for each `{grupoId, alumnoMateriaId}` from #3 → `materiaId = materiaIdByAlumnoMateriaId.get(alumnoMateriaId)` → `subjectId = subjectIdByMateriaId.get(materiaId)` → `docId = docenteXCicloIdByGrupoId.get(grupoId)`; add `docId` to the set. The `Set` dedups co-docencia where the same `docenteXCicloId` recurs across grupos.
- For each `subjectId`: map its `docId`s → `userId` → name, drop nullish, **sort alphabetically** (deterministic, stable PDF output), `join(' / ')`. Only set the map entry if the joined string is non-empty. Subjects with 0 resolved docentes are simply absent (caller falls back to `''`).

## Decision 3 — Master/tenant boundary

Queries 1–5 use the tenant client passed in (`client`, = `TenantContext.getClient()` via `this.tenantClient()`). Query 6 uses `this.prisma.getMasterClient().user`. `userId` is a soft cross-DB reference (`DocenteXCiclo.userId`, schema:172 — no FK, AD-6). **No client mixing.** Identical to the established `ListDocentesXCicloUseCase` pattern. No new DI: `PrismaService` is already injected (constructor line 48); the tenant client is already available in every `buildMaterias*`.

## Decision 4 — Exact line changes (single file)

`api/src/application/reportes/generate-boletin.use-case.ts`:

1. **Legacy branch, line 223–226** — change `include: { subject: true, teacher: true }` → `include: { subject: true }` (keep subjects+notas join, drop the `Teacher` read).
2. **Legacy branch, after `courseCycles` fetch (~line 219), before materia loop** — add:
   ```ts
   const isInicial = Math.floor(enrollment.level / 10) === 1;
   const docenteBySubjectId = new Map<string, string>();
   if (isInicial) {
     for (const cc of courseCycles) {
       const m = await this.resolveDocentesForStudentCC(client, enrollment.studentId, cc.uuid);
       for (const [sid, name] of m) docenteBySubjectId.set(sid, name);
     }
   }
   ```
   (Requires selecting `uuid` on the `courseCycles` query at line 212 — currently `include:{course:true}`; add `uuid` availability. `courseCycle.uuid` is the model PK alias used throughout; confirm it's returned.)
3. **Legacy branch, materia loop line 275** — replace
   `` docente: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}`, ``
   → `docente: docenteBySubjectId.get(assignment.subjectId) ?? '',`.
4. **Primario, lines 324–336** — delete the `client.subjectAssignment.findMany` + `teacherBySubjectId` Map.
5. **Primario, lines 430–431** — replace `const teacher = teacherBySubjectId.get(subjectId); const docente = teacher ? \`...\` : '';` → `const docente = '';`.
6. **Secundario, lines 525–537** — delete the `client.subjectAssignment.findMany` + `teacherBySubjectId` Map.
7. **Secundario, lines 628–629** — `const docente = '';`.
8. **Add** the `resolveDocentesForStudentCC` private method (Decision 2).

Untouched: `MateriaBoletin.docente: string` type (no signature change), all `.hbs` templates, DI/constructor, every other branch/helper.

## Decision 5 — N+1 avoidance

Resolver runs **once per CourseCycle** for the single student (Inicial typically 1 CC ⇒ 6 queries total). Each step is a single bulk `IN` query; assembly is in-memory. **Zero per-subject queries.** Primario/Secundario/Terciario add **zero** new queries (Primario/Secundario lose one query each; Terciario unchanged). Matches explore's "6 bulk queries, no N+1".

## Decision 6 — Test strategy (TDD, Vitest, mocked clients)

Mock the tenant client (per-model `findMany`) and `prisma.getMasterClient().user.findMany`. Cases:

1. **Single docente** → `docente === "Apellido, Nombre"`.
2. **Co-docencia (2 grupos, 2 distinct docentes)** → `"A, X / B, Y"`, alphabetical, joined.
3. **Co-docencia, same `docenteXCicloId` across 2 grupos** → single name (asserts dedup; covers dropped `@@unique`).
4. **0 resolved (empty MateriaXCursoXCiclo / no grupo / docente without userId)** → `docente === ''` for that subject (Inicial P2 degradation).
5. **Primario** → all `docente === ''` AND assert `client.subjectAssignment.findMany` is **never called**.
6. **Secundario** → same as #5.
7. **Terciario (legacy)** → `docente === ''` AND assert the resolver's first query (`client.materiaXCursoXCiclo.findMany`) is **never called**; `subjectAssignment.findMany` **is** still called (subjects+notas backbone) but **without** `teacher` in the include.
8. **No-teacher-read guard** → assert no `subjectAssignment` query anywhere passes `teacher` in `include`/`select` (the core `retiro-teacher-legacy` invariant).

Refinement vs. the prompt's decision 6: the "assert `subjectAssignment` NOT queried" assertion applies to **Primario/Secundario only**. In the legacy branch `subjectAssignment` IS still queried (for subjects+notas) — the correct invariant there is "no `teacher` include".

## Decision 7 — Size / delivery

Single file + its test. Resolver ~50 lines; 7 edit sites net ≈ −15/+18; tests ~140 lines. Total ≈ 190 lines, well under the 400 budget. **Single PR confirmed; no chaining.**

## Risks (architectural)

- **R-EPIC (HIGH, framing): S3 cannot drop `SubjectAssignment`** — it remains the Inicial/Terciario subject+grade backbone via `NotaTrimestral.assignmentId`. S3 scope must be corrected to "drop `Teacher` table + `SubjectAssignment.teacherId` FK", not "drop `SubjectAssignment`". A separate stage must migrate Inicial/Terciario grading off `NotaTrimestral` before `SubjectAssignment` can go.
- **R1 (HIGH): Inicial blank** if the materia-grupo backfill hasn't run in a tenant (query #1/#2 empty) → deploy precondition (verify backfill per tenant). Accepted (P2).
- **R3 (MEDIUM): dedup** of `docenteXCicloId` mandatory (dropped `@@unique` confirmed). Covered by test #3.
- **R4 (MEDIUM): name divergence** — source moves from `Teacher` (tenant) to master `User`; can differ if `Teacher` was edited post-backfill. Accepted.
- **R-ASSUMPTION (LOW): Terciario never renders `docente`** — confirmed against current `boletin-terciario.hbs`. If the template changes, flip the resolver gate to include level 4x.
