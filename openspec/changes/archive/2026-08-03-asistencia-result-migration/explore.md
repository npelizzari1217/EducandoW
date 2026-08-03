# Exploration — asistencia-result-migration (épico error-handling)

> EL slice más grande del épico: 41 throws, 6 use-cases, ~1200-1800 líneas de diff → 4 chained PRs.
> Verificado leyendo el código. Corrige la nota del épico ("100% domain-wrap" era incorrecta).

## Resumen ejecutivo

41 throws en 6 files. 22 son `ForbiddenError` (autorización, caller-context) + 19 DomainError
intrínsecos. **No hay bug de status**: `FORBIDDEN: 403` ya está en `DOMAIN_STATUS` (exception.filter.ts:13).
Reclasificar `ForbiddenError` a `ApplicationError` es transversal (~19 archivos, 8 módulos) → **fuera
de scope**; se difiere a un follow-up aparte. asistencia hace la migración MECÁNICA (throw→Result,
`ForbiddenError` queda DomainError). Tamaño ~1200-1800 líneas → 4 PRs stacked. Rama desde main.

## Inventario y clasificación (41 throws)

| Clase | Extends | Code | DOMAIN_STATUS | Count | Clasif. |
|---|---|---|---|---|---|
| `ForbiddenError` | DomainError | FORBIDDEN | **403** | 22 | caller-context (ver fork) |
| `NotFoundError` | DomainError | NOT_FOUND | 404 | 6 | intrínseco ✓ |
| `ValidationError` | DomainError | VALIDATION_ERROR | 400 | 4 | intrínseco ✓ |
| `DayNotAssignableError` | DomainError | DAY_NOT_ASSIGNABLE | 422 | 4 | intrínseco ✓ |
| `StatusNotAssignableError` | DomainError | STATUS_NOT_ASSIGNABLE | 400 | 2 | intrínseco ✓ |
| `MonthClosedError` | DomainError | MONTH_CLOSED | 409 | 2 | intrínseco ✓ |
| `PreviousMonthOpenError` | DomainError | PREVIOUS_MONTH_OPEN | 409 | 1 | intrínseco ✓ |

Los 19 no-Forbidden son DomainError correctos, reuso as-is. `generate-monthly` ya está a medias
(retorna `Result<GenerationResult, PresenteTypeNotFoundError>`; sus 4 throws legacy sin tocar).

## EL FORK — ForbiddenError (nota del épico era incorrecta)

`ForbiddenError extends DomainError` (code FORBIDDEN, ya mapea 403). "Forbidden" es caller-context →
conceptualmente ApplicationError. PERO se usa en ~19 archivos de producción en 8 módulos (asistencia,
asistencia-reporting, asignacion-curso, grading, institution, nivel-terciario, student,
student-observation) + 4 controllers con `instanceof ForbiddenError`. Reclasificar = cross-cutting.

Existe `api/src/application/shared/errors/authorization-errors.ts` (ApplicationError: InsufficientRoleHierarchyError,
CrossInstitutionForbiddenError, del piloto users) — precedente de archivo de auth compartido, pero
purpose-built para users, no drop-in para el ForbiddenError genérico.

- **Opción A (RECOMENDADA)**: migrar los 41 throws a `return err(...)` incl. los 22 ForbiddenError,
  dejando `ForbiddenError` como DomainError (ya da 403). asistencia cumple "no throw en application/"
  sin tocar la clasificación transversal. Reclasificar `ForbiddenError` → ApplicationError = follow-up
  aparte (~19 archivos), idealmente DESPUÉS de migrar los módulos que lo tiran (para que sea un
  rename+status-move de una sola pasada, no un blanco móvil).
- **Opción B (reclasificar ahora)**: RECHAZADA — toca 7 módulos fuera de scope de Result, infla el
  diff para cero beneficio asistencia-específico. Anti-YAGNI.
- **Opción C (ApplicationError asistencia-local)**: RECHAZADA — fragmenta el concepto "forbidden",
  contradice el archivo compartido existente, no compra nada (ya da 403).

## Return types (6 use-cases)

- `RecordSubjectAttendanceDayUseCase`: `Promise<AsistenciaXMateriaXAlumnoXCursoXCiclo>` →
  `Result<..., MonthClosed|NotFound|Validation|DayNotAssignable|StatusNotAssignable|Forbidden>`.
- `RecordGeneralAttendanceDayUseCase`: idem con `AsistenciaXAlumnoXCursoXCiclo`.
- `ListSubjectAttendanceUseCase`: `Promise<EnrichedMateriaAttendance[]>` → `Result<..., ForbiddenError>`.
- `ListGeneralAttendanceUseCase`: `Promise<EnrichedGeneralAttendance[]>` → `Result<..., ForbiddenError>`.
- `GenerateMonthlyAttendanceUseCase`: widen union → `+ ForbiddenError|NotFoundError|PreviousMonthOpenError`.
- `Get/Open/CloseAttendanceMonthUseCase` (×3): `Promise<AttendanceMonthStatusResult>` →
  `Result<..., NotFoundError>`. OJO: helper compartido `assertCourseCycleExists` (usado por los 3) hoy
  tira — decidir en design si pasa a Result o se inlinea.

## Controller (asistencia.controller.ts, 7 endpoints)

5 de 7 tienen `try/catch` con `if (err instanceof ForbiddenError) throw new ForbiddenException(...)`.
Ese remap es REDUNDANTE hoy (FORBIDDEN ya = 403). Simplificar a `if(isErr) throw unwrapErr()` (patrón
de attendance-type.controller.ts; NO usar unwrapResultOrThrow — ese es para ApplicationError|PdfError,
y acá el union es puro DomainError). Los 7 endpoints se retrofitean (5 pierden try/catch, 2 ganan isErr).

## Impacto en tests — grande

7 test files, 117 `it()` (102 use-case + 15 controller), 34 asserts de error-path. CLAVE: Result
cambia también la forma del SUCCESS → hay que tocar CASI TODOS los ~117 bloques (no solo los 34 de
error): cada happy-path `expect(await uc.execute()).toEqual()` pasa a `.unwrap()`. Controller: cada
mock `UC.execute` pasa a resolver `ok(value)`; CTR-T02/T04/T06 pasan de `toBeInstanceOf(ForbiddenException)`
a `toBeInstanceOf(ForbiddenError)` (403 igual, cambia identidad de excepción, NO es bug fix).

## Tamaño + delivery — 4 chained PRs

~1108 prod + ~1993 test ≈ 3100 líneas tocadas; diff estimado **~1200-1800 líneas** (3-4.5× budget).
**400-line budget risk: HIGH. Chained PRs: YES. Decision before apply: YES.**

Constraint de slicing: como Result cambia el success return, el controller call-site DEBE cambiar en
el mismo PR que su use-case. Unidad atómica = (use-case + tests + su endpoint + tests del controller).

Breakdown (stacked, cada uno targetea al anterior):
1. **PR1 — list pair**: list-general + list-subject (9 Forbidden) + endpoints + tests.
2. **PR2 — record-general**: record-general-attendance-day (11 throws) + endpoint + tests.
3. **PR3 — record-subject**: record-subject-attendance-day (15 throws, el más grande) + endpoint + tests.
4. **PR4 — generate + month-status**: widen generate-monthly (4 legacy) + attendance-month-status
   (3 use-cases, helper assertCourseCycleExists) + endpoints + tests.

Aún PR1 puede rozar 400 por el costo del rewrite de success-shape. `sdd-tasks` re-forecast exacto;
puede requerir subdividir PR1 (list-general solo / list-subject solo) o `size:exception` por PR.

## Rama

Desde `main` (verificar que attendance-type-result-migration esté mergeado). Sin changes activos.

## Riesgos / preguntas para propose

1. **Fork ForbiddenError** → decisión usuario (Opción A recomendada).
2. Granularidad chained no fija-verificada — diffs reales pueden forzar más splits o size:exception.
3. Controller: los 5 try/catch ForbiddenError→ForbiddenException son dead code → simplificar (cleanup,
   no scope creep).
4. CTR-T02/T04/T06: rewrite de identidad de excepción (403 igual, no bug fix).
5. `assertCourseCycleExists` (helper de los 3 month-status): decidir Result vs inline en design.
6. generate-monthly ya medio migrado → union-widening, menor riesgo.
