# Proposal — pase-alumno-egreso

## Intent

**Problem**: En **CursosXCiclo > Alumnos** (`web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`) no hay forma de registrar que un alumno egresó por **pase a otra institución**. Hoy la única acción terminal es "Quitar", que hace un hard DELETE de la inscripción y borra el rastro. El pase es un evento administrativo real que debe quedar registrado y visible, sin perder al alumno del listado.

**Why now**: Las instituciones necesitan documentar el egreso por pase para trazabilidad académica; el dato no existe en el modelo y se está perdiendo información cada vez que se usa "Quitar" como sustituto.

**Success looks like**: En cada fila del panel hay un botón **"Pase"** junto a "Asignar materias", "Asignar competencias" y "Quitar". Al hacer click se abre un modal que pide la **fecha del pase**. Al confirmar, el alumno **sigue apareciendo en el listado pero TACHADO**, y se muestran dos columnas nuevas: **"Pase"** y **"Fecha de pase"**.

## Scope

**In scope**
- Migración Prisma **aditiva** en schema **tenant**: `Student.fecha_de_pase TIMESTAMPTZ NULL` (ADD COLUMN nullable). Nunca a mano.
- Use-case para registrar el pase (marca de egreso), con validación Zod.
- Endpoint PATCH que registra la fecha de pase resolviendo el `studentId` desde la fila de inscripción.
- Enriquecer la query del listado (`findByCourseCycleEnriched`) y los tipos de dominio/DTO con `fechaDePase`.
- UI: botón "Pase" + modal de fecha, fila tachada cuando hay pase, columnas "Pase" y "Fecha de pase".
- Tests (TDD estricto, Vitest, coverage ≥80%) en domain/application/web.

**Out of scope**
- **NO** es transferencia cross-tenant: no se mueve ni copia el alumno a otra institución/tenant.
- No se toca el schema **master**.
- No se borra ni desactiva al alumno; "Quitar" conserva su semántica de DELETE.

## Decisions (baked in)

1. **Marca de egreso por pase**, no transferencia de datos. Solo se registra que el alumno egresó por pase.
2. El campo `fecha_de_pase` (nullable, TIMESTAMPTZ) vive en la tabla **`Student`** (el alumno entero), **NO** en `alumnos_x_curso_x_ciclo`. El pase es **GLOBAL**: el alumno aparece tachado en **todos** sus cursos/ciclos. (Se descarta la recomendación de la exploración de ponerlo en la inscripción.)
3. **Nivel pedagógico afectado: ALL** — el pase es del alumno, agnóstico al nivel.
4. **Clean/Hexagonal**: puerto en `packages/domain`, impl en `api/infrastructure` (cliente tenant), orquestación en application, controller fino.

## Open questions (resolver en design)

- ¿Se bloquea/deshabilita "Quitar" cuando el alumno ya tiene pase? ¿"Pase" es reversible (des-marcar → `fecha_de_pase = null`)?
- ¿Los alumnos con pase se ordenan al final del listado o quedan en su lugar, solo tachados?
- Forma del endpoint: la pantalla maneja `rowId` de inscripción pero el campo vive en `Student`. Definir ruta (¿`PATCH /students/:studentId/pase` vs `PATCH /alumnos/:rowId/pase` que resuelve `studentId`?).

## Rollback plan

La migración es aditiva (columna nullable); rollback = `DROP COLUMN fecha_de_pase` + revertir código. Sin pérdida de datos preexistentes.
