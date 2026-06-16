# Exploration: `notas-get-authz-grupo`

> Fase: sdd-explore · Store: hybrid · 2026-06-16
> Deuda follow-up #1 de `docente-ciclo-grupos` (WARNING-1 / F5-A2 / F5-T8 / F5-T9)

## Corrección a la premisa (verificada en código)

La WARNING-1 del verify-report describía el GET como "todavía usa Teacher+SubjectAssignment". **Esa descripción está desactualizada.** Estado real de `api/src/application/grading/get-subject-grades-by-subject.use-case.ts`:

- **Línea 93**: el gate ya usa `authorizer.canWriteGrades(userId, userRoles, courseCycleId, subjectId)` — grupo-based.
- Cero imports de `SubjectAssignment` / `Teacher`.
- El bypass D3 (gestión/ROOT) ya vive dentro de `AssignmentAuthorizer`.

**El gap real está una capa más abajo**: tras pasar el gate (línea 93), la línea 104 hace `ccRepo.findEnrolledStudents(courseCycleId)` — devuelve **todos** los alumnos del ciclo, sin filtro de grupo. Un TEACHER con solo G1 ve también alumnos de G2. Eso es lo que afirma F5-T8 y exige el delta de notas.

## Asimetría read vs write

| Dimensión | Write (ya hecho) | Read (falta) |
|---|---|---|
| Pregunta | ¿Puede escribir ESTA materia? | ¿QUÉ alumnos puede ver? |
| Forma | `boolean` | `string[] \| 'all' \| null` |
| Admin | `true` (bypass) | `'all'` (sin filtro) |
| Teacher | `true` si tiene grupo | `studentId[]` permitidos |
| Sin grupo | `false` | `null` (forbidden) |

El write es un gate booleano; el read es un gate **con scope** (rechaza Y dice qué subconjunto mostrar).

## Approach recomendado (Opción A)

Nuevo método en `AssignmentAuthorizerPort`:

```typescript
getAllowedStudentIds(
  userId: string,
  userRoles: string[],
  courseCycleId: string,
  subjectId: string,
): Promise<string[] | 'all' | null>
// null = forbidden; 'all' = sin filtro (admin); string[] = IDs permitidos
```

Implementación en `AssignmentAuthorizer` (path teacher):
1. `resolveAccessScope → isAdministrative → 'all'`
2. `DocenteXCiclo.findByUserAndCycle` → null → `null`
3. `materiaXCursoXCiclo.findFirst(courseCycleId, subjectId)` → null → `null`
4. `grupoRepo.findGroupsForDocente(dxc.id, materia.id)` → vacío → `null`
5. `alumnosXGrupoRepo.findStudentIdsByGrupoIds(grupoIds)` → IDs deduplicados (Set)

Nuevo método de repo: `AlumnosXGrupoRepository.findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]>`.

El GET reemplaza el gate de 2 líneas por:
```typescript
const scope = await this.authorizer.getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId);
if (scope === null) return { forbidden: true };
// tras traer students:
const filtered = scope === 'all' ? students : students.filter(s => scope.includes(s.studentId));
```

### Opción B (descartada)
Mantener el gate booleano y re-derivar el scope dentro del use-case. Duplica lookups de DocenteXCiclo+Materia que `canWriteGrades` ya corrió, mete authz en la capa de orquestación (capa equivocada) y agrega 3 deps al use-case. Peor diseño.

| | A (recomendada) | B |
|---|---|---|
| Cambio de port | +1 método | ninguno |
| Lookups DB/request | 5 | 8 |
| Deps del use-case | sin cambio | +3 |
| Ubicación authz | authorizer (correcto) | use-case (mal) |

## Impacto en respuesta
`SubjectGradesBySubjectResult.students[]` no cambia de forma. Solo es más corta para teachers. Sin cambio de DTO/controller/frontend. El frontend ya es grupo-aware (Fase 7).

## D3 bypass
Ya resuelto vía `resolveAccessScope().isAdministrative`. El nuevo método replica el patrón: admin → `'all'`.

## Co-docencia
`@@unique([studentId, courseCycleId, subjectId])` → 1 registro compartido. El filtro de lectura dedup vía Set; si un alumno está en G1 (D1) y G2 (D2), ambos lo ven y leen el mismo registro. Correcto.

## Archivos afectados (~250 líneas, 8 archivos — 1 PR dentro del budget de 400)

| Archivo | Cambio | Líneas |
|---|---|---|
| `packages/domain/.../assignment-authorizer.port.ts` | +firma | +10 |
| `packages/domain/.../alumnos-x-grupo-repository.ts` | +firma | +5 |
| `api/.../assignment-authorizer.service.ts` | implementar + dep | +40 |
| `api/.../get-subject-grades-by-subject.use-case.ts` | reemplazar gate + filtro | +12 / -4 |
| `api/.../grading.module.ts` | wiring AlumnosXGrupo repo | +5 |
| `api/.../prisma-alumnos-x-grupo.repository.ts` | implementar query | +20 |
| `api/.../assignment-authorizer.service.test.ts` | tests método nuevo | +75 |
| `api/.../get-subject-grades-by-subject.use-case.spec.ts` | migrar mocks + F5-T8/T9 | +85 |

## Riesgos
1. **Migración de mocks (alto)**: ~8 tests del GET mockean `canWriteGrades`; todos deben pasar a `getAllowedStudentIds` o crashean en runtime de test.
2. **Wiring del módulo**: `AssignmentAuthorizer` pasa de 2 a 3 deps; el factory en `grading.module.ts` debe inyectar `PrismaAlumnosXGrupoRepository` o falla la DI de NestJS en runtime.
3. **Grupo vacío**: teacher con grupo sin alumnos ve grilla vacía (correcto; riesgo de datos, no de código).
4. **F5-T8/T9 como integration tests reales** siguen diferidos; las versiones unit (mocks) bastan para desbloquear el spec.

## Siguiente paso
`sdd-propose`.
