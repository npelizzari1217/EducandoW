# Design: `notas-get-authz-grupo`

> Fase: sdd-design · Store: hybrid · 2026-06-16
> Lee: `proposal.md`, `explore.md`. Verificado contra el código real (firmas confirmadas, no asumidas).

## Approach (architectural HOW)

Mover la decisión de **scope de lectura** a la capa de autorización (`AssignmentAuthorizer`), exponiéndola por el `AssignmentAuthorizerPort` (dominio). El use-case del GET deja de ser un gate booleano y pasa a un gate con scope: el authorizer responde *quiénes* son los alumnos visibles; el use-case solo filtra el set ya materializado. Esto respeta Clean Arch (authz en el authorizer, orquestación en el use-case) y reusa los lookups que el path de escritura ya hace.

Patrón Door-2/Door-3 (auth-access) intacto: administrative/ROOT → bypass; TEACHER → resolución `DocenteXCiclo → MateriaXCursoXCiclo → grupo → alumnos`.

## Componentes y data flow

```
SubjectGradesController (GRADES:READ guard — Door 1, sin cambios)
        │ execute({ courseCycleId, subjectId, userId, userRoles })
        ▼
GetSubjectGradesBySubjectUseCase
        │ authorizer.getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId)
        ▼
AssignmentAuthorizer  (impl del port)
        ├─ resolveAccessScope(roles).isAdministrative → 'all'
        └─ teacher path → resolveAssignedGrupos(...)  [resolver privado compartido]
                 ├─ TenantContext client → courseCycle.cycleId
                 ├─ docenteRepo.findByUserAndCycle(userId, cycleId)
                 ├─ raw: materiaXCursoXCiclo.findFirst({courseCycleId, subjectId})
                 └─ grupoRepo.findGroupsForDocente(dxc.id, materia.id)  → Grupo[]
                 ▼  grupos.map(g => g.id)
           alumnosXGrupoRepo.findStudentIdsByGrupoIds(grupoIds)  → string[] (dedup)
        ▼
return: string[] | 'all' | null
        ▼
UseCase: null → {forbidden:true};  'all' → students;  string[] → students.filter(s => ids.includes(s.studentId))
```

Punto de integración crítico (validado): `EnrolledStudent.studentId` proviene de `Enrollment.studentId` (= `Student.id`), y `AlumnosXMateriaXCursoXCiclo.studentId` también es un `Student.id`. **Los namespaces coinciden** → el `filter` por `includes` es correcto.

---

## ADR-1 — Tri-state `string[] | 'all' | null` en el port

**Decisión:** el método retorna `Promise<string[] | 'all' | null>`.

| Valor | Semántica |
|---|---|
| `null` | Forbidden. Falla un eslabón de authz: sin client, sin CC, sin DocenteXCiclo, sin materia, o sin grupo asignado. El use-case responde `{forbidden:true}` (→ 403). |
| `'all'` | Bypass administrativo (D3): admin/ROOT ven todo, sin filtro. |
| `string[]` | IDs de alumnos permitidos. **Puede ser `[]`** = el docente tiene grupo(s) pero sin alumnos → grilla vacía (correcto, riesgo de datos, no de código). |

**Por qué el tri-state y no alternativas:**
- *boolean + segunda llamada* (Opción B): re-deriva los 3 lookups en el use-case, mete authz en orquestación. Descartado en explore.
- *`string[]` con `[]` como forbidden*: COLISIONA dos casos distintos — "no autorizado" vs "autorizado sin alumnos". Necesitamos distinguirlos: forbidden → 403; grupo vacío → 200 con grilla vacía. Por eso `null` ≠ `[]`.
- *Sentinela `'all'` vs devolver el set completo de IDs para admin*: materializar todos los IDs para admin sería un query extra inútil; el sentinela hace bypass sin tocar DB de alumnos. El branch `scope === 'all'` evita el `.includes` O(n·m).

La asimetría con `canWriteGrades` (boolean) es intencional: write pregunta "¿puede?", read pregunta "¿qué subconjunto?".

---

## ADR-2 — `findStudentIdsByGrupoIds` en `AlumnosXGrupoRepository` (dos hops)

**Decisión:** nuevo método en el port `AlumnosXGrupoRepository` (dominio) + impl en `PrismaAlumnosXGrupoRepository` (tenant client).

```typescript
// port
findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]>;
```

```typescript
// impl (PrismaAlumnosXGrupoRepository, tenant client)
async findStudentIdsByGrupoIds(grupoIds: string[]): Promise<string[]> {
  if (grupoIds.length === 0) return [];

  // Hop 1: AlumnosXGrupo (NO tiene studentId; tiene la FK a la membresía de materia)
  const axg = await this.client.alumnosXGrupoXCursoXMateriaXCiclo.findMany({
    where: { grupoId: { in: grupoIds } },
    select: { alumnosXMateriaXCursoXCicloId: true },
  });
  if (axg.length === 0) return [];

  // Hop 2: AlumnosXMateriaXCursoXCiclo.studentId
  const axmIds = [...new Set(axg.map((r) => r.alumnosXMateriaXCursoXCicloId))];
  const axm = await this.client.alumnosXMateriaXCursoXCiclo.findMany({
    where: { id: { in: axmIds } },
    select: { studentId: true },
  });

  return [...new Set(axm.map((r) => r.studentId))]; // dedup co-docencia
}
```

**Por qué dos hops (corrección a explore):** `AlumnosXGrupoXCursoXMateriaXCiclo` **no tiene columna `studentId`** — solo `alumnosXMateriaXCursoXCicloId`. El `studentId` vive en `AlumnosXMateriaXCursoXCiclo`. Esto está confirmado por el método existente `findByGrupoEnriched` (mismo patrón de resolución de 2 saltos). La exploración subestimó este path ("Prisma path AlumnosXGrupo → studentId" como un salto).

**Dedup vía `Set`:** co-docencia (`@@unique([grupoId, alumnosXMateriaId])`) permite el mismo alumno en G1 y G2; el `Set` final colapsa duplicados de `studentId`. Guard de `grupoIds.length === 0` evita un `IN ()` vacío.

**Por qué este repo y no el de grupos:** el dato pertenece al agregado AlumnosXGrupo; reusa el client tenant ya inyectado y el patrón de `findByGrupoEnriched`.

---

## ADR-3 — Refactor de `canWriteGrades` a un resolver privado compartido

**Decisión:** extraer un método privado en `AssignmentAuthorizer`:

```typescript
// Devuelve los grupos asignados al teacher, o null si algún eslabón falta.
// null = eslabón roto (sin client/CC/dxc/materia).  [] = resuelto pero sin grupos.
private async resolveAssignedGrupos(
  userId: string, courseCycleId: string, subjectId: string,
): Promise<GrupoXCursoXMateriaXCiclo[] | null> {
  const client = TenantContext.getClient();
  if (!client) return null;
  const cc = await client.courseCycle.findUnique({ where:{uuid:courseCycleId}, select:{cycleId:true} });
  if (!cc) return null;
  const dxc = await this.docenteRepo.findByUserAndCycle(userId, cc.cycleId);
  if (!dxc) return null;
  const materia = await client.materiaXCursoXCiclo.findFirst({ where:{courseCycleId,subjectId}, select:{id:true} });
  if (!materia) return null;
  return this.grupoRepo.findGroupsForDocente(dxc.id, materia.id); // GrupoXCursoXMateriaXCiclo[]
}
```

`canWriteGrades` (teacher path) se reduce a:
```typescript
const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
return grupos !== null && grupos.length > 0;
```

`getAllowedStudentIds` (teacher path):
```typescript
const grupos = await this.resolveAssignedGrupos(userId, courseCycleId, subjectId);
if (grupos === null || grupos.length === 0) return null;
return this.alumnosXGrupoRepo.findStudentIdsByGrupoIds(grupos.map((g) => g.id));
```

**Prueba de no-regresión del write path** (verificado-funcionando, NO debe cambiar):

| Caso | `canWriteGrades` ANTES | resolver | `grupos!==null && length>0` | Igual |
|---|---|---|---|---|
| admin/ROOT | `true` (early) | — (no se llama) | `true` (early) | ✅ |
| sin client | `false` | `null` | `false` | ✅ |
| sin CC | `false` | `null` | `false` | ✅ |
| sin DocenteXCiclo | `false` | `null` | `false` | ✅ |
| sin materia | `false` | `null` | `false` | ✅ |
| grupos vacíos | `false` (`0>0`) | `[]` | `false` | ✅ |
| grupos>0 | `true` | `[g,...]` | `true` | ✅ |

Equivalencia total entrada→salida. La rama `isAdministrative → true` queda **fuera** del resolver (igual que hoy). Los tests existentes del write path (TDD) actúan como red de seguridad. `canAccessCourseCycle` **NO se toca** (usa `findByDocente`, otro path).

**Alternativa (duplicar steps 1–4 en `getAllowedStudentIds`):** evita tocar `canWriteGrades` pero duplica ~12 líneas y viola DRY. Dado que la equivalencia es demostrable y hay tests, se prefiere el resolver compartido. Si el equipo es averso al riesgo, la duplicación es aceptable como fallback.

---

## ADR-4 — Cambios exactos en el use-case

`get-subject-grades-by-subject.use-case.ts`:

- **Líneas 92–94 (reemplazo del gate):**
  ```typescript
  // ANTES
  const canAccess = await this.authorizer.canWriteGrades(userId, userRoles, courseCycleId, subjectId);
  if (!canAccess) return { forbidden: true };
  // DESPUÉS
  const scope = await this.authorizer.getAllowedStudentIds(userId, userRoles, courseCycleId, subjectId);
  if (scope === null) return { forbidden: true };
  ```
- **Línea 104 (filtro tras el fetch):**
  ```typescript
  const allStudents = await this.ccRepo.findEnrolledStudents(courseCycleId);
  const students = scope === 'all' ? allStudents : allStudents.filter((s) => scope.includes(s.studentId));
  ```
  El resto del método (snapshot, period/final grades, ensamblado) usa `students` sin cambios. El branch de `students.length === 0` ya existente cubre el caso grupo-vacío.

**DTO sin cambios:** `SubjectGradesBySubjectResult.students[]` mantiene forma; solo baja el número de filas para teachers.

---

## ADR-5 — Wiring del módulo (DI)

`grading.module.ts`: `AssignmentAuthorizer` pasa de 2 a 3 deps.

```typescript
// agregar el provider del repo (si no está ya exportado por otro módulo):
PrismaAlumnosXGrupoRepository,
{ provide: 'AlumnosXGrupoRepository', useExisting: PrismaAlumnosXGrupoRepository },

// factory del authorizer (3 deps):
{
  provide: AssignmentAuthorizer,
  useFactory: (
    docenteRepo: PrismaDocenteXCicloRepository,
    grupoRepo: PrismaGrupoRepository,
    alumnosXGrupoRepo: PrismaAlumnosXGrupoRepository,
  ) => new AssignmentAuthorizer(docenteRepo, grupoRepo, alumnosXGrupoRepo),
  inject: [PrismaDocenteXCicloRepository, PrismaGrupoRepository, PrismaAlumnosXGrupoRepository],
},
```

**Riesgo DI explícito:** si se agrega el 3er parámetro al constructor de `AssignmentAuthorizer` SIN actualizar `inject:[]` y `useFactory`, NestJS inyecta `undefined` → `getAllowedStudentIds` revienta en runtime (no en compile-time, porque el factory es manual). El constructor del authorizer suma `private readonly alumnosXGrupoRepo: AlumnosXGrupoRepository`. Verificar que `PrismaAlumnosXGrupoRepository` no esté ya provisto en otro módulo importado para no duplicar el provider.

---

## ADR-6 — Estrategia de test (TDD)

Test-first, en este orden:

1. **`assignment-authorizer.service.test.ts`** — `getAllowedStudentIds`, todas las ramas:
   - admin/ROOT → `'all'` (no llama repos).
   - sin client / sin CC / sin dxc / sin materia / grupos vacíos → `null`.
   - grupos>0 con alumnos → `string[]` deduplicado.
   - grupos>0 sin alumnos → `[]` (distinto de `null`).
   - co-docencia: mismo studentId en 2 grupos → aparece una vez.
   - **Regresión write:** re-correr la suite de `canWriteGrades` sin cambios de aserción (prueba el refactor del resolver).
2. **`get-subject-grades-by-subject.use-case.spec.ts`** — migrar los ~8 mocks de `canWriteGrades` a `getAllowedStudentIds`:
   - mock `'all'` → devuelve todos (paridad con tests previos de admin).
   - mock `null` → `{forbidden:true}`.
   - mock `['s1','s2']` → solo esos alumnos en `students[]` (**F5-T8**).
   - mock `[]` → grilla vacía.
   - cruce: alumnos fuera del scope NO aparecen (**F5-T9**).
3. Repo `findStudentIdsByGrupoIds`: unit con mock del tenant client (los 2 hops + dedup + guard `[]`).

F5-T8/T9 satisfechos a nivel unit (mocks). Integración real con DB queda DIFERIDA (patrón del proyecto). Coverage objetivo ≥ 80%.

---

## Boundaries / constraints respetados

- **Clean Arch:** firma del port en `@educandow/domain`; impl en `api`. El use-case no conoce Prisma.
- **Master vs tenant:** todo lo nuevo usa el tenant client vía `TenantContext` (igual que el resto del authorizer y repos). Sin mezcla de schemas.
- **Error-handling:** forbidden → `{forbidden:true}` → 403 en el controller (sin cambios de contrato).
- **DTO inmutable:** confirmado.
- **Write path:** no regresa (ADR-3, tabla de equivalencia).

## Files afectados (confirmados)

| Archivo | Cambio |
|---|---|
| `packages/domain/src/grading/ports/assignment-authorizer.port.ts` | +firma `getAllowedStudentIds` |
| `packages/domain/src/materia-grupo-ciclo/repositories/alumnos-x-grupo-repository.ts` | +firma `findStudentIdsByGrupoIds` |
| `api/src/application/grading/assignment-authorizer.service.ts` | +resolver privado, refactor `canWriteGrades`, +`getAllowedStudentIds`, +dep |
| `api/src/application/grading/get-subject-grades-by-subject.use-case.ts` | gate→scope (L92–94) + filtro (L104) |
| `api/src/presentation/grading/grading.module.ts` | provider AlumnosXGrupo + factory 3 deps |
| `api/.../prisma-alumnos-x-grupo.repository.ts` | impl `findStudentIdsByGrupoIds` (2 hops) |
| `api/.../assignment-authorizer.service.test.ts` | tests método nuevo + regresión write |
| `api/.../get-subject-grades-by-subject.use-case.spec.ts` | migrar mocks + F5-T8/T9 |

## Next: `sdd-tasks` (cuando spec esté listo)
