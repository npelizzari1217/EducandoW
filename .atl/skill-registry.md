# Skill Registry

**Delegator use only.** The orchestrator reads this registry to resolve compact rules and injects them into sub-agent prompts.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| API, REST, endpoint, endpoint design, controller, route, HTTP, web service, API contract, OpenAPI, Swagger | api-design | ~/.config/opencode/skills/api-design/SKILL.md |
| audit, auditoría, historial, history, log de cambios, tracking, trail, who changed, changelog | audit-log | ~/.config/opencode/skills/audit-log/SKILL.md |
| auth, autenticación, autorización, access control, login, JWT, RBAC, seguridad, acceso, permissions, roles | auth-access | ~/.config/opencode/skills/auth-access/SKILL.md |
| creating PRs, opening PRs, preparing PRs for review | branch-pr | ~/.config/opencode/skills/branch-pr/SKILL.md |
| PRs over 400 lines, stacked PRs, review slices | chained-pr | ~/.config/opencode/skills/chained-pr/SKILL.md |
| clean architecture, clean arch, capas, hexagonal, DDD, layers | clean-arch | ~/.config/opencode/skills/clean-arch/SKILL.md |
| writing guides, READMEs, RFCs, onboarding, architecture docs | cognitive-doc-design | ~/.config/opencode/skills/cognitive-doc-design/SKILL.md |
| PR feedback, issue replies, reviews, Slack messages, GitHub comments | comment-writer | ~/.config/opencode/skills/comment-writer/SKILL.md |
| data access, online, offline, cache, sync, local DB, SQLite, persistencia, conectividad | data-access | ~/.config/opencode/skills/data-access/SKILL.md |
| error handling, errores, Result type, manejo de errores, domain errors, try catch | error-handling | ~/.config/opencode/skills/error-handling/SKILL.md |
| Expo, React Native, Tamagui, NativeWind, mobile, iOS, Android | expo-tamagui | ~/.config/opencode/skills/expo-tamagui/SKILL.md |
| file, archivo, upload, subir, imagen, PDF, storage, S3, file system | file-storage | ~/.config/opencode/skills/file-storage/SKILL.md |
| Go tests, go test coverage, Bubbletea teatest, golden files | go-testing | ~/.config/opencode/skills/go-testing/SKILL.md |
| creating GitHub issues, bug reports, feature requests | issue-creation | ~/.config/opencode/skills/issue-creation/SKILL.md |
| judgment day, dual review, adversarial review, juzgar | judgment-day | ~/.config/opencode/skills/judgment-day/SKILL.md |
| email, notificación, push notification, websocket, SMS, SendGrid, SES, twilio | messaging-notifications | ~/.config/opencode/skills/messaging-notifications/SKILL.md |
| NestJS, Nest, módulo, controller, provider, @Module, DI | nestjs-modules | ~/.config/opencode/skills/nestjs-modules/SKILL.md |
| report, PDF, boletin, factura, recibo, documento, certificado, pdf generation | reporting-documents | ~/.config/opencode/skills/reporting-documents/SKILL.md |
| repository, repositorio, persistencia, data access, DAO, ORM, storage, DB | repository-pattern | ~/.config/opencode/skills/repository-pattern/SKILL.md |
| schedule, calendar, agenda, cita, turno, appointment, horario, disponibilidad | scheduling-calendar | ~/.config/opencode/skills/scheduling-calendar/SKILL.md |
| new skills, agent instructions, documenting AI usage patterns | skill-creator | ~/.config/opencode/skills/skill-creator/SKILL.md |
| Tauri, Tauri v2, desktop, escritorio, empaquetar, nativo, Rust, WebView | tauri-v2 | ~/.config/opencode/skills/tauri-v2/SKILL.md |
| UI, button, botón, formulario, form, input, list, table, modal, dialog, componente | ui-patterns | ~/.config/opencode/skills/ui-patterns/SKILL.md |
| value object, VO, tipos fuertes, domain primitive, self-validating, valor | value-objects | ~/.config/opencode/skills/value-objects/SKILL.md |
| commit splitting, work unit, reviewable commits, implementation, chained PRs | work-unit-commits | ~/.config/opencode/skills/work-unit-commits/SKILL.md |

## Compact Rules

### api-design
- RESTful resource naming: NO verbs in URLs (`/getUsers` ✗), NO `/api` prefix unless behind a gateway, NO trailing slashes.
- Standard response envelope: `{ data, pagination? }` for success, `{ error: { code, message, details? } }` for errors.
- HTTP status codes: 200/201/204 for success, 400/401/403/404/409/422 for errors. NEVER return 200 with `{ error }`.
- Two-level validation: transport (presentation/Zod) for shape, domain (VO self-validation) for business rules.
- Controllers are THIN: validate request → call use case → map response. Zero business logic.
- Pagination: `?page=1&pageSize=20&sort=createdAt:desc&filter=status:active`.
- NEVER leak infrastructure errors to the client. Map at presentation boundary.

### audit-log
- Audit is a SIDE EFFECT — NEVER blocks the primary operation. Use domain events + async handlers.
- Actor is ALWAYS required. Unknown = `actorType: 'system'`. Never null.
- Structured changes only: `{ field, oldValue, newValue }`. No free-text descriptions.
- Audit entries are IMMUTABLE — never update or delete. Corrections = new entries.
- Mask sensitive data (passwords, tokens, PII) — never log raw values.
- Port defined in `application/`, implementation in `infrastructure/`.

### auth-access
- AuthN ≠ AuthZ: AuthN verifies identity (infrastructure), AuthZ checks permissions (application/domain).
- Auth providers are infrastructure (JWT, OAuth, Passport). Port in `application/`, implementation in `infrastructure/`.
- Current user resolved at presentation boundary (middleware), passed to use cases as parameter — never global/static.
- Authorization checks in APPLICATION use cases, NOT in infrastructure.
- Role/permission logic lives in DOMAIN (`UserIdentity.hasRole()`, `Permission.can()`).
- Passwords: hash with bcrypt/argon2 in infrastructure, validation rules in domain VO. NEVER log tokens or passwords.
- Tokens: httpOnly + secure + sameSite cookies. JWTs: 15min access + 7d refresh max.

### branch-pr
- Every PR MUST link an approved issue (label `status:approved`). No exceptions.
- Branch naming: `type/description` — `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`.
- Every PR MUST have exactly one `type:*` label.
- Automated checks must pass before merge is possible.
- Conventional commits required: `type(scope): description`.
- PR template includes: summary, changes, screenshots (if UI), test plan, checklist.

### chained-pr
- Split PRs over **400 changed lines** unless maintainer accepts `size:exception`.
- Each PR reviewable in ≤60 minutes. Keep tests/docs with the unit they verify.
- State start/end, dependencies, follow-up, and out-of-scope in every chained PR.
- Every child PR includes a dependency diagram marking current PR with `📍`.
- Do NOT mix chain strategies after the user chooses one.
- Feature Branch Chain: tracker PR is draft/no-merge; child #1 targets tracker, later children target parent.

### clean-arch
- `domain/` imports NOTHING outside itself. `application/` imports `domain/` ONLY. `infrastructure/` imports `domain/` + `application/` ONLY. `presentation/` imports `application/` ONLY.
- Entities have behavior — no anemic domain. Value Objects are immutable, self-validating, compared by value.
- Use Cases: one class = one use case. Single `execute()` method. Ports defined in `application/` or `domain/`, implemented in `infrastructure/`.
- DTOs in `application/` for cross-layer data. Never expose domain entities outside `application/`.
- Domain tests have ZERO infrastructure. Application tests mock ports.
- Dependency injection wiring belongs in `infrastructure/`. Constructor injection everywhere.

### cognitive-doc-design
- Lead with the answer: decision, action, or outcome FIRST. Context comes after.
- Progressive disclosure: happy path first, then details, edge cases, references.
- Chunking: group related info into small sections. Keep flat lists short.
- Signposting: headings, labels, callouts, summaries so readers know where they are.
- Recognition over recall: prefer tables, checklists, examples, templates over prose.
- Review empathy: design docs so reviewers can verify intent without reconstructing the whole story.

### comment-writer
- Start with the actionable point. Do NOT recap the whole PR before feedback.
- Be warm and direct — sound like a thoughtful teammate, not a corporate bot.
- Keep it short: 1-3 paragraphs or a tight bullet list.
- Explain WHY when asking for a change (technical reasoning).
- Comment on the highest-value issue, not every tiny preference.
- Match thread language. Spanish → Rioplatense voseo (`podés`, `tenés`, `fijate`).

### data-access
- One repository port, multiple strategies: DirectDB (backend/ORM), RemoteRepo (web/HTTP), CachedRepo (mobile/sync).
- Use Case does NOT know which implementation it receives — wired by DI per platform.
- Backend: PostgreSQL + Prisma ORM. Mobile offline: SQLite (expo-sqlite or WatermelonDB).
- Tests: in-memory or mock implementing the same port interface.
- Never import ORM-specific types in domain or application layers.

### error-handling
- NEVER throw in domain or application layers. Use `Result<T, E>` for all expected failures.
- Layered error model: DomainError → ApplicationError → InfrastructureError → Presentation (mapped).
- Map errors at layer boundaries: infrastructure errors NEVER cross into application as-is.
- Every `catch` MUST map or re-wrap — no bare `catch(e) { throw e }`.
- Error types carry context: what failed, why, relevant identifiers. No generic `Error('something went wrong')`.

### expo-tamagui
- Design tokens in `tamagui/config.ts`. Never hardcode colors, spacing, or fonts.
- `styled()` with theme tokens for all components. No inline styles. No `useWindowDimensions()` — use responsive props.
- Platform-specific files (`.native.tsx`/`.web.tsx`) only for BEHAVIOR differences, never for visual.
- Shared types from shared package — do NOT redefine domain types in the Expo project.
- Expo Router for navigation. Never use React Navigation directly.

### file-storage
- File operations abstracted behind a port in `application/`. Implementations in `infrastructure/` (local FS, S3, etc.).
- Upload returns a FileReference (ID, URL, MIME type, size). NEVER expose internal paths.
- File validation (type, size, dimensions) in application layer before storage.
- Cleanup: temp files deleted after processing. Orphaned files handled by a scheduled job.
- Serve files through a controller, not directly from the filesystem.

### messaging-notifications
- Messaging/notification abstracted behind a port in `application/`. Implementations in `infrastructure/`.
- Port defines: `send(template: NotificationTemplate, to: Recipient): Result<NotificationId, NotificationError>`.
- Templates are domain objects — content structure, not rendering. Rendering is infrastructure.
- Providers (SendGrid, SES, Twilio, Pusher) are swappable infrastructure. Zero application changes.
- Async preferred: publish domain event → event handler calls notification port.

### nestjs-modules
- Controllers in `presentation/`, use cases in `application/`, repo impls in `infrastructure/`. Modules wire them together.
- Use cases are plain classes with `execute()`. No `@Injectable()`, no NestJS decorators in domain.
- Repository injection uses `Symbol` tokens, not classes. `@Inject(USERS_REPOSITORY)`.
- No `@Injectable()` in domain entities or VOs. Domain is pure TypeScript.
- Circular imports = design smell. Extract shared deps into a new module.

### reporting-documents
- Document generation abstracted behind a port in `application/`. Implementations in `infrastructure/`.
- Template engine (PDFKit, jsPDF, ExcelJS) is infrastructure — domain defines the data contract.
- Reports are assembled from domain data via use cases. No business logic in generators.
- Support async generation for large documents. Store generated files via file-storage port.

### repository-pattern
- Repository interface defined in `domain/` as a port. Implementation in `infrastructure/`.
- Repository methods speak domain language: `findByEmail()`, `save()`, not `insertIntoTable()`.
- Return domain entities, not ORM models. Implementation maps between ORM and domain.
- One repository per aggregate root. Do NOT create repositories for every table.
- Tests: mock the interface for domain/application tests. Test the implementation with real DB.

### scheduling-calendar
- Time slot is a Value Object with start/end, duration validation, and overlap detection.
- Appointment entity: time slot + participants + status + metadata.
- Conflict detection is domain logic — use cases validate before booking.
- Recurrence rules (RRULE, cron) modeled as Value Objects. Expansion is application logic.
- Availability is computed from schedules + appointments + blocked slots. Not stored as pre-computed slots.

### skill-creator
- Required frontmatter: name, description (quoted, one physical line, ≤250 chars, trigger-first), license, metadata.
- Body structure: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract, References.
- Target 180-450 body tokens. Move examples/schemas/edge cases into `references/` or `assets/`.
- Hard rules are observable (pass/fail). Decision gates cover real forks. Output contract states exactly what to return.
- References must be local files relative to the skill directory.

### tauri-v2
- Tauri is a native SHELL, not the app. Business logic stays in the web app.
- IPC via `invoke()` only. No Rust web server, no DOM manipulation from Rust.
- Feature-detect with `__TAURI_INTERNALS__`. The web app must work in both browser and Tauri.
- Prefer official Tauri plugins over custom Rust code (dialog, fs, notification, shell).
- Minimum capability permissions. No wildcard `*` in production.

### ui-patterns
- Framework-agnostic patterns: copy into each project and bind to its UI framework.
- Patterns: form validation, async button, combobox/autocomplete, data table with pagination, modal/dialog, toast notifications.
- Each pattern includes: problem it solves, usage contract, accessibility requirements, states (loading/empty/error/edge cases).
- Adapt to framework conventions (React hooks, Vue composables, Svelte stores) but keep the contract consistent.

### value-objects
- `private readonly` fields. No setters. No mutation. Factory method (`static create()`) returns `Result` or throws typed errors.
- Implement `equals()` (value comparison), `get()` (raw primitive), `toString()`.
- Validation INSIDE the VO, not in controllers or use cases. Keep validation focused on the value's invariants, not business rules.
- Shared VOs (Email, Money, UserId) live in a shared package used by every context.

### work-unit-commits
- Each commit is a reviewable work unit: coherent, independently testable, with a clear purpose.
- One logical change per commit. No "fix typo" or "address PR feedback" as standalone commits — squash into the relevant unit.
- Tests and docs ship WITH the code they verify, not in separate commits.
- Chained PRs: one commit per PR in the chain. Linear history, no merge commits.
- Commit messages: conventional commits format — `type(scope): description`. Body explains WHY, not WHAT.

## Project Conventions

*(Add project-specific convention files here as the project evolves)*
