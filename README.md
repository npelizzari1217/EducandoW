# EducandoW

Administración pedagógica para instituciones educativas de nivel **Inicial**, **Primario**, **Secundario** y **Terciario**.

## Stack

| Capa | Tecnología |
|------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| API | NestJS v10 + SWC + Clean Architecture |
| Base de datos | PostgreSQL + Prisma v5 |
| Frontend Web | React 19 + Vite 6 + React Router v7 |
| Frontend Mobile | Expo SDK 52 (planificado) |
| Testing | Vitest v1.6.1 |
| Lenguaje | TypeScript 5.4 (strict) |

## Requisitos

- **Node.js** >= 20
- **pnpm** >= 9
- **PostgreSQL** 16 (local o Docker)
- **Git**

## Arranque rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar PostgreSQL con Docker
docker compose up -d

# 3. Copiar variables de entorno
cp .env.example api/.env

# 4. Generar cliente Prisma y migrar
cd api && pnpm prisma:generate && pnpm prisma:migrate

# 5. Levantar todo en dev
pnpm dev
```

- **API**: http://localhost:3000/v1
- **Swagger**: http://localhost:3000/docs
- **Web**: http://localhost:5173

## Estructura del proyecto

```
educandow/
├── packages/domain/         # Dominio puro (zero deps)
│   └── src/
│       ├── shared/          # Result, VOs, errores
│       ├── institution/     # Institution, Level
│       ├── personnel/       # Student, Teacher
│       ├── enrollment/      # Enrollment
│       └── auth/            # User, Password, repositorios
├── api/                     # NestJS API
│   ├── src/
│   │   ├── application/     # Use cases por nivel pedagógico
│   │   ├── infrastructure/  # Prisma, JWT, bcrypt
│   │   └── presentation/    # Controllers por nivel
│   └── prisma/              # Schema + migraciones
├── web/                     # React SPA
├── mobile/                  # Expo (próximamente)
├── openspec/                # SDD specs + changes
├── .opencode/               # SDD config + governance
└── .atl/                    # Skill registry
```

## Niveles pedagógicos

Cada nivel es un **bounded context** independiente dentro del monolith:

| Nivel | Endpoints | Conceptos propios |
|-------|-----------|-------------------|
| Inicial | `/v1/inicial/*` | Salas, áreas de desarrollo, informes evolutivos |
| Primario | `/v1/primario/*` | Grados, materias, notas trimestrales, boletín |
| Secundario | `/v1/secundario/*` | Cursos, orientaciones, previas, mesas de examen |
| Terciario | `/v1/terciario/*` | Carreras, correlatividades, actas, títulos |

## Scripts

```bash
pnpm dev           # Dev mode (todos los paquetes)
pnpm build         # Build completo
pnpm test          # Tests (Vitest)
pnpm lint          # Lint + typecheck
pnpm format        # Formatear con Prettier
pnpm clean         # Limpiar builds
```

## Convenciones

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Arquitectura**: Clean Architecture — domain → application → infrastructure → presentation
- **Patrones**: Result<T,E> (nunca throw en domain/application), Value Objects inmutables, Use Cases con `execute()`
- **Level discrimination**: `Level` VO, nunca string suelto. Niveles NO comparten lógica pedagógica.
