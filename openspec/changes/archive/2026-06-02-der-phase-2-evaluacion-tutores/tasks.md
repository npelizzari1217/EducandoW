# Tasks: DER Phase 2 — Evaluación + Tutores

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400 (frontend ~250, backend ~80, tests ~70) |
| 400-line budget risk | Medium (borderline) |
| Chained PRs recommended | Yes |
| Suggested split | PR1: Backend enrichment + tests → PR2: Frontend UI |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | StudentGuardian fields + GET endpoint + integration tests | PR 1 | Autonomous: domain→Prisma→repo→DTO→controller→tests |
| 2 | Frontend: evaluation pages + guardian UI + sidebar/routes | PR 2 | Depends on PR 1 (guardian GET endpoint) |

## Phase 1: StudentGuardian Enrichment (Backend)

- [x] 1.1 Add `isFinancialResponsible` + `isAuthorizedToPickUp` to StudentGuardian domain entity (student-guardian.ts)
- [x] 1.2 Add boolean columns to Prisma StudentGuardian model (schema_tenant.prisma)
- [x] 1.3 Update PrismaStudentGuardianRepository to save new fields
- [x] 1.4 Add optional booleans to AssignGuardianDTO
- [x] 1.5 Add `GET /students/:id/guardians` endpoint to StudentController
- [x] 1.6 Generate Prisma migration + push

## Phase 2: Integration Tests (Backend)

- [x] 2.1 Create integration tests for POST/GET/DELETE /evaluaciones
- [x] 2.2 Create integration tests for POST/GET /notas
- [x] 2.3 Create integration tests for POST/GET/DELETE /periodos
- [x] 2.4 Create integration tests for POST/GET /notas-trimestrales
- [x] 2.5 Create integration tests for guardian endpoints (POST/GET/DELETE /students/:id/guardians)

## Phase 3: Frontend Evaluation Pages

- [x] 3.1 Create `web/src/pages/dashboard/evaluation-pages.tsx` with EvaluacionesPage (list + create/delete)
- [x] 3.2 Add NotasPage (per-evaluation grid: students rows, grade entry)
- [x] 3.3 Add PeriodosPage (CRUD list)
- [x] 3.4 Add NotasTrimestralesPage (consolidated period view)
- [x] 3.5 Remove broken GradesPage from pedagogy-pages.tsx
- [x] 3.6 Update App.tsx routes: add /evaluaciones/*, remove /grades
- [x] 3.7 Update sidebar.tsx: replace /grades with /evaluaciones

## Phase 4: Frontend Guardian Management

- [x] 4.1 Build guardian list component on student detail page (students.tsx)
- [x] 4.2 Build assign guardian modal (userId + relationship + booleans)
- [x] 4.3 Build remove guardian confirmation
- [x] 4.4 Update StudentPrintView to use StudentGuardian data

## Phase 5: Verify

- [x] 5.1 Run domain tests (587/587 passed)
- [x] 5.2 Run API tests (267/267 passed)
- [x] 5.3 Run web tests (88/88 passed)
- [x] 5.4 Build check (domain + api build OK; web has pre-existing course-cycles.tsx error unrelated to this change)
