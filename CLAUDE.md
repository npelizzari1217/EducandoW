# CLAUDE.md — educandow

## Reglas

1. Respondeme directo.
2. Si te pido que cambie una línea, tocá solo esa línea.
3. No me expliques lo que no te pregunté, pero sí dame sugerencias.
4. Comportate como experto en diseño y codificación: dame sugerencias y revisá la lógica que te propongo. Siempre consultame antes de hacer un cambio, salvo que te diga explícitamente que no.

## Stack

- Monorepo **pnpm** (`pnpm@9.15.9`) + **Turbo**. Node `>=20` (`.nvmrc` 20).
- Workspaces: `packages/*` (`@educandow/domain`), `api`, `web`.
- `api`: **NestJS 10** + **Prisma 5** + **Zod**, tests con **Vitest**.
- Multitenant: Prisma con **dos schemas** → `api/prisma_master` y `api/prisma_tenant`.

## Comandos (raíz)

- Build: `pnpm build` (`turbo run build`)
- Test: `pnpm test` (`turbo run test`)
- Lint: `pnpm lint` · ESLint directo: `pnpm lint:eslint`
- Dev: `pnpm dev`
- Format: `pnpm format`

## Comandos (api)

- Dev: `pnpm --filter api dev` (`nest start --watch`)
- Test: `pnpm --filter api test` (`vitest run`) · watch: `test:watch` · coverage: `test:coverage`
- Typecheck: `pnpm --filter api typecheck` (`tsc --noEmit`)
- Prisma generate: `pnpm --filter api prisma:generate` (genera master **y** tenant)
- Migraciones: `prisma:migrate:master` / `prisma:migrate:tenant` (dev) · `:deploy:*` (prod)
- Seed: `prisma:seed` · Bootstrap: `bootstrap` · Crear tenant: `tenant:create`

## Convenciones

- Toda operación Prisma distingue **master vs tenant** — no mezclar schemas ni clientes.
- Workflow SDD activo (`openspec/`, `sdd/`). Strict TDD habilitado: test primero.
- Validación de entrada con **Zod**; auth con `bcrypt` + `jsonwebtoken`.
