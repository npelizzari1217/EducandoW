# Design: Normalize API Prefix

## Technical Approach

Single-source-of-truth versioning: `app.setGlobalPrefix('v1')` in `main.ts` is the canonical and only mechanism for applying the `/v1` prefix to all routes. Controller decorators express business-domain paths only. The frontend axios client uses `baseURL: '/v1'`, making all API URLs relative paths without the version segment.

This eliminates the double prefix (`/v1/v1/*`) caused by 13 controllers that previously hardcoded `v1/` in `@Controller()` while the global prefix already prepended `v1`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Versioning mechanism | Global prefix (`setGlobalPrefix`) | Hardcoded per-controller `v1/` | Single control point; zero risk of prefix drift across controllers. Changing to v2 requires one line in `main.ts`. |
| Controller path convention | Pure business domain: `course-cycles`, `inicial/salas`, etc. | Version-segmented paths in decorators | Controllers should not know about API versions — that's infrastructure concern (Clean Arch §presentation). |
| Refresh cookie path | Preserved `'/v1/auth/refresh'` literal | Derive from global prefix | Cookie paths are browser-level and independent of NestJS routing. The hardcoded literal is the spec for `Set-Cookie` headers. |
| Middleware route detection | Strip `/v1` from `originalUrl`, then match path prefixes | Match against full `/v1/*` paths | Middleware runs after global prefix is applied; `originalUrl` contains `/v1`. Stripping it keeps the `isMasterRoute()` logic prefix-agnostic. |
| Profiles as master route | Added `/profiles` to `isMasterRoute()` | Leave profiles as tenant-scoped | Profiles (user permission templates) live in the master DB alongside users/modules/roles. Classifying them as master routes prevents spurious 403s. |

## Data Flow

```
Browser → /v1/course-cycles
              │
              ▼
    NestJS Global Prefix (main.ts)
    strips /v1, resolves to @Controller('course-cycles')
              │
              ▼
    TenantMiddleware (originalUrl = /v1/course-cycles)
    → strips /v1 → '/course-cycles'
    → isMasterRoute? NO → checks JWT dbName
    → resolves tenant PrismaClient → TenantContext.run()
              │
              ▼
    AuthGuard → RolesGuard → Controller handler
    uses TenantContext.prismaClient()
              │
              ▼
    Response: 200 { data: [...] }
```

Master route flow (e.g., profiles):

```
Browser → POST /v1/profiles
              │
              ▼
    TenantMiddleware (originalUrl = /v1/profiles)
    → strips /v1 → '/profiles'
    → isMasterRoute? YES → passes through with null client
              │
              ▼
    AuthGuard → Controller → master PrismaClient
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/src/main.ts` | **Preserved** | `setGlobalPrefix('v1')` — canonical source of truth |
| `api/src/presentation/course-cycle/course-cycle.controller.ts` | Modified | `@Controller('course-cycles')` (removed `v1/`) |
| `api/src/presentation/nivel-inicial/sala.controller.ts` | Modified | `@Controller('inicial/salas')` |
| `api/src/presentation/nivel-inicial/informe-evolutivo.controller.ts` | Modified | `@Controller('inicial/informes')` |
| `api/src/presentation/nivel-inicial/planificacion.controller.ts` | Modified | `@Controller('inicial/planificaciones')` |
| `api/src/presentation/nivel-primario/grado.controller.ts` | Modified | `@Controller('primario/grados')` |
| `api/src/presentation/nivel-primario/calificacion.controller.ts` | Modified | `@Controller('primario/calificaciones')` |
| `api/src/presentation/nivel-secundario/curso.controller.ts` | Modified | `@Controller('secundario/cursos')` |
| `api/src/presentation/nivel-secundario/mesa-examen.controller.ts` | Modified | `@Controller('secundario/mesas-examen')` |
| `api/src/presentation/nivel-secundario/regimen-academico.controller.ts` | Modified | `@Controller('secundario/regimen-academico')` |
| `api/src/presentation/nivel-terciario/carrera.controller.ts` | Modified | `@Controller('terciario/carreras')` |
| `api/src/presentation/nivel-terciario/inscripcion-materia.controller.ts` | Modified | `@Controller('terciario/inscripciones')` |
| `api/src/presentation/nivel-terciario/acta-examen.controller.ts` | Modified | `@Controller('terciario/actas-examen')` |
| `api/src/presentation/nivel-terciario/titulo.controller.ts` | Modified | `@Controller('terciario/titulos')` |
| `api/src/presentation/auth/auth.controller.ts` | **Preserved** | `REFRESH_PATH = '/v1/auth/refresh'` — cookie path |
| `api/src/infrastructure/auth/tenant.middleware.ts` | Modified | Added `/profiles` to `isMasterRoute()` |
| `web/src/hooks/useCourseCycles.ts` | Modified | `BASE_URL = '/course-cycles'` |
| `web/src/niveles/inicial/planificaciones/` (2 files) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/inicial/informes/` (2 files) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/inicial/salas/` (2 files) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/secundario/mesas-examen/` (2 files) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/secundario/cursos/` (1 file) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/terciario/inscripciones/` (1 file) | Modified | Removed `/v1/` from API URL strings |
| `web/src/niveles/terciario/carreras/` (1 file) | Modified | Removed `/v1/` from API URL strings |
| `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx` | Modified | Removed `/v1/` from API URL strings |

**No files created or deleted.** Pure modification of existing files.

## Contracts / Interfaces

No API contract changes. External clients still use `/v1/*` paths — unchanged. The fix is internal routing hygiene. The `REFRESH_PATH` cookie path remains `/v1/auth/refresh` — browser `Set-Cookie` headers are unaffected.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration | All 231 existing tests pass with corrected routing | `pnpm test` |
| Smoke | `POST /v1/profiles` returns 201 (was 404/403) | Manual curl / Postman |
| Smoke | `GET /v1/course-cycles` returns 200 (no double prefix) | Manual curl |
| Smoke | Frontend pages load data without 404s | Manual browser verification |
| Unit | `isMasterRoute()` returns true for `/profiles` | Existing middleware test suite |

## Migration / Rollout

No data migration required. Change is deployment-only: server restart is mandatory. Without restart, the old code (double prefix) continues executing.

## Open Questions

None.
