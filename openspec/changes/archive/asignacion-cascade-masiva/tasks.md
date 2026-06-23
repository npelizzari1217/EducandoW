# Tasks — asignacion-cascade-masiva

> Delivery strategy: **auto-chain** — two chained PRs (PR-1 backend, PR-2 frontend).
> TDD is STRICT: within each task, write tests RED first, then implement GREEN, then run `pnpm test`.
> ADR-B3: bulk UC returns plain `BulkCascadeResult` (no `Result<T,E>`) — matches per-student slice style. Verify MUST NOT flag this as a blocker.

---

## Dependency graph

```
T-01 ──► T-02   (controller imports UC from T-01)
              │
              └──► T-03  (frontend calls endpoint registered in T-02)
```

T-01 and T-03 have no shared code dependency; however T-03 is placed after T-02 so the backend
endpoint is confirmed stable before frontend work begins (auto-chain order).

---

## PR-1 — Backend (T-01 + T-02) — Est. ~370 lines

### T-01 — Bulk cascade use case (RED → GREEN)

**Status:** [x] done  
**Spec requirements:** SC-01, SC-02, SC-03, SC-04, SC-05, SC-09, SC-10  
**Parallel with:** none (foundational — must go first)

#### Files

| Action | Path |
|--------|------|
| CREATE | `api/src/application/course-cycle/__tests__/cascade-all-students-materias-competencias.use-case.test.ts` |
| CREATE | `api/src/application/course-cycle/cascade-all-students-materias-competencias.use-case.ts` |

#### Steps (in order)

1. **RED** — Write the test file with all 8 cases using the same mock-repo + `Object.create` pattern as `cascade-student-materias-competencias.use-case.test.ts`:

   | Case | Assert |
   |------|--------|
   | BULK-01 empty rows | `findByCourseCycle` returns `[]` → all-zero result; `findByCourseCycleId` NOT called |
   | BULK-02 zero materias | rows > 0 but `findByCourseCycleId` returns `[]` → `studentsProcessed = rows.length`, create/skip = 0; `upsertMany`/`bulkCreate` never called |
   | BULK-03 happy N×M×K | 2 students × 2 materias × 2 competencies → counts = 2×2 materias + 2×2 competencias; `findByCourseCycleId` called **once**, `findActiveByStudyPlanSubject` called once per unique SPS (not per student) |
   | BULK-04 idempotent | `upsertMany` returns `{ count: 0 }`, `bulkCreate` returns `{ count: 0 }` → `*Skipped` = totals |
   | BULK-05 optativa filter | materias mix: 1 optativa + 1 non-optativa → only non-optativa included; optativa's SPS NOT passed to competency fetch |
   | BULK-06 all-optativa | all materias are optativa → `studentsProcessed = rows.length`, all create/skip = 0, no writes |
   | BULK-07 best-effort partial failure | 3 students; student B's `upsertMany` throws → `studentsFailed = 1`, `studentsProcessed = 2`; A and C rows are created; loop does NOT abort |
   | BULK-08 grade preservation | `bulkCreate` is called with `CompetenciaXMateriaXAlumnoXCursoXCiclo` entities only; no calls to any `CompetenciaPeriodo` repo; spy on the 5 repos and assert the 5th (competenciaRepo) is only invoked via `bulkCreate` |

2. **Run** `pnpm test` → all 8 cases fail (RED confirmed).

3. **GREEN** — Implement `cascade-all-students-materias-competencias.use-case.ts`:
   - Export `BulkCascadeResult` interface (6 numeric fields, declared in this file).
   - `@Injectable()` class `CascadeAllStudentsMateriasCompetenciasUseCase`.
   - Constructor: same 5 ports as per-student UC (same order).
   - `execute({ ccId })`:
     1. `rows = await alumnosCCRepo.findByCourseCycle(ccId)` — if empty → all-zero result.
     2. `materias = (await materiaRepo.findByCourseCycleId(ccId)).filter(m => !m.esOptativa)` — if empty → `{ studentsProcessed: rows.length, studentsFailed: 0, ...zeros }`.
     3. `uniqueSpsIds`, `Promise.all(findActiveByStudyPlanSubject)`, flatten → `allCompetencies`. If none → proceed (materias will still upsert; competencias will be 0).
     4. Accumulator vars: `studentsProcessed=0, studentsFailed=0, materiasCreated=0, ...`.
     5. `for (const row of rows)` → `try { upsertMany; bulkCreate; studentsProcessed++ } catch { studentsFailed++; Logger.warn(...) }`.
     6. Return accumulated result.
   - No `NotFoundError` at top level (unknown ccId → 0 rows → zeros; ADR-B3).

4. **Run** `pnpm test` → all 8 cases pass (GREEN confirmed).

5. **Commit:** `feat(cascade): add CascadeAllStudentsMateriasCompetenciasUseCase`

---

### T-02 — Bulk cascade endpoint + module wiring (RED → GREEN)

**Status:** [x] done  
**Spec requirements:** SC-06, SC-07, SC-08  
**Depends on:** T-01 (imports `CascadeAllStudentsMateriasCompetenciasUseCase`)  
**Parallel with:** none

#### Files

| Action | Path |
|--------|------|
| MODIFY | `api/src/presentation/course-cycle-alumnos/__tests__/alumnos-x-curso-x-ciclo.controller.spec.ts` |
| MODIFY | `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts` |
| MODIFY | `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts` |

#### Steps (in order)

1. **RED** — Extend `alumnos-x-curso-x-ciclo.controller.spec.ts`:

   Extend `makeController()` to also accept `bulkCascadeUC` with a default `vi.fn()`.

   | Case | Assert |
   |------|--------|
   | C-12 cascadeAll happy path | `ctrl.cascadeAll('cc-1')` calls `bulkCascadeUC.execute({ ccId: 'cc-1' })`; returns `{ data: BulkCascadeResult }` |
   | C-13 route-order assertion | Use `Reflect.getMetadata('path', AlumnosXCursoXCicloController.prototype, 'cascadeAll')` and `Reflect.getMetadata('path', AlumnosXCursoXCicloController.prototype, 'cascade')` plus method enumeration order (or use NestJS metadata key `'__routeArguments__'`) to assert `cascadeAll` method is declared before `cascade` in the prototype |

   Note on C-13: NestJS does not expose a simple "route order" metadata API. Acceptable approach: parse the controller prototype's method-descriptor order with `Object.getOwnPropertyNames(AlumnosXCursoXCicloController.prototype)` and assert `cascadeAll` comes before `cascade` in that array. This documents the ordering contract.

2. **Run** `pnpm test` → C-12, C-13 fail (RED).

3. **GREEN** — Modify `alumnos-x-curso-x-ciclo.controller.ts`:
   - Add import: `CascadeAllStudentsMateriasCompetenciasUseCase, type BulkCascadeResult` from the new UC file.
   - Add `private readonly bulkCascadeUC: CascadeAllStudentsMateriasCompetenciasUseCase` to constructor (after `cascadeUC`).
   - Add `cascadeAll` handler **immediately before** the existing `cascade` handler:
     ```ts
     @Post('course-cycles/:ccId/alumnos/cascade')
     @HttpCode(HttpStatus.OK)
     @Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
     async cascadeAll(
       @Param('ccId') ccId: string,
     ): Promise<{ data: BulkCascadeResult }> {
       const data = await this.bulkCascadeUC.execute({ ccId });
       return { data };
     }
     ```
   - Critical: `cascadeAll` MUST appear before `cascade` in the source file (ADR-B5, SC-06).

4. **GREEN** — Modify `alumnos-x-curso-x-ciclo.module.ts`:
   - Add import for `CascadeAllStudentsMateriasCompetenciasUseCase`.
   - Add `useFactory` provider (same pattern as `CascadeStudentMateriasCompetenciasUseCase`, same 5 inject tokens):
     ```ts
     {
       provide: CascadeAllStudentsMateriasCompetenciasUseCase,
       useFactory: (alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo) =>
         new CascadeAllStudentsMateriasCompetenciasUseCase(
           alumnosCCRepo, materiaRepo, alumnosXMateriaRepo, competencyRepo, competenciaRepo,
         ),
       inject: [
         PrismaAlumnosXCursoXCicloRepository,
         PrismaMateriaXCursoXCicloRepository,
         PrismaAlumnosXMateriaRepository,
         PrismaSubjectCompetencyRepo,
         PrismaCompetenciaXMateriaXAlumnoXCursoXCicloRepo,
       ],
     }
     ```
   - No new imports of Prisma repos needed — all 5 are already in `providers`.

5. **Run** `pnpm test` → C-12, C-13 pass; full suite green.

6. **Run** `pnpm build` → no TypeScript errors.

7. **Commit:** `feat(cascade): expose POST /course-cycles/:ccId/alumnos/cascade endpoint`

---

## PR-2 — Frontend (T-03) — Est. ~200 lines

> PR-2 can be opened once PR-1 is merged. The frontend calls the endpoint URL as a string — no
> TypeScript import from the backend — so compilation is independent.

### T-03 — Frontend bulk cascade button (RED → GREEN)

**Status:** [x] done  
**Spec requirements:** SC-11, SC-12, SC-13, SC-14, SC-15  
**Depends on:** T-02 (endpoint must exist before QA validation)  
**Parallel with:** none

#### Files

| Action | Path |
|--------|------|
| MODIFY | `web/src/pages/dashboard/__tests__/course-cycles.test.tsx` |
| MODIFY | `web/src/pages/dashboard/course-cycles.tsx` |

#### Steps (in order)

1. **RED** — Extend `course-cycles.test.tsx`:

   Set up `mockGet` to return at least one CC row (e.g. `uuid: 'cc-1'`) so the row actions render.
   Set up `mockPost` to return `{ data: { data: { studentsProcessed: 3, studentsFailed: 0, materiasCreated: 6, materiasSkipped: 0, competenciasCreated: 12, competenciasSkipped: 0 } } }` for `/course-cycles/cc-1/alumnos/cascade`.

   | Case | Assert |
   |------|--------|
   | W-19 confirm opens | Click "Asignar materias y competencias" → confirmation Modal appears; `mockPost` NOT called yet |
   | W-20 confirm fires POST | Click confirm in dialog → `mockPost` called with `/course-cycles/cc-1/alumnos/cascade` |
   | W-21 in-flight disabled | While `mockPost` is pending, button has `disabled` attribute; after resolution it is re-enabled |
   | W-22 success toast | After success response, toast contains "3" (studentsProcessed) and "6" (materiasCreated) counts |
   | W-23 error toast | `mockPost` rejects → error toast appears; button re-enabled |
   | W-24 always-enabled | Button is NOT disabled when the CC row has no `alumnosCount` / `alumnosCount === 0`; only disabled in-flight |

2. **Run** `pnpm test` → W-19..W-24 fail (RED).

3. **GREEN** — Modify `course-cycles.tsx`:
   - Add state: `const [cascadingBulkCcId, setCascadingBulkCcId] = useState<string | null>(null)`.
   - Add state: `const [confirmCascadeCcId, setConfirmCascadeCcId] = useState<string | null>(null)`.
   - Implement `handleBulkCascade(ccId: string)`:
     ```ts
     const handleBulkCascade = async (ccId: string) => {
       setConfirmCascadeCcId(null);
       setCascadingBulkCcId(ccId);
       try {
         const res = await apiClient.post(`/course-cycles/${ccId}/alumnos/cascade`);
         const r = res.data.data;
         const msg = `${r.studentsProcessed} alumno(s): ${r.materiasCreated} materia(s) y ${r.competenciasCreated} competencia(s) asignadas` +
           (r.studentsFailed > 0 ? ` — ${r.studentsFailed} con error` : '');
         setToast({ message: msg, type: 'success' });
       } catch {
         setToast({ message: 'Error al asignar materias y competencias', type: 'error' });
       } finally {
         setCascadingBulkCcId(null);
       }
     };
     ```
   - Add "Asignar materias y competencias" Button in row actions (adjacent to Materias/Alumnos/Editar/Eliminar):
     ```tsx
     <Button
       variant="action"
       size="sm"
       loading={cascadingBulkCcId === cc.uuid}
       disabled={cascadingBulkCcId === cc.uuid}
       onClick={() => setConfirmCascadeCcId(cc.uuid)}
     >
       Asignar materias y competencias
     </Button>
     ```
   - Add confirm Modal (reuse existing `Modal` component):
     ```tsx
     <Modal
       open={!!confirmCascadeCcId}
       title="Asignar materias y competencias"
       onClose={() => setConfirmCascadeCcId(null)}
     >
       <p>Esto asignará materias y competencias a TODOS los alumnos del curso. ¿Continuar?</p>
       <div style={{ display: 'flex', gap: 'var(--space-xs)', justifyContent: 'flex-end', marginTop: '1rem' }}>
         <Button variant="secondary" size="sm" onClick={() => setConfirmCascadeCcId(null)}>Cancelar</Button>
         <Button variant="primary" size="sm" onClick={() => confirmCascadeCcId && handleBulkCascade(confirmCascadeCcId)}>
           Confirmar
         </Button>
       </div>
     </Modal>
     ```

4. **Run** `pnpm test` → W-19..W-24 pass; full suite green.

5. **Commit:** `feat(cascade): add bulk cascade button in course-cycles page`

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| New files | 2 (UC impl + UC test) |
| Modified files | 5 (controller, controller spec, module, frontend page, frontend test) |
| Estimated lines — T-01 | ~270 (test ~150 + impl ~120) |
| Estimated lines — T-02 | ~100 (controller +35, spec +50, module +15) |
| Estimated lines — T-03 | ~200 (frontend test +120, page +80) |
| **Total estimated lines** | **~570** |
| PR-1 (T-01 + T-02) | ~370 lines — under 400 budget |
| PR-2 (T-03) | ~200 lines — under 400 budget |
| Chained PRs recommended | **Yes** (total > 400) |
| 400-line budget risk per PR | **Low** (PR-1 ~370, PR-2 ~200) |
| Decision needed before apply | **No** — auto-chain strategy already resolved |
| Schema / migration | None |
| New repo methods | None |

**Recommended chain:** `feat/asignacion-cascade-masiva-backend` → merge → `feat/asignacion-cascade-masiva-frontend`.

---

## ADR cross-references (do not "fix" these in apply or flag in verify)

| ADR | Summary | Impact on apply |
|-----|---------|-----------------|
| ADR-B3 | Bulk UC returns plain `BulkCascadeResult`, not `Result<T,E>` | apply must NOT wrap in Result; verify must NOT flag as blocker |
| ADR-B4 | Button always-enabled (no student-count gate) | apply must NOT add `disabled={alumnosCount === 0}`; spec SC-11 is satisfied by never disabling except in-flight |
| ADR-B5 | `cascadeAll` declared BEFORE `cascade` in controller | apply must insert in correct position; C-13 test enforces this |

## Spec scenario coverage matrix

| Task | Scenarios |
|------|-----------|
| T-01 | SC-01, SC-02, SC-03, SC-04, SC-05, SC-09, SC-10 |
| T-02 | SC-06, SC-07, SC-08 |
| T-03 | SC-11, SC-12, SC-13, SC-14, SC-15 |
| **All 15 SC covered** | ✓ |
