# EducandoW — Arquitectura Frontend Global

> **Stack**: React 19 + Vite 6 + React Router v7 + Axios + Vitest
> **Patrón**: Context + Hooks (sin estado global pesado)
> **Tema**: CSS Variables desde InstitutionContext (multi-tenant branding)

---

## 1. Estructura de directorios

```
web/src/
├── api/                    # Cliente HTTP (Axios)
│   └── client.ts           #   Interceptors: JWT, 401 redirect
├── components/
│   ├── layout/             # Shell de la app
│   │   ├── dashboard-layout.tsx   # Sidebar + contenido
│   │   ├── protected-route.tsx    # Guard de autenticación/roles
│   │   └── sidebar.tsx            # Navegación, filtrada por niveles y flags
│   ├── theme/
│   │   └── theme-applier.tsx      # Lee colores de InstitutionContext
│   ├── ui/                 # Componentes genéricos reutilizables
│   └── error-boundary/     # Error boundary global
├── constants/
│   └── levels.ts           # Catálogo de niveles: LEVEL_LABELS, PEDAGOGICAL_LEVELS, etc.
├── context/                # Estado global vía React Context
│   ├── auth-context.tsx         # AuthProvider: login, JWT, refresh, user
│   └── institution-context.tsx  # InstitutionProvider: datos de la institución post-login
├── hooks/                  # Hooks reutilizables
│   ├── use-api.ts               # Hook genérico para llamadas a la API
│   └── use-theme.ts             # Aplica colores de institución como CSS vars
├── pages/                  # Páginas (una por ruta)
│   ├── auth/               #   Login, Register
│   └── dashboard/          #   Dashboard, institutions, students, teachers, etc.
├── types/                  # Tipos TypeScript compartidos
├── styles/                 # Estilos globales
├── App.tsx                 # Rutas y providers
└── main.tsx                # Entry point
```

---

## 2. Flujo de datos

```
┌──────────┐    JWT     ┌──────────┐   fetch   ┌──────────┐
│  LOGIN   │ ────────→ │  Auth    │ ────────→ │   API    │
│  page    │           │  Context │           │  /v1/... │
└──────────┘           └────┬─────┘           └──────────┘
                            │
                     ┌──────▼──────┐
                     │ Institution │  ← GET /v1/institutions/me
                     │   Context   │     (25 campos + levels[])
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │ Sidebar  │ │  Theme   │ │  Pages       │
        │ (filtra  │ │  (CSS    │ │  (leen       │
        │  niveles)│ │  vars)   │ │   contexts)  │
        └──────────┘ └──────────┘ └──────────────┘
```

### Secuencia de inicio

1. **Login** → API devuelve `{ accessToken, refreshToken, user }`
2. **AuthContext** guarda tokens en `localStorage`, expone `user`
3. **InstitutionProvider** llama `GET /v1/institutions/me` con el JWT
4. **ThemeApplier** lee colores de `InstitutionContext` → CSS custom properties en `:root`
5. **Sidebar** filtra items según `config.levels.length > 0` y `featureFlags`
6. **Páginas** consumen `useAuth()` y `useInstitution()` para datos contextuales

---

## 3. Manejo de niveles y modalidades

### 3.1 Dónde vive la verdad

| Capa | Formato | Archivo |
|------|---------|---------|
| DB | `Int` (10, 21, 32...) | `schema_master.prisma`, `schema_tenant.prisma` |
| API response | `number` (JSON) | `toResponse()`, `GET /v1/levels` |
| Domain | `Level` VO (tipado) | `packages/domain/.../level.ts` |
| Frontend constants | `LevelOption[]` | `web/src/constants/levels.ts` |

### 3.2 Constantes del frontend

```typescript
// web/src/constants/levels.ts

// Catálogo completo (12 niveles)
LEVEL_CATALOG: LevelOption[]

// Solo niveles pedagógicos (10) — para combos de institución y enrollment
PEDAGOGICAL_LEVELS: LevelOption[]

// Lookup: código → etiqueta
LEVEL_LABELS: Record<number, string>
// LEVEL_LABELS[10] → "Inicial"
// LEVEL_LABELS[21] → "Talleres de Primario"

// Agrupados por nivel base — para combos con <optgroup>
LEVELS_BY_BASE: Record<number, LevelOption[]>
// LEVELS_BY_BASE[2] → [PRIMARIO(20), TALLERES_PRIMARIO(21), BILINGÜISMO_PRIMARIO(22)]

// Helper
levelLabel(code: number): string
```

### 3.3 Cómo se usa en un combo

```tsx
import { PEDAGOGICAL_LEVELS, LEVELS_BY_BASE } from '@/constants/levels';

// Combo plano (enrollment, subject creation)
<select name="level">
  {PEDAGOGICAL_LEVELS.map(l => (
    <option key={l.code} value={l.code}>{l.label}</option>
  ))}
</select>

// Combo con optgroups (institución: elegir qué niveles ofrece)
<select name="levels" multiple>
  {Object.entries(LEVELS_BY_BASE).map(([base, options]) => (
    <optgroup key={base} label={baseLabel(Number(base))}>
      {options.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </optgroup>
  ))}
</select>
```

### 3.4 Endpoint de catálogo (fallback dinámico)

Si el frontend necesita el catálogo desde la API en vez de constantes estáticas:

```
GET /v1/levels  →  { data: LevelCatalogEntry[] }
```

Esto devuelve los 12 niveles con `code`, `name`, `label`, `levelCode`, `modalityCode`, `pedagogical`.

---

## 4. Routing y control de acceso

### 4.1 Estructura de rutas

```
/login          → pública
/register       → pública
/ (dashboard)    → protegida (cualquier rol)
/institutions   → ADMIN
/students       → protegida (requiere niveles configurados)
/teachers       → protegida
/enrollments    → protegida
/subjects       → protegida
/course-sections→ protegida
/subject-assignments → protegida
/grades         → protegida
/attendance     → protegida
```

### 4.2 Guards

```tsx
// Por autenticación
<ProtectedRoute>            // Redirige a /login si no hay token

// Por rol
<ProtectedRoute roles={['ADMIN']}>  // Solo ADMIN

// Por feature flag (sidebar)
{ item.featureFlag === 'send_email' && !config.send_email }
```

### 4.3 Roles

| Rol | Permisos |
|-----|----------|
| `ROOT` | Acceso total, ve todas las instituciones |
| `ADMIN` | ABM de la institución, users, niveles |
| `MANAGER` | Gestión académica (materias, cursos, notas) |
| `TEACHER` | Carga de notas y asistencia |

---

## 5. Theming multi-tenant

Cada institución tiene sus colores de marca. Flujo:

```
InstitutionContext
  ├── header_color: "#1a56db"
  ├── header_text_color: "#ffffff"
  └── body_text_color: "#374151"
         │
         ▼
    useTheme() hook
         │
         ▼
    :root {
      --color-primary: #1a56db;
      --color-header: #1a56db;
      --color-header-text: #ffffff;
      --color-body-text: #374151;
    }
         │
         ▼
    Todos los componentes usan var(--color-primary), etc.
```

---

## 6. Convenciones de código

### 6.1 Componentes

- **Container/Presentational**: Los contexts son containers, las pages son presentational.
- **Nombres**: PascalCase para componentes, camelCase para hooks y utils.
- **Un componente por archivo** (salvo variantes pequeñas en mismo directorio).

### 6.2 Estado

- **Context** para estado global compartido (auth, institution).
- **useState/useReducer** para estado local de página o formulario.
- **No estado global pesado** (Redux, Zustand) — no se justifica aún.

### 6.3 API calls

- Todas las llamadas pasan por `api/client.ts` (Axios con interceptors).
- Hooks como `useApi` encapsulan loading/error/data.
- Las páginas NUNCA llaman a `fetch` o `axios` directamente.

### 6.4 Tipos

- Tipos de respuesta de API en el mismo archivo del contexto que los consume.
- `InstitutionConfig` en `institution-context.tsx`.
- Tipos de dominio (LevelOption) en `constants/levels.ts`.

---

## 7. Testing

- **Runner**: Vitest + jsdom
- **Ubicación**: `__tests__/` junto al código que testean
- **Cobertura actual**: 26 tests (contexts, hooks, componentes)

### Qué testear

| Capa | Qué | Con qué |
|------|-----|---------|
| Contexts | Login flow, carga de institución | Mock de apiClient |
| Hooks | useTheme aplica/limpia CSS vars | jsdom |
| Components | Renderizado condicional (roles, niveles) | React Testing Library |
| Pages | Flujos de usuario (form submit, navegación) | React Testing Library + mocks |

---

## 8. Próximos pasos (documentos particulares)

Cada documento particular cubre la arquitectura de un módulo concreto:

- `docs/arquitectura-frontend-auth.md` — Login, registro, JWT, refresh
- `docs/arquitectura-frontend-instituciones.md` — ABM institución, branding, SMTP
- `docs/arquitectura-frontend-niveles.md` — Combos de nivel+modalidad, sidebar por nivel
- `docs/arquitectura-frontend-alumnos.md` — ABM estudiantes, filtros
- `docs/arquitectura-frontend-pedagogia.md` — Materias, cursos, calificaciones, asistencia
