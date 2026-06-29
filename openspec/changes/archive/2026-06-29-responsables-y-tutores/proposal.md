# Proposal — responsables-y-tutores

Status: **done** · Store: hybrid (engram topic `sdd/responsables-y-tutores/proposal`)

## Intent
Registrar el email de cada responsable legal en el legajo del alumno y permitir que un alumno tenga tutores de estudio que sean solo contacto (sin cuenta de portal). Hoy `StudentGuardian` exige `userId`, así que un tutor sin login no puede registrarse, y el legajo no guarda los emails de padre/madre. Éxito: un admin puede cargar emails de responsables y dar de alta/editar tutores de estudio (con o sin cuenta) reutilizando una sola entidad.

## Scope
**In:** Parte 1 — `fatherEmail`/`motherEmail` en `Student`. Parte 2 — extender `StudentGuardian` como entidad única (userId opcional + nuevos campos + `relationship` texto libre), nuevo VO `Mobile`, use cases `CreateStudyTutorUseCase`/`UpdateStudyTutorUseCase`. Cascada por las 4 capas (schema → domain → application → presentation). **Parte 3 — UI web**: formulario de alta/edición de tutor de estudio + listado de tutores en el panel del alumno (incluye adaptar el panel actual userId-céntrico para mostrar tutores sin cuenta y parentesco texto libre, y pre-cargar email del legajo como default editable).
**Out:** notificaciones/mensajería, FK cross-DB a `userId`, tocar `prisma_master`. Por tamaño, el change se entrega en **PRs encadenados** (backend → UI).

## Approach
**Parte 1 (aditivo):** `fatherEmail String?`/`motherEmail String?` en `Student` (tenant) tras `fatherDni`/`motherDni`; en dominio como `Email?` (VO existente). No entran en `ALLOWED_TUTOR_FIELDS` (admin-only).

**Parte 2 (refactor cross-layer):** `userId` → opcional; "tiene portal" se infiere de `userId != null`. Nuevos campos: `fullName`, `mobile`, `email`, `active @default(true)`, `updatedAt @updatedAt` (entidad ahora mutable). `relationship` migra de enum `GuardianRelationship` a `String @db.VarChar(15)` (seguro: la DB tenant se regenera sin scripts; valores actuales ≤15ch). VO `Mobile` nuevo en `shared/value-objects/` siguiendo el patrón de `Email`. `CreateStudyTutorUseCase` (sin userId; fullName+mobile requeridos en app), `UpdateStudyTutorUseCase`; `AssignGuardianUseCase` queda para enlaces de portal (userId requerido).

**Regla cross-part:** al crear un tutor que es padre/madre, pre-cargar su email desde `Student.fatherEmail/motherEmail` como DEFAULT editable (legajo y mensajería pueden divergir).

## Key decisions (recomendadas)
- **Endpoints:** set unificado de guardian/tutor con `userId` opcional (no rutas `/study-tutors` separadas). Tradeoff: menos superficie REST y una sola entidad coherente, a costa de un body con campos condicionales.
- **Unicidad con userId nulo:** mantener `@@unique([studentId, userId])` (NULLs distintos en Postgres) + **chequeo app-level por `(studentId, fullName)`** para evitar duplicados accidentales sin bloquear homónimos legítimos vía override.
- **`fullName`/`mobile`:** nullable en schema, requeridos en capa app (no rompe filas de portal existentes).
- **`isFinancialResponsible`/`isAuthorizedToPickUp`:** opcionales/default-false; no se fuerzan en el flujo de tutor de estudio.

## Nivel pedagógico afectado
TODOS (Inicial, Primario, Secundario, Terciario): es dato transversal de alumno/tutor.

## Risks
- Migración enum→string depende de regenerar DB tenant sin datos a preservar.
- `findByComposite(studentId, userId)` se rompe con userId nulo → el path tutor exige la nueva estrategia de unicidad.
- UI web de guardians es userId-céntrica → hay que adaptarla (ahora **dentro** de alcance, Parte 3); riesgo de tamaño de PR → encadenar backend / UI.
