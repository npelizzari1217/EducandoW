# Verify Report — optativa-plan-level PR2

> Phase: sdd-verify
> Scope: PR2 (presentation + web) + holistic check of full change
> Branch: feat/optativa-plan-level-pr2
> Date: 2026-06-22
> Verdict: PASS

---

## 1. Test Suite Results

| Suite | Result | Count |
|-------|--------|-------|
| `pnpm --filter api test` | PASS | 1539 / 1539 (160 files) |
| `pnpm --filter web test` | PASS | 441 / 441 (44 files) |
| `pnpm --filter api typecheck` | PASS | exit 0 |
| `pnpm --filter web exec tsc --noEmit` | PASS | exit 0 |

---

## 2. Test Body Quality

### Controller tests (T14 — 4 tests)

**Test A (MGC-S29):** `addSubjectToPlanCourse` with `{ subjectId, esOptativa: true }` → asserts `mockAddSubjectUC.execute` called with `('plan-course-1', 'sub-uuid-1', undefined, true)`. Genuine. ✓

**Test B (D4):** body without `esOptativa` → asserts `call.toHaveLength(4)` AND `call[3].toBeUndefined()`. Explicitly rules out both the 3-arg shortcut and silent `false` coercion. Genuine. ✓

**Test C (MGC-S38):** `listPlanCourseSubjects` response — asserts `data[0]` has `esOptativa: true` and `data[1]` has `esOptativa: false`. Genuine. ✓

**Test D (MGC-S38):** `getPlan` subjects map — asserts first subject has `esOptativa: true`. Genuine. ✓

### Web tests (T17 — 6 tests)

**Badge visible (MGC-R16, MGC-S38):** Renders component with `esOptativa: true` subject, asserts "Optativa" badge in document. Genuine. ✓

**No badge (MGC-S28):** Renders with `esOptativa: false`, asserts "Optativa" badge NOT in document. Genuine. ✓

**Hint text (D6):** Asserts `queryAllByText(/próxima generación de CC/i).length > 0`. Genuine. ✓

**Toggle POST esOptativa: true (flip from false):** Clicks "Marcar como optativa", asserts `mockApiPost` called with `/study-plan-courses/course-1/subjects` + `objectContaining({ subjectId: 'sub-2', esOptativa: true })`. Genuine. ✓

**Toggle POST esOptativa: false (flip from true):** Clicks "Marcar como obligatoria", asserts `objectContaining({ subjectId: 'sub-1', esOptativa: false })`. Genuine. ✓

**Refresh after toggle:** Counts GET calls to subjects endpoint before and after toggle click, asserts count increased. Genuine. ✓

---

## 3. Requirements Check (MGC-R13–R16, PR2 scope)

### MGC-R13 — `esOptativa` on `StudyPlanSubject`
Status: VERIFIED IN PR1 (merged). Schema field `esOptativa Boolean @default(false) @map("es_optativa")`, migration applied to tenant sandbox. ✓

### MGC-R14 — Materialization inherits `esOptativa`
Status: VERIFIED IN PR1. `GenerateCourseCyclesUseCase` maps `esOptativa: s.esOptativa` into planSubjects; `MaterializeMateriasUseCase` forwards it in upsertMany create path. ✓

### MGC-R15 — Re-gen additive; existing `MateriaXCursoXCiclo.esOptativa` immutable
Status: VERIFIED IN PR1. D2 LOCK comment in `materialize-materias.use-case.ts` Step-2 explicitly excludes `esOptativa` from updateDescription. T08 Test D asserts it. ✓

### MGC-R16 — Plan-subject API accepts and exposes `esOptativa`
- **Zod schema** (`register.request.ts` L136): `esOptativa: z.boolean().optional()` — does not break callers that omit the field. ✓
- **addSubjectToPlanCourse** (`pedagogy.controller.ts` L262): forwards `b.esOptativa` as 4th arg to UC. ✓
- **listPlanCourseSubjects** (L256): includes `esOptativa: s.esOptativa ?? false` in each subject. ✓
- **getPlan subjects** (L197): includes `esOptativa: s.esOptativa` in each subject. ✓

---

## 4. Design D6 — Standalone Toggle (not in name-edit state)

Verified in `study-plans.tsx` lines 954–985. Structure:

```
{isEditingSubj ? (
  <div className="edit-inline-row">  ← editing: input + save/cancel only
    ...
  </div>
) : (
  <>
    <span>{ps.subjectName}</span>
    {ps.esOptativa && <span className="badge badge-optativa">Optativa</span>}
    <div className="subject-actions">
      <Button onClick={() => handleToggleOptativa(pc.id, ps)}>
        {ps.esOptativa ? 'Marcar como obligatoria' : 'Marcar como optativa'}
      </Button>
      <span>aplica en la próxima generación de CC</span>
      <Button onClick={() => handleEditSubject(ps)}>Editar</Button>  ← opens editing state
    </div>
  </>
)}
```

Toggle is in the NON-editing branch. D6 is satisfied: the toggle is entirely standalone and not entangled with the name-edit inline state. ✓

---

## 5. Tasks Completeness

All PR2 tasks marked `[x]` in `tasks.md`:
- T14 [x] (RED: controller tests)
- T15 [x] (GREEN: Zod schema)
- T16 [x] (GREEN: controller handlers)
- T17 [x] (GREEN: web UI + tests)
- T18 [x] (VERIFY: PR2 run — confirmed by this report)

T13 `[ ] Open PR1 for review` and T18 `[ ] Open PR2 for review` are correctly unchecked — those are human tasks, not apply tasks.

---

## 6. Holistic End-to-End Check (PR1 + PR2 coherence)

### Full Flow

```
Web UI toggle
  → handleToggleOptativa → POST /study-plan-courses/{id}/subjects { subjectId, esOptativa: !current }
  → pedagogy.controller.ts addSubjectToPlanCourse
  → Zod parses esOptativa (optional boolean)
  → addSubjectUC.execute(id, subjectId, hoursPerWeek=undefined, esOptativa=!current)
  → planRepo.addSubject(planCourseId, subjectId, undefined, !current)
  → Prisma upsert: update: { esOptativa: !current }  (hoursPerWeek:undefined = skipped, D5)
  → StudyPlanSubject.esOptativa updated in DB

CC generation:
  → GenerateCourseCyclesUseCase reads StudyPlanCourseDto subjects via findPlanCoursesByPlan
  → maps esOptativa: s.esOptativa into planSubjects array
  → MaterializeMateriasUseCase Step-1 upsertMany: { esOptativa } in create block
  → MateriaXCursoXCiclo.esOptativa = plan value (only at creation; re-gen skips existing)
  → cascade skips optativa CCs (MGC-R10, shipped in PR1)
```

### Endpoint Match

Web: `POST /study-plan-courses/${planCourseId}/subjects`
Controller: `@Post('study-plan-courses/:id/subjects')` ✓

### API Response → Web Display

Web `PlanCourseSubject.esOptativa?: boolean` interface matches what `listPlanCourseSubjects` returns (`esOptativa: s.esOptativa ?? false`). Toggle reads the current value from list state and flips it. ✓

### PR1 → PR2 Gap

No gaps found. PR1 (merged) provides the entire domain + application + infrastructure chain. PR2 adds the presentation + web layer. The `esOptativa` flag flows from DB → domain port → UC → controller → web UI, fully connected.

---

## 7. Findings

### CRITICAL (0)
None.

### WARNING (0)
None.

### SUGGESTION (1)

**S1 — Toggle omits `hoursPerWeek` in POST body (implicit assumption)**

`handleToggleOptativa` sends `{ subjectId, esOptativa }` without `hoursPerWeek`. This works because:
1. The subject already exists (toggle only appears on listed subjects → CREATE branch won't fire)
2. D5: `hoursPerWeek: undefined` in Prisma `update:{}` is a no-op — existing value preserved

The behavior is correct and intentional, but the endpoint is semantically an "upsert" (not a PATCH), so omitting `hoursPerWeek` on a hypothetical create would leave it null. A PR review comment documenting this implicit constraint ("toggle only called on existing subjects") would prevent future confusion if the endpoint contract ever changes.

Not a bug. Does not block PR.

---

## 8. Overall Verdict

| Check | Result |
|-------|--------|
| API tests green | PASS |
| Web tests green | PASS |
| API typecheck | PASS |
| Web typecheck | PASS |
| MGC-R13 | PASS (PR1) |
| MGC-R14 | PASS (PR1) |
| MGC-R15 | PASS (PR1) |
| MGC-R16 | PASS (PR2) |
| D6 standalone toggle | PASS |
| E2E coherence | PASS |
| T14–T18 marked [x] | PASS |

**CRITICAL: 0 / WARNING: 0 / SUGGESTION: 1**

**Safe to commit+PR: YES**
**Ready to archive: YES**
**Next recommended: sdd-archive**
