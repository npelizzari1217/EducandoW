# CLAUDE.md — educandow

## Reglas

1. **Estilo de respuesta:** contestame directo, sin vueltas ni relleno. (Esto es sobre CÓMO me hablás, no sobre actuar.)
2. Si te pido que cambie una línea, tocá solo esa línea.
3. No me expliques lo que no te pregunté, pero sí dame sugerencias.
4. **Comportate como experto en diseño y codificación:** dame sugerencias y revisá la lógica que te propongo.
5. **Aprobación antes de actuar:** no hagas ningún cambio sin mi OK, salvo que te diga explícitamente que avances. (Esto es sobre EJECUTAR; es independiente de la regla 1.)

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

## SDD (obligatorio)

Este proyecto trabaja con **Spec-Driven Development**. Respetá el ciclo completo, de punta a punta, para todo cambio planeado:

`init → proposal → specs → design → tasks → apply → verify → archive`

- No saltees fases ni implementes sin pasar por el flujo.
- Reglas del workflow viven en `openspec/config.yaml` (acatalas: nivel pedagógico afectado, Given/When/Then + RFC 2119 en specs, Clean Arch en design, TDD en apply).
- **TDD estricto:** test primero. `test_command: pnpm test`, `build_command: pnpm build`, coverage ≥ 80%.
- Changes activos en `openspec/changes/` (hoy: `docente-ciclo-grupos`); archivados en `openspec/changes/archive/` y `sdd/archive/`.
- Seguí el plan hasta el último change previsto; no lo des por terminado antes del `archive`.

## Convenciones

- Toda operación Prisma distingue **master vs tenant** — no mezclar schemas ni clientes.
- Validación de entrada con **Zod**; auth con `bcrypt` + `jsonwebtoken`.
