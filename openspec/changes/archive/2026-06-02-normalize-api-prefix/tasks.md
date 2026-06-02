# Tasks: normalize-api-prefix

## Phase 1 — API Controllers (13 files)

- [x] 1.1 Remove `v1/` from `@Controller()` in `course-cycle.controller.ts`
- [x] 1.2 Remove `v1/` from nivel-inicial controllers (sala, informe-evolutivo, planificacion)
- [x] 1.3 Remove `v1/` from nivel-primario controllers (grado, calificacion)
- [x] 1.4 Remove `v1/` from nivel-secundario controllers (curso, mesa-examen, regimen-academico)
- [x] 1.5 Remove `v1/` from nivel-terciario controllers (carrera, inscripcion-materia, acta-examen, titulo)

## Phase 2 — Frontend (12 files)

- [x] 2.1 Remove `/v1/` from `useCourseCycles.ts` BASE_URL
- [x] 2.2 Remove `/v1/` from nivel-inicial frontend pages (salas, informes, planificaciones)
- [x] 2.3 Remove `/v1/` from nivel-secundario frontend pages (cursos, mesas-examen)
- [x] 2.4 Remove `/v1/` from nivel-terciario frontend pages (carreras, inscripciones)
- [x] 2.5 Remove `/v1/` from `GenerateCourseCyclesModal.tsx`
- [x] 2.6 Verify zero remaining `/v1/` hardcoded in frontend (grep confirmed)

## Phase 3 — Middleware

- [x] 3.1 Add `/profiles` to `isMasterRoute()` in `tenant.middleware.ts`
- [x] 3.2 Update `isMasterRoute()` JSDoc comments to reflect normalized paths

## Phase 4 — Verification

- [x] 4.1 Kill stale NestJS process (running since May 29 with old code)
- [x] 4.2 Restart API server with correct code
- [x] 4.3 Verify all routes resolve with single `/v1/` prefix (NestJS log confirmed)
- [x] 4.4 Smoke test: `GET /v1/profiles` → 200, `POST /v1/profiles` → 201
- [x] 4.5 Run full test suite: 231/231 passed (33 files)
- [x] 4.6 Verify no `/v1/` hardcoded remains in frontend source (grep: 0 matches)
