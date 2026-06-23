# Design: RolCurso — Roles Extendidos

**Change**: `rolcurso-roles-extendidos`
**Phase**: design (HOW — architectural level)
**Level**: ALL (asignación a CursoXCiclo, transversal a todos los niveles)
**Reads**: `sdd/rolcurso-roles-extendidos/proposal`

## 1. Architecture Approach

El cambio es una **ampliación aditiva de un value-set** (`enum RolCurso`) que atraviesa
las cuatro capas en una sola dirección, respetando Clean Architecture
(`domain → application → infrastructure → presentation`) y el flujo de derivación
de tipos del monorepo.

Principio rector: **una única fuente de verdad (SSOT) en el dominio; todo lo demás deriva**.
El enum `RolCurso` vive en `@educandow/domain` y es importado por API (DTO Zod, use-cases,
repositorios) y por el front (web tiene la dependencia `@educandow/domain: workspace:*`).
El único punto que NO puede importar TypeScript es Postgres: el `enum RolCurso` del schema
Prisma tenant es una **copia física** que debe mantenerse sincronizada manualmente +
una migración. Ese es el único acoplamiento de duplicación real del cambio.

Patrón aplicado: *Expand-only enum extension* — agregamos miembros, no removemos ni
renombramos, lo que hace el cambio retrocompatible en runtime y en datos.

### Mapa de sincronización (dónde vive el value-set)

| Capa | Artefacto | Tipo de acoplamiento | Acción |
|------|-----------|----------------------|--------|
| Domain (SSOT) | `packages/domain/.../asignacion-curso-x-ciclo.ts` `enum RolCurso` | autoritativo | **Editar**: +4 miembros + doc comment |
| Persistence (DB) | `api/prisma_tenant/schema.prisma` `enum RolCurso` | copia física en Postgres | **Editar + migración** `ALTER TYPE ADD VALUE` |
| Presentation API | `api/.../asignacion-curso.dto.ts` `z.nativeEnum(RolCurso)` | derivado (import) | **Sin cambios** — auto-sync |
| Application | `assign-docente-to-curso.use-case.ts` | consume enum | **Sin cambios** (ver ADR-3) |
| Infrastructure | `prisma-asignacion-curso-x-ciclo.repository.ts` | filtros `WHERE rol = X` | **Sin cambios** (ver ADR-3) |
| Presentation Web | `web/src/types/materia-grupo.ts` + `materia-grupos.tsx` | hoy re-declara union | **Editar** (ver ADR-2) |

## 2. Componentes y Flujo de Datos

```
                 ┌──────────────────────────────────────────────┐
   SSOT          │  domain: enum RolCurso (6 valores)            │
                 └───────────────┬───────────────┬──────────────┘
                                 │ import         │ import (workspace:*)
                 ┌───────────────▼──────┐  ┌──────▼───────────────┐
   API           │ DTO z.nativeEnum     │  │ web: RolCurso + map   │  Presentation
                 │ use-case / repo      │  │ <select> 6 options    │
                 └───────────────┬──────┘  └──────────────────────┘
                                 │ persiste
                 ┌───────────────▼──────────────────────────────┐
   DB (copia)    │ Prisma enum RolCurso (6) — migración ADD VALUE │
                 │ aplicada a TODOS los tenants                   │
                 └───────────────────────────────────────────────┘
```

**Flujo de escritura (asignar docente con rol nuevo)**:
1. Front: usuario elige rol (p.ej. `SECRETARIO`) en `<select>` → `formRol` (tipado `RolCurso`).
2. POST → DTO valida con `z.nativeEnum(RolCurso)` (ya reconoce los 6 valores por import).
3. Use-case: como `rol !== TITULAR`, NO dispara `removeTitularesForCourse` → permite múltiples.
4. Repo `assign(...)` → Prisma INSERT con `rol = 'SECRETARIO'`.
5. Postgres acepta el valor SOLO si la migración ya está aplicada en ese tenant. ← punto crítico de orden.

## 3. Integration Points

- **Domain ↔ API/Web**: vía paquete `@educandow/domain` (re-export en `index.ts:229`).
  Build de Turbo garantiza que domain compile antes que api/web.
- **API ↔ Postgres**: vía Prisma client tenant. El enum es un tipo nativo de Postgres
  (`CREATE TYPE ... AS ENUM`), por eso requiere DDL explícito.
- **Multitenant**: una sola definición de schema (`prisma_tenant`), N bases físicas.
  La migración se despliega con `prisma:migrate:deploy:tenant` por cada tenant.

## 4. Decisiones (ADR-style)

### ADR-1 — Domain enum como única fuente de verdad
**Decisión**: agregar los 4 valores PRIMERO en `domain` y derivar todo lo demás.
**Rationale**: Clean Arch + value-objects convention — el dominio es autoritativo,
las capas externas no inventan vocabulario. Zod (`z.nativeEnum`) y los tipos de API
quedan sincronizados con cero código extra.
**Rechazado**: definir el enum en Prisma y derivar el dominio (invertiría la dependencia,
acoplaría dominio a infraestructura — viola la regla `domain/ imports nothing`).

### ADR-2 — El front importa `RolCurso` desde `@educandow/domain` (no re-declara union)
**Decisión**: reemplazar la string-union literal `'PRECEPTOR' | 'TITULAR'` en
`web/src/types/materia-grupo.ts` y el estado `formRol` por el `enum RolCurso` importado del dominio,
y derivar las opciones del `<select>` de un **único mapa label** `ROL_CURSO_LABELS: Record<RolCurso, string>`.
**Rationale**: DESCUBRIMIENTO CLAVE — `web/package.json` ya declara `"@educandow/domain": "workspace:*"`.
El front PUEDE importar el enum, así que la re-declaración manual del union era una fuente de drift
evitable. Importando el enum + un mapa de labels, los 6 valores y sus etiquetas en español viven en
UN solo lugar; agregar un rol futuro no exige tocar el `<select>` ni el tipo de estado
(cumple `ui-patterns`: no duplicar la lista de opciones, derivar de un mapa).
**Rechazado A**: mantener el union manual y agregar las 4 claves a mano (3 lugares: type, estado, options).
Rechazado por drift garantizado — es exactamente el bug que este diseño debe prevenir.
**Rechazado B**: derivar las options de `Object.values(RolCurso)` sin labels. Rechazado: las claves son
UPPER_SNAKE (p.ej. `DOCENTE_AUXILIAR`) y la UI necesita etiquetas en español ("Docente Auxiliar"),
por eso se usa un mapa explícito `RolCurso → label`.
**Nota de implementación (para tasks)**: el mapa de labels vive en el front
(`web/src/types/materia-grupo.ts` o un `constants` cercano). NO se mete en el dominio:
las etiquetas en español son una preocupación de presentación, no de dominio.

### ADR-3 — Los 4 roles nuevos NO tienen singleton; use-case y repo quedan intactos
**Decisión**: no tocar `assign-docente-to-curso.use-case.ts` ni el repositorio.
**Rationale**: confirmado por inspección —
- El use-case sólo bifurca en `if (input.rol === RolCurso.TITULAR)` (ACC-S5 replace).
  Los 4 nuevos roles caen por el camino "múltiples permitidos", igual que PRECEPTOR. Es el
  comportamiento deseado por la proposal.
- El repositorio tiene 3 referencias a roles, todas son **filtros de query estrechos**, no
  branching: `isPreceptor` (`WHERE rol=PRECEPTOR`), `removeTitularesForCourse` (`WHERE rol=TITULAR`),
  `findTitularCourseIdsByUser` (`WHERE rol=TITULAR`). Los roles nuevos simplemente no matchean
  esos predicados, que es exactamente correcto (no son preceptores ni titulares).
**Conclusión**: agregar valores al enum NO requiere cambios en application ni infrastructure.
El índice único `(course_cycle, docente, rol, turno) NULLS NOT DISTINCT` ya impide duplicar
exactamente la misma tupla, lo que da una garantía de integridad razonable sin singleton.
**Rechazado**: introducir reglas de singleton para alguno de los nuevos roles (p.ej. un único
DIRECTOR por curso). Rechazado en proposal — fuera de scope; se puede agregar luego sin romper datos.

### ADR-4 — Migración aditiva no destructiva + orden de despliegue
**Decisión**: nueva migración tenant `ALTER TYPE "RolCurso" ADD VALUE 'SECRETARIO'; ... ADD VALUE 'DOCENTE_AUXILIAR';`
generada con `prisma migrate dev` (alias `prisma:migrate:tenant`) y desplegada con
`prisma:migrate:deploy:tenant` a CADA tenant.
**Rationale**: `ADD VALUE` es aditivo, sin backfill, sin pérdida de datos, retrocompatible
(filas existentes con PRECEPTOR/TITULAR intactas).
**Gotcha Postgres**: `ALTER TYPE ... ADD VALUE` históricamente NO puede correr dentro de un
bloque transaccional (pre-PG12, y aún hoy un `ADD VALUE` no es usable en la misma transacción
que lo crea). Prisma genera cada `ADD VALUE` como statement separado; verificar que el SQL generado
no quede envuelto en una transacción manual. Si hay fricción, emitir los `ADD VALUE` en sentencias
sueltas. La convención del repo (ver migración `add_asignacion_curso_ciclo`) usa SQL plano por migración,
lo que es compatible.
**Orden de despliegue (CRÍTICO)**: la migración debe aplicarse en TODOS los tenants ANTES
de que el front ofrezca los nuevos roles. Si el front envía `SECRETARIO` a un tenant sin migrar,
el INSERT de Postgres falla con "invalid input value for enum". Secuencia obligatoria:
1. Merge dominio + schema + migración.
2. `prisma:migrate:deploy:tenant` en todos los tenants; verificar.
3. Recién entonces desplegar el build del front con las 6 opciones.
**Rechazado**: usar `CHECK` constraint o columna `TEXT` en vez de enum nativo. Rechazado: rompería
el contrato existente y el tipado de Prisma; el enum nativo ya está en producción.

### ADR-5 — DTO sin cambios (decisión-no-acción documentada)
**Decisión**: NO tocar `asignacion-curso.dto.ts`.
**Rationale**: `z.nativeEnum(RolCurso)` lee el enum en runtime; al ampliarse el enum del dominio,
el schema acepta automáticamente los 6 valores. Es un *design win* de haber usado `nativeEnum`
en lugar de un `z.enum([...])` con literales hardcodeados.

## 5. TDD Impact (Strict TDD activo — test primero)

| Test | Acción | Qué cubrir |
|------|--------|------------|
| `domain/.../asignacion-curso-x-ciclo.test.ts` | **Agregar** | nuevo `it('acepta los 4 roles nuevos')` recorriendo `[SECRETARIO, DIRECTOR, EOE, DOCENTE_AUXILIAR]` y verificando `a.rol`; opcional un test que valide que `Object.values(RolCurso).length === 6`. |
| `assign-docente-to-curso.use-case.test.ts` | **Agregar** | un caso asignando un rol nuevo (p.ej. `SECRETARIO`) que verifique que NO se llama `removeTitularesForCourse` (no aplica singleton) y que `assign` recibe el rol. |
| `prisma-asignacion-curso-x-ciclo.repository.spec.ts` | **Revisar** | confirmar que `isPreceptor`/titular siguen verdes; no se esperan cambios funcionales. Sin nuevos tests salvo regresión. |
| DTO/controller (Zod) | **Opcional** | si existe test de parseo del DTO, agregar un caso que valide que `z.nativeEnum` acepta un rol nuevo. Si no existe, no se crea infra de test sólo para esto. |
| Front `materia-grupos` | **Agregar/Revisar** | si hay test de la página, verificar que el `<select>` renderiza 6 opciones derivadas del mapa de labels. |

Orden TDD por capa: domain test (rojo→verde) → use-case test → migración → front.
`pnpm test` y `pnpm build` deben quedar en verde (coverage ≥ 80%).

## 6. Riesgos Arquitectónicos / Supuestos a Validar

- **Drift dominio↔Prisma**: aunque ADR-2 elimina el drift del front, persiste el acoplamiento
  manual dominio↔Prisma (dos archivos que deben editarse juntos). Mitigación: misma PR, checklist
  en tasks, y el `pnpm build` + `prisma generate` fallarían si quedan desalineados en uso.
- **Orden de despliegue (ADR-4)**: el mayor riesgo operativo. Si el front sale antes que la migración
  en algún tenant → INSERT falla. Mitigación: secuencia de deploy explícita + verificación por tenant.
- **Postgres ADD VALUE / transacción**: validar el SQL generado por Prisma (gotcha ADR-4).
- **Conflación semántica DIRECTOR/SECRETARIO con `UserRole`** (tradeoff aceptado en proposal):
  no se aborda; documentado. El front ya tiene `MANAGEMENT_ROLES = ['ROOT','ADMIN','DIRECTOR','SECRETARIO']`
  para `UserRole` — son strings de OTRO dominio (identidad institucional), no de `RolCurso`. No mezclar.
- **Supuesto a confirmar en spec**: que ningún rol nuevo requiere singleton (ADR-3). Ya declarado
  como asunción explícita en la proposal.
