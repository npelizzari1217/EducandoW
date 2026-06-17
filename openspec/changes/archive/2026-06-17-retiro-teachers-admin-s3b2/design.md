# Design: retiro-teachers-admin-s3b2

> Fase: sdd-design · Store: hybrid · 2026-06-17
> S3b-2 del retiro de Teacher — retirar el CRUD admin `/teachers`.

## Enfoque arquitectónico

Retiro vertical completo de un slice de presentación NestJS + su página React,
SIN tocar el modelo de persistencia. Se elimina el módulo entero (controller +
use-cases + repo Prisma + DTOs) en lugar de mutilarlo, lo que garantiza CERO
DI colgante: al sacar `TeacherModule` del árbol, desaparecen juntos el provider,
el token `'TeacherRepository'` y sus consumidores (las factories de los 5
use-cases viven en el mismo módulo). No es una refactorización de límites: es
una poda de una rama muerta cuyo único punto de unión con el resto del sistema
es la línea de import en `app.module.ts` y dos líneas en el frontend.

Capa de dominio (`@educandow/domain`) y schema Prisma quedan intactos: el modelo
`Teacher` sigue siendo FK target de MesaExamen/ActaExamen/SubjectAssignment, y la
entidad/interface de dominio quedan como dead code build-safe (cleanup diferido a
S3b-final). Esto respeta Clean Arch: dominio no depende de infra, así que borrar
la implementación Prisma NO puede romper el dominio ni su barrel de exports.

## Lista definitiva (archivo → acción)

### API — BORRAR (7 archivos)
| Archivo | Acción | Importadores externos |
|---|---|---|
| `api/src/presentation/teacher/teacher.controller.ts` | DELETE | Ninguno (solo `teacher.module.ts`, que también se borra) |
| `api/src/presentation/teacher/teacher.module.ts` | DELETE | Solo `app.module.ts` (se edita) |
| `api/src/presentation/teacher/dto/create-teacher.dto.ts` | DELETE | Solo el controller (se borra) |
| `api/src/presentation/teacher/dto/update-teacher.dto.ts` | DELETE | Solo el controller (se borra) |
| `api/src/application/teacher/use-cases/teacher.use-cases.ts` | DELETE | Solo controller + module (se borran) |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.ts` | DELETE | Solo `teacher.module.ts` (se borra) — S3a ya lo quitó de `course-cycle.module.ts` |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-teacher.repository.spec.ts` | DELETE | Test del repo borrado |

> Nota: la carpeta `api/src/presentation/teacher/` queda vacía tras borrar sus
> 4 archivos (controller, module, 2 DTOs) → eliminar también el directorio.

### API — EDITAR (1 archivo)
| Archivo | Acción |
|---|---|
| `api/src/app.module.ts` | Quitar línea 8 (`import { TeacherModule } ...`) y línea 48 (`TeacherModule,` del array `imports[]`) |

### Web — BORRAR (1 archivo)
| Archivo | Acción | Importadores externos |
|---|---|---|
| `web/src/pages/dashboard/teachers.tsx` | DELETE | Solo `App.tsx` (se edita) |

### Web — EDITAR (2 archivos)
| Archivo | Acción |
|---|---|
| `web/src/App.tsx` | Quitar línea 20 (`import TeachersPage ...`) y línea 66 (`<Route path="/teachers" element={<TeachersPage />} />`) |
| `web/src/components/layout/sidebar.tsx` | Quitar línea 38 (entrada `{ label: 'Docentes', path: '/teachers', moduleCode: 'TEACHERS', requiresLevel: true }`) |

**Totales:** 8 borrados (7 API + 1 web), 3 edits, 1 directorio vacío a remover.
~350-400 líneas eliminadas. Sin migración, sin cambio de schema. Single PR.

## Flujo / integración: qué se corta y qué NO

```
ANTES                                    DESPUÉS (S3b-2)
─────                                    ───────────────
/teachers (CRUD) ─┐                      [eliminado]
                  ├─> TeacherModule ─> 'TeacherRepository' ─> Teacher table
docente-ciclo ────┘ (solo string 'TEACHERS')                      ▲
                                                                  │
MesaExamen/ActaExamen.presidenteId ─ FK Restrict ─────────────────┘ (intacta)
/users + /docentes-x-ciclo ─> User (master) + DocenteXCiclo (tenant) (intacto)
```

- Único punto de unión API cortado: `app.module.ts imports[]`.
- Único punto de unión Web cortado: import + route en `App.tsx` + entrada sidebar.
- Modelo Prisma `Teacher`, FK `presidenteId`, dominio: NO se tocan.

## Decisiones (ADR-style)

### AD-1 — Eliminar el módulo completo, no vaciarlo
**Decisión.** Borrar controller + module + use-cases + repo + DTOs como unidad.
**Razón.** El token DI `'TeacherRepository'` y las 5 factories de use-cases
(`CreateTeacherUseCase`…`UpdateTeacherUseCase`) están provistos y consumidos
EXCLUSIVAMENTE dentro de `teacher.module.ts` (líneas 13-22). Eliminar el módulo
hace desaparecer proveedor y consumidores en el mismo acto → cero dangling DI.
**Evidencia.** `grep 'TeacherRepository'` (string token) → SOLO `teacher.module.ts`.
`grep PrismaTeacherRepository` (código `.ts` vivo) → SOLO `teacher.module.ts` +
su propio spec. S3a (retiro-homeroom-titular) ya removió `PrismaTeacherRepository`
y el token de `course-cycle.module.ts` (confirmado en su archive verify-report).
**Alternativa descartada.** Dejar el módulo vacío con solo el repo: deja DI
huérfano y un módulo sin controller ni propósito; deuda sin beneficio.

### AD-2 — `TeacherModule` no tiene importadores externos → app.module.ts es el único edit DI
**Decisión.** Editar solo `app.module.ts` para sacar el módulo del árbol.
**Razón.** Ningún otro `@Module` importa `TeacherModule` ni consume sus exports
(`'TeacherRepository'`, `PrismaTeacherRepository`).
**Evidencia.** `grep TeacherModule` → solo `app.module.ts` (import + array).
`grep TeacherController` → solo `teacher.module.ts`. Las únicas referencias en
`openspec/changes/archive/**` son documentación histórica, no código.

### AD-3 — Permiso de módulo `TEACHERS` PERMANECE (independiente de TeacherModule)
**Decisión.** NO borrar el registro de permiso `TEACHERS` en master DB.
**Razón.** `docente-ciclo.controller.ts` usa `@Roles('ROOT', { module: 'TEACHERS',
action: 'READ' })` — eso es un STRING literal (el CÓDIGO del permiso), evaluado en
runtime por `RolesGuard` contra la master DB. NO importa `TeacherModule`,
`TeacherController`, ni `TeacherRepository`; solo importa `ListDocentesXCicloUseCase`.
**Evidencia.** Lectura de `docente-ciclo.controller.ts`: imports en líneas 7-15;
ninguno toca el slice de teacher. El guard depende del registro de datos `TEACHERS`,
no del código NestJS. Por lo tanto retirar el CRUD NO rompe `/docentes-x-ciclo`.
**Consecuencia.** El registro de permiso es DATA, no CÓDIGO — fuera del scope de
este change (sin migración, sin seed change).

### AD-4 — Entidad/interface de dominio Teacher quedan dead code build-safe
**Decisión.** Conservar `packages/domain/.../personnel/entities/Teacher` y
`personnel/repositories/teacher-repository.ts` (interface) sin tocar sus barrels.
**Razón.** Una interface TS sin implementación y una entidad sin importador son
código válido que NO rompe `tsc`. El dominio NUNCA importa infra (regla Clean
Arch / dependencias hacia adentro), así que borrar `prisma-teacher.repository.ts`
no puede afectar el barrel de `@educandow/domain`.
**Evidencia.** El barrel de dominio exporta `Teacher`/`TeacherRepository`; sus
únicos importadores en `api/src` eran `teacher.use-cases.ts` y
`prisma-teacher.repository.ts` (ambos se borran). El método `findByUserId` de
`TeacherRepository` (el que parecía cross-cutting) tiene CERO callers de producción:
grading (`list-teacher-course-cycles.use-case.ts`) fue migrado en S3a a
`docenteRepo.findByUserId` (DocenteXCiclo), NO al repo de Teacher — confirmado por
el verify-report de S3a ("Zero TeacherRepository/teacherRepo references"). Tras
borrar el repo Prisma, la interface queda sin impl y sin caller: válido.
**Diferido.** S3b-final elimina entidad + interface + dropea la tabla.

### AD-5 — Frontend: 1 borrado + 2 edits, sin enlaces colaterales
**Decisión.** Borrar `teachers.tsx`, quitar import+route de `App.tsx`, quitar
la entrada sidebar.
**Razón/Evidencia.** `grep TeachersPage|/teachers` en `web/` → SOLO `App.tsx`
(import L20 + route L66), `sidebar.tsx` (L38) y `teachers.tsx` (la página). Ningún
otro componente importa `TeachersPage` ni linkea a `/teachers`. La entrada sidebar
usa `moduleCode: 'TEACHERS'`; tras quitarla, ese código queda sin uso en el front,
pero el guard de API `/docentes-x-ciclo` sigue dependiendo del registro `TEACHERS`
(ver AD-3) — son planos distintos.

### AD-6 — Tests: solo cae el spec del repo borrado
**Decisión.** Borrar `prisma-teacher.repository.spec.ts` junto con su sujeto.
**Razón/Evidencia.** Es el único test que importa símbolos del slice borrado
(`PrismaTeacherRepository`). Ningún otro test referencia los use-cases ni el
controller de teacher. Los matches de `findByUserId` en specs de asistencia /
materia-grupo / grading / docente-ciclo son mocks de `DocenteXCicloRepository`
o `StudentRepository`, NO del repo de Teacher.

### AD-7 — Sin schema, sin migración, single PR
**Decisión.** Cero cambios en `prisma_tenant`/`prisma_master`; un solo PR.
**Razón.** El modelo `Teacher` sobrevive como FK target; el contrato de datos
persistidos no cambia. Diff acotado (~400 líneas, mecánico) → bajo riesgo de
review, no requiere PRs encadenados.

## Riesgos arquitectónicos (heredados de propuesta/exploración)

- **R-GAP (MEDIO, aceptado, producto):** tras S3b-2 ningún path crea filas
  `Teacher` nuevas. Como `presidenteId` sigue siendo FK→Teacher, crear una
  mesa/acta con un presidente sin fila Teacher preexistente queda bloqueado por
  Postgres hasta S3b-3 (migra `presidenteId`→User). Docentes existentes: OK. NO
  es riesgo de orden de este change; es la ventana funcional documentada.
- **R-TEACHERS-MODULE (BAJO, mitigado por AD-3):** no borrar el permiso `TEACHERS`.
- **R-DEAD-DOMAIN (BAJO, mitigado por AD-4):** entidad/interface Teacher dead code,
  build-safe, cleanup en S3b-final.

## Verificación de importadores vs exploración

La exploración se confirma SIN sorpresas. Ningún módulo, reporte o guard fuera del
slice de teacher importa los símbolos a borrar. El único cross-cutting candidato
(`TeacherRepository.findByUserId`) ya no tiene callers de producción desde S3a. No
se dispara ninguna condición STOP-and-report: la poda es segura.
