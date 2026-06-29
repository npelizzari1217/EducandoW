# Explore — responsables-y-tutores

Status: **done** · Store: hybrid (engram topic `sdd/responsables-y-tutores/explore`)

## Resumen ejecutivo

Dos partes. **Parte 1** (`fatherEmail`/`motherEmail` en Student) es un cambio aditivo limpio (~8 archivos). **Parte 2** (extender `StudentGuardian` para tutores de estudio sin cuenta) es un refactor cross-layer de complejidad media; el mayor riesgo está en la migración `relationship` enum→string, en la estrategia de unicidad con `userId` nulo, y en distinguir registros de portal-de-familia vs tutor-de-estudio.

## Parte 1 — fatherEmail / motherEmail en Student

Campos actuales de Student (`api/prisma_tenant/schema.prisma:21-67`): id, firstName, lastName, dni, email?, birthDate?, guardianName?, guardianPhone?, motherName?, fatherDni?, motherDni?, address?, phone?, photoUrl?, userId?, active, deletedAt, fechaDePase?.

`fatherEmail`/`motherEmail` entran como `String?` tras `fatherDni`/`motherDni`, y como `Email?` (VO existente en `packages/domain/src/shared/value-objects/email.ts`) en el dominio.

Touch-points: `schema.prisma:21`, `student.ts` (props+getters), `prisma-student.repository.ts:63,116` (save+toDomain), `student.use-cases.ts:5,104,186` (Create/Patch input + applyChanges), `register.request.ts:62` (CreateStudentSchema), `update-student.dto.ts`, `student.controller.ts:138` (mapStudent), `web/.../students.tsx:200,211,224`. NO se agregan a `ALLOWED_TUTOR_FIELDS` (campos admin-only).

## Parte 2 — Extensión de StudentGuardian

### Estado actual
- Entidad `packages/domain/src/personnel/entities/student-guardian.ts`: props `id, studentId, userId(req), relationship(GuardianRelationship), isFinancialResponsible, isAuthorizedToPickUp, createdAt`. `create()` valida contra `VALID_RELATIONSHIPS`.
- Schema `:76-91`: `userId String` (NOT NULL), `relationship GuardianRelationship` (enum), `@@unique([studentId, userId])`, sin `updatedAt`.

### Impacto de la extensión
- **userId → opcional**: `userId String?`. El `@@unique([studentId, userId])` sigue válido (Postgres trata NULLs como distintos → múltiples tutores sin cuenta por alumno son DB-safe). Ajustar `toDomain()` y props.
- **Queries que filtran por userId — TODAS SAFE**: `GetMyChildren`, `ListStudents(TUTOR)`, `PatchStudent.checkOwnership` usan `findByGuardianUserId(userId)` con userId no-nulo → filas null no matchean. Sin cambio de filtro.
- **`findByComposite(studentId, userId)` — SE ROMPE para tutores**: con `userId=null` matchea TODAS las filas null del alumno. Necesita nueva estrategia de duplicados para el path tutor-de-estudio.
- **`ListGuardiansUseCase`**: `GuardianOutput.userId` → opcional; mapear nuevos campos.

### relationship: enum → string
- **Opción A**: mantener enum + agregar `parentescoLibre String? @db.VarChar(15)`. Pro: cero impacto en filas/consumidores existentes. Con: dos campos paralelos, confusión semántica.
- **Opción B (recomendada)**: migrar a `String @db.VarChar(15)`. Pro: un solo campo, semántica limpia. Con: cascada por 4 capas. Riesgo mitigado: el proyecto regenera la DB tenant sin scripts de migración de datos; los valores existentes (mother/father/legal_guardian/other) son ≤15 chars.

### Campos nuevos en StudentGuardian
`fullName String?`, `mobile String?`, `email String?`, `active Boolean @default(true)`, `updatedAt DateTime @updatedAt`. (nullable en schema, requerido en capa app para tutores). No existe VO `Mobile` — conviene crearlo en `shared/value-objects/` siguiendo el patrón de Email.

### Use cases nuevos
`CreateStudyTutorUseCase` (sin userId; fullName+mobile requeridos), `UpdateStudyTutorUseCase`. `AssignGuardianUseCase` queda para el portal de familias (userId requerido).

## Multitenancy
Student y StudentGuardian viven en `api/prisma_tenant/schema.prisma`. Nada toca master. La referencia cross-DB a `userId` (sin FK) no cambia.

## Comparación de enfoques (Parte 2)
- **A — Extender StudentGuardian (elección del usuario)**: menos archivos; pero la entidad mezcla dos roles y exige desambiguar null-userId. Esfuerzo medio.
- **B — Modelo `StudentTutor` separado**: separación limpia, cero impacto en portal; mucho más código. Esfuerzo alto.
- **C — A + campo discriminador `type`**: intent explícito, filtros de query limpios, mínimo código extra sobre A. Esfuerzo bajo incremental. **Recomendado dentro de la elección del usuario.**

## Preguntas abiertas / riesgos
1. Unicidad de tutor-de-estudio: ¿permitir duplicados (lo maneja la UI) o chequear por `(studentId, fullName)`?
2. `fullName`/`mobile` requeridos vs opcionales en schema: nullable + enforce en app es el path seguro (no rompe filas de portal existentes).
3. Endpoints: ¿reusar `POST /students/:id/guardians` (userId opcional) o `POST /students/:id/study-tutors` (más limpio REST)?
4. `isFinancialResponsible`/`isAuthorizedToPickUp` son conceptos de portal: para tutores serían siempre false → considerar opcionales/excluir del flujo.
5. UI web del panel de guardians (`students.tsx:469+`) es userId-céntrica → necesita rediseño (userId puede ser null, relationship es texto libre).

## next: sdd-propose
