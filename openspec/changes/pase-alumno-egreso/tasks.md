# Tasks — pase-alumno-egreso

> Change: pase-alumno-egreso  
> Strategy: auto-chain (4 PRs autónomos, secuenciales)  
> TDD: estricto — test RED antes de cada implementación. Runner: `pnpm test`. Coverage ≥ 80%.  
> Clean Arch order: Persistence → Domain → Application → Infrastructure → Presentation → Web  
> Specs satisfechas: S-1 … S-11 (spec.md).

---

## Review Workload Forecast

| PR | Scope | Est. líneas | Chained recomendado | Riesgo budget 400 |
|----|-------|-------------|---------------------|-------------------|
| PR1 | Prisma + Domain | ~245 | — (es el primero) | Bajo |
| PR2 | Application + Infrastructure | ~385 | Requiere PR1 merged | Moderado (≈385) |
| PR3 | Presentation (API) | ~135 | Requiere PR2 merged | Bajo |
| PR4 | Web | ~285 | Requiere PR3 merged | Bajo |
| **TOTAL** | | **~1 050** | **Sí — 4 PRs** | **PR2 cerca del límite** |

- **Chained PRs recommended**: YES (total ~1 050 líneas; ningún PR singular supera 400).
- **Riesgo budget 400 líneas**: PR2 es el más denso (~385). Si tests de infra superan lo estimado, puede cruzar la línea; monitorear durante apply.
- **Decision needed before apply**: NO — strategy `auto-chain` ya cacheada; implementar PR1 primero.

---

## Dependency graph

```
PR1 (domain+persistence)
  └─> PR2 (application+infra)
        └─> PR3 (presentation)
              └─> PR4 (web)
```

Dentro de cada PR las tareas son secuenciales (TypeScript necesita los tipos antes de compilar los tests). No hay paralelismo intra-PR excepto donde se indica explícitamente.

---

## PR1 — Persistence + Domain  (~245 líneas)

> Shipeable solo: compila y los tests de domain pasan. No toca application ni presentation.  
> Spec satisfecha: S-1, S-10.

### 1.1 [TEST — RED] Unit tests: Student entity (domain)

**Archivo nuevo**: `packages/domain/src/personnel/entities/__tests__/student-pase.test.ts`

Escribir ANTES de implementar. Cubrir:

- `Student.reconstruct({ ..., fechaDePase: new Date('2026-06-01') }).tienePase` → `true`
- `Student.reconstruct({ ..., fechaDePase: undefined }).tienePase` → `false`
- `student.registrarPase(new Date('2026-06-01'))` → `student.fechaDePase` queda seteado
- `student.registrarPase(futureDate)` → lanza `PaseFechaInvalidaError`
- `student.revertirPase()` → `student.fechaDePase` queda `undefined`, `tienePase` → `false`
- `student.revertirPase()` en alumno sin pase → sin error, sin efecto

Tests fallan (RED) porque los métodos no existen aún.

**Satisface**: S-1-B, S-1-C, S-2-C, S-3-D, S-4-A, S-4-B.

---

### 1.2 Crear errores de dominio

**Archivos nuevos** (en `packages/domain/src/shared/errors/`):

- `pase-fecha-invalida-error.ts` — extiende `DomainError`; code `PASE_FECHA_INVALIDA`; mensaje "La fecha de pase no puede ser futura".
- `student-has-pase-error.ts` — extiende `DomainError`; code `STUDENT_HAS_PASE`; mensaje "No se puede quitar un alumno con pase registrado; revertí el pase primero".

Exportar desde el barrel de `shared/errors` (o desde el barrel principal de `@educandow/domain`).

**Satisface**: S-3-D, S-5-A.

---

### 1.3 Actualizar entidad `Student`

**Archivo**: `packages/domain/src/personnel/entities/student.ts`

Cambios en `StudentProps`:
```ts
fechaDePase?: Date;
```

Agregar a la clase `Student`:
```ts
get fechaDePase(): Date | undefined { return this.props.fechaDePase; }
get tienePase(): boolean { return this.props.fechaDePase != null; }

registrarPase(fecha: Date): void {
  if (fecha > new Date()) throw new PaseFechaInvalidaError();
  this.props.fechaDePase = fecha;
}

revertirPase(): void {
  this.props.fechaDePase = undefined;
}
```

`reconstruct()`: propagar `fechaDePase` desde props (ya queda implícito con spread).  
`create()`: `fechaDePase` queda `undefined` por defecto (no hace falta cambio explícito).

**Tests de 1.1 deben pasar (GREEN) luego de este paso.**

**Satisface**: S-1-A, S-1-B, S-1-C, S-2-A, S-4-A, S-4-B.

---

### 1.4 Actualizar puertos de domain

**Archivo**: `packages/domain/src/personnel/repositories/student-repository.ts`

Agregar al interface:
```ts
setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void>;
```

**Archivo**: `packages/domain/src/course-cycle/repositories/alumnos-x-curso-x-ciclo-repository.ts`

Agregar a `AlumnoCursoCicloEnriched`:
```ts
fechaDePase: string | null;   // ISO 8601 o null
```

**Satisface**: S-6-A, S-6-D.

---

### 1.5 Actualizar schema Prisma (tenant)

**Archivo**: `api/prisma_tenant/schema.prisma`

En el model `Student` (`@@map("students")`), agregar campo:
```prisma
fechaDePase DateTime? @db.Timestamptz(6) @map("fecha_de_pase")
```

Nullable, sin default. Posición: junto a otros campos opcionales del modelo, antes de los `@@` de mapeo.

**NO tocar** `api/prisma_master/schema.prisma`.

**Satisface**: S-10-A, S-10-C.

---

### 1.6 Generar migración y regen clientes

Ejecutar en orden:
```bash
pnpm --filter api prisma:migrate:tenant
# cuando Prisma pregunte nombre: add_fecha_de_pase_to_student
pnpm --filter api prisma:generate
```

Verificar que el archivo `api/prisma_tenant/migrations/<TS>_add_fecha_de_pase_to_student/migration.sql` contiene exactamente:
```sql
ALTER TABLE "students" ADD COLUMN "fecha_de_pase" TIMESTAMPTZ(6);
```

**No editar el SQL a mano.**

Commit la migración junto con el schema actualizado.

**Satisface**: S-10-A, S-10-B, S-10-C.

---

### 1.7 [VERIFY PR1] Build + tests domain

```bash
pnpm build
pnpm test
```

Criterio de done: compila sin errores de tipo; los tests de `student-pase.test.ts` pasan en GREEN; coverage ≥ 80% en el scope domain.

---

## PR2 — Application + Infrastructure  (~385 líneas)

> Requiere PR1 merged.  
> Shipeable solo: la API NO está expuesta todavía (sin controller nuevo), pero los use-cases y repos compilan y sus tests pasan.  
> Spec satisfecha: S-2, S-3, S-4, S-5, S-6, S-7.

### 2.1 [TEST — RED] Unit tests: `RegistrarPaseUseCase`

**Archivo nuevo**: `api/src/application/course-cycle/__tests__/registrar-pase.use-case.test.ts`

Cubrir (todos en RED antes de implementar):

- **Happy path — registrar**: ccRepo OK, enrollment pertenece al cc, student existe, `fechaDePase` válida → `studentRepo.setFechaDePase` llamado con `(studentId, fecha)`.
- **Revert**: `fechaDePase: null` → `studentRepo.setFechaDePase(studentId, null)`.
- **NotFound — cc**: `ccRepo.findByUuid` devuelve null → `NotFoundError`.
- **NotFound / IDOR**: enrollment no existe O `enrollment.courseCycleId !== ccId` → `NotFoundError`.
- **NotFound — student**: `studentRepo.findById` devuelve null → `NotFoundError`.
- **Fecha futura**: `student.registrarPase(futureDate)` lanza `PaseFechaInvalidaError` → use-case propaga error.

Mock de `StudentRepository` debe incluir `setFechaDePase: vi.fn()`.

**Satisface**: S-2-A, S-2-B, S-2-C, S-3-D, S-4-A, S-4-B.

---

### 2.2 [TEST — RED] Actualizar tests de `RemoveStudentFromCourseCycleUseCase`

**Archivo**: `api/src/application/course-cycle/__tests__/remove-student-from-course-cycle.use-case.test.ts`

Agregar:
- Importar `StudentRepository` del dominio.
- Agregar helper `makeStudentRepo(tienePase: boolean)` con `setFechaDePase: vi.fn()`.
- **Nuevo test S-5-A**: enrollment existe, alumno tiene `tienePase = true` → lanza `StudentHasPaseError`.
- **Nuevo test S-5-B**: enrollment existe, alumno sin pase → `remove` se llama normalmente (comportamiento preexistente sin cambio).

Tests fallan (RED) porque el use-case no tiene aún la guarda.

**Satisface**: S-5-A, S-5-B.

---

### 2.3 Actualizar ALL mocks de `StudentRepository`

**Archivos a actualizar** (agregar `setFechaDePase: vi.fn().mockResolvedValue(undefined)` a cada mock-object):

- `api/src/application/course-cycle/__tests__/add-student-to-course-cycle.use-case.test.ts` → función `makeStudentRepo`
- `api/src/application/materia-grupo-ciclo/__tests__/add-student-to-materia.use-case.test.ts`
- `api/test/unit/patch-student.use-case.test.ts`
- `api/test/unit/assign-guardian.use-case.test.ts`
- `api/test/unit/get-my-children.use-case.test.ts`
- `api/test/unit/get-my-student-data.use-case.test.ts`
- `api/test/integration/guardians.test.ts`

Verificar con `rg "implements StudentRepository"` que no haya mocks adicionales. Todos deben satisfacer la interfaz actualizada (TypeScript compilará en error si falta alguno).

> GOTCHA: Algunos mocks usan `as unknown as StudentRepository` (cast), lo que puede ocultar el error de tipo. Aún así, agregar el método por consistencia y para que el TDD sea honesto.

**Satisface**: prerequisito de compilación para PR2.

---

### 2.4 Implementar `RegistrarPaseUseCase`

**Archivo nuevo**: `api/src/application/course-cycle/registrar-pase.use-case.ts`

Firma:
```ts
@Injectable()
export class RegistrarPaseUseCase {
  constructor(
    private readonly ccRepo: CourseCycleRepository,
    private readonly alumnosRepo: AlumnosXCursoXCicloRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async execute(input: { courseCycleId: string; id: string; fechaDePase: Date | null }): Promise<void>
}
```

Flujo (ver design §3.3):
1. `ccRepo.findByUuid(courseCycleId)` → `NotFoundError('CourseCycle')` si null.
2. `alumnosRepo.findById(id)` → `NotFoundError` si null O `row.courseCycleId !== courseCycleId` (IDOR).
3. `studentRepo.findById(row.studentId)` → `NotFoundError('Student')` si null.
4. `fechaDePase ? student.registrarPase(fechaDePase) : student.revertirPase()` (invariante en dominio).
5. `studentRepo.setFechaDePase(student.id.get(), student.fechaDePase ?? null)`.

**Tests de 2.1 deben pasar (GREEN) luego de este paso.**

**Satisface**: S-2-A, S-2-B, S-2-C, S-4-A, S-4-B, S-7-A, S-7-B.

---

### 2.5 Actualizar `RemoveStudentFromCourseCycleUseCase`

**Archivo**: `api/src/application/course-cycle/remove-student-from-course-cycle.use-case.ts`

- Agregar `StudentRepository` al constructor como 3er argumento.
- Antes del `this.alumnosRepo.remove(...)`, insertar:
  ```ts
  const student = await this.studentRepo.findById(enrollment.studentId);
  if (student?.tienePase) throw new StudentHasPaseError();
  ```

**Tests de 2.2 deben pasar (GREEN) luego de este paso.**

> GOTCHA: `enrollment.studentId` debe existir como getter en `AlumnosXCursoXCiclo`. Verificar en apply que el entity lo expone. Si no, leer `enrollment.props.studentId` con el patrón del codebase.

**Satisface**: S-5-A, S-5-B.

---

### 2.6 Implementar `PrismaStudentRepository.setFechaDePase` + `toDomain`

**Archivo**: `api/src/infrastructure/persistence/prisma/repositories/prisma-student.repository.ts`

- Agregar método:
  ```ts
  async setFechaDePase(studentId: string, fechaDePase: Date | null): Promise<void> {
    await this.client.student.update({ where: { id: studentId }, data: { fechaDePase } });
  }
  ```
- En `toDomain(record)`: agregar `fechaDePase: record.fechaDePase ?? undefined`.

**Satisface**: S-2-A, S-4-A (persistencia de invariantes).

---

### 2.7 Actualizar `findByCourseCycleEnriched` en `PrismaAlumnosXCursoXCicloRepository`

**Archivo**: `api/src/infrastructure/persistence/prisma/repositories/prisma-alumnos-x-curso-x-ciclo.repository.ts`

Cambios en `findByCourseCycleEnriched`:
- En el `select` del query de students: agregar `fechaDePase: true`.
- En la proyección del `studentMap` / resultado: `fechaDePase: s?.fechaDePase ? s.fechaDePase.toISOString() : null`.
- El `sort` (apellido+nombre, es-AR) NO se toca.

**Satisface**: S-6-A, S-6-B, S-6-C, S-6-D.

---

### 2.8 [VERIFY PR2] Build + tests

```bash
pnpm build
pnpm test
```

Criterio de done: compila; todos los tests de application y infra pasan; coverage ≥ 80% en scopes `domain` y `api`.

> Si PR2 supera 400 líneas reales al hacer el diff, notificar al orquestador y considerar mover 2.7 + 2.6 a un PR2b separado.

---

## PR3 — Presentation (API layer)  (~135 líneas)

> Requiere PR2 merged.  
> Shipeable solo: endpoint PATCH `/course-cycles/:ccId/alumnos/:id/pase` operativo.  
> Spec satisfecha: S-3, S-5, S-11.

### 3.1 [TEST — RED] Tests del controller — handler `registrarPase`

**Archivo**: agregar casos en el test de controller existente (o crear `registrar-pase.controller.spec.ts` si el test del controller es un archivo separado — verificar pattern del codebase).

Cubrir:
- **204**: body `{ fechaDePase: "2026-06-25" }` válido → use-case llamado, responde 204.
- **204 revert**: body `{ fechaDePase: null }` → use-case llamado con `fechaDePase: null`.
- **422**: body sin `fecha` o con formato inválido (`"no-es-fecha"`) → Zod rechaza, 422.
- **400**: body `{ fechaDePase: "2027-12-31" }` (futuro) → use-case lanza `PaseFechaInvalidaError` → filter mapea a 400.
- **404**: use-case lanza `NotFoundError` → filter mapea a 404.
- **409**: use-case lanza `StudentHasPaseError` → filter mapea a 409.

**Satisface**: S-3-A, S-3-B, S-3-C, S-3-D, S-3-E, S-11-A, S-11-B, S-11-C, S-11-D, S-11-E.

---

### 3.2 Actualizar DTO

**Archivo**: `api/src/presentation/course-cycle-alumnos/dto/alumnos-x-curso-x-ciclo.dto.ts`

Agregar:
```ts
export const RegistrarPaseSchema = z.object({
  fechaDePase: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado YYYY-MM-DD')
    .nullable(),
});
export type RegistrarPaseDto = z.infer<typeof RegistrarPaseSchema>;
```

En `AlumnoCursoCicloItem` (la interfaz de respuesta del GET):
```ts
fechaDePase: string | null;
```

**Satisface**: S-3-A, S-3-B, S-6-D, S-11-A.

---

### 3.3 Agregar handler al controller

**Archivo**: `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.controller.ts`

Nuevo método (declararar junto a los handlers `:id/printable` — estáticas antes que `:id/...`):
```ts
@Patch('course-cycles/:ccId/alumnos/:id/pase')
@HttpCode(204)
@Roles('ROOT', { module: 'COURSE_CYCLES', action: 'UPDATE' })
async registrarPase(
  @Param('ccId') ccId: string,
  @Param('id') id: string,
  @Body(new ZodValidationPipe(RegistrarPaseSchema)) body: RegistrarPaseDto,
): Promise<void> {
  const fechaDePase = body.fechaDePase
    ? new Date(`${body.fechaDePase}T00:00:00.000Z`)
    : null;
  await this.registrarPaseUC.execute({ courseCycleId: ccId, id, fechaDePase });
}
```

Inyectar `RegistrarPaseUseCase` en el constructor.

**Satisface**: S-11-A, S-11-B, S-11-C, S-11-D, S-11-E.

---

### 3.4 Actualizar module

**Archivo**: `api/src/presentation/course-cycle-alumnos/alumnos-x-curso-x-ciclo.module.ts`

- Agregar provider `RegistrarPaseUseCase` con `useFactory`:
  ```ts
  {
    provide: RegistrarPaseUseCase,
    useFactory: (ccRepo, alumnosRepo, studentRepo) =>
      new RegistrarPaseUseCase(ccRepo, alumnosRepo, studentRepo),
    inject: [PrismaCourseCycleRepository, PrismaAlumnosXCursoXCicloRepository, 'StudentRepository'],
  }
  ```
- Actualizar el factory de `RemoveStudentFromCourseCycleUseCase`: inyectar `'StudentRepository'` como 3er argumento:
  ```ts
  inject: [PrismaCourseCycleRepository, PrismaAlumnosXCursoXCicloRepository, 'StudentRepository'],
  ```
- Verificar que `StudentModule` (que exporta el token `'StudentRepository'`) está en los `imports` del module. Si no, agregarlo.

> GOTCHA: El token `'StudentRepository'` en NestJS DI debe coincidir exactamente con el nombre de string usado en `StudentModule`. Verificar en apply antes de asumir.

**Satisface**: prerequisito de DI para S-2 y S-5.

---

### 3.5 Actualizar exception filter

**Archivo**: `api/src/presentation/exception.filter.ts` (o el archivo que contenga `DOMAIN_STATUS` / la tabla de mapeo código-dominio → HTTP).

Agregar:
```ts
PASE_FECHA_INVALIDA: 400,
STUDENT_HAS_PASE: 409,
```

**Satisface**: S-3-D, S-5-A, S-11-E.

---

### 3.6 [VERIFY PR3] Build + tests + typecheck

```bash
pnpm build
pnpm --filter api typecheck
pnpm test
```

Criterio de done: compila; todos los tests de controller pasan; 204/400/404/409/422 verificados; coverage ≥ 80%.

---

## PR4 — Web  (~285 líneas)

> Requiere PR3 merged.  
> Shipeable solo: UI completa y funcional end-to-end (con la API en PR3).  
> Spec satisfecha: S-5-C, S-5-D, S-8, S-9.

### 4.1 [TEST — RED] Tests de `AlumnosCursoCicloPanel`

**Archivo**: `web/src/pages/dashboard/__tests__/alumnos-curso-ciclo-panel.test.tsx`

Agregar los siguientes tests (todos en RED antes de la implementación):

- **S-9-A**: alumno con `fechaDePase` → elemento con nombre del alumno tiene estilo `line-through`.
- **S-9-B**: alumno sin `fechaDePase` → sin `line-through`.
- **S-9-C**: columna "Pase" presente en el panel.
- **S-9-D**: columna "Fecha de pase" presente en el panel.
- **S-9-E**: celda "Fecha de pase" muestra fecha formateada (`dd/mm/aaaa`), no el ISO crudo.
- **S-9-F**: celda "Fecha de pase" vacía (o `—`) para alumno sin pase.
- **S-9-G**: celda "Pase" muestra "Sí" cuando hay pase, vacío cuando no.
- **S-8-A**: botón "Pase" presente para cada alumno sin pase.
- **S-8-B**: click en "Pase" → aparece modal con `<input type="date">`.
- **S-8-C**: confirmar modal con fecha → `apiClient.patch` llamado con `{ fechaDePase: 'YYYY-MM-DD' }`; modal se cierra.
- **S-8-D**: cancelar modal → `apiClient.patch` NO llamado; modal cerrado.
- **S-8-E**: confirmar modal con fecha vacía → modal NO se cierra; `apiClient.patch` NO llamado.
- **S-8-F**: alumno con pase → botón "Revertir pase" visible y habilitado; click → `apiClient.patch` con `{ fechaDePase: null }`.
- **S-5-C**: alumno con pase → botón "Quitar" tiene `disabled`.
- **S-5-D**: alumno sin pase → botón "Quitar" habilitado.

**Satisface**: S-5-C, S-5-D, S-8-A…F, S-9-A…G.

---

### 4.2 Actualizar interface `AlumnoCursoCicloItem` (web)

**Archivo**: `web/src/pages/dashboard/components/AlumnosCursoCicloPanel.tsx`

En la interface local `AlumnoCursoCicloItem` (o type local), agregar:
```ts
fechaDePase: string | null;
```

**Satisface**: S-6-D (propagación al DTO de la UI).

---

### 4.3 Agregar columnas "Pase" y "Fecha de pase"

En la fila de cada alumno, agregar dos `<span>` (o las celdas equivalentes al patrón del panel):

- **"Pase"**: `{alumno.fechaDePase ? 'Sí' : ''}` (badge o texto simple).
- **"Fecha de pase"**: `{alumno.fechaDePase ? new Date(alumno.fechaDePase).toLocaleDateString('es-AR') : '—'}`.

Agregar los headers correspondientes "Pase" y "Fecha de pase" en la sección de encabezados del panel.

> GOTCHA: `toLocaleDateString('es-AR')` con timezone negativa puede correr un día. Para fecha de egreso (solo día, no hora exacta) es aceptable. Documentar en comentario inline si aplica.

**Satisface**: S-9-C, S-9-D, S-9-E, S-9-F, S-9-G.

---

### 4.4 Aplicar estilo `line-through` en filas con pase

En el elemento que renderiza `studentName` (o el contenedor de datos del alumno), aplicar condicional:
```tsx
style={alumno.fechaDePase ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}
```

El estilo SOLO en el contenido de datos (nombre, info). Los botones de acción NO deben tacharse.

**Satisface**: S-9-A, S-9-B.

---

### 4.5 Deshabilitar botón "Quitar" cuando hay pase

En el botón "Quitar" existente:
```tsx
disabled={!!alumno.fechaDePase}
title={alumno.fechaDePase ? 'Revertí el pase antes de quitar' : undefined}
```

**Satisface**: S-5-C, S-5-D.

---

### 4.6 Agregar botón "Pase" / "Revertir pase"

Por fila, junto a los botones existentes:

```tsx
{alumno.fechaDePase ? (
  <Button
    variant="danger-soft"
    data-testid={`btn-revertir-pase-${alumno.id}`}
    onClick={() => handleRevertirPase(alumno.id)}
  >
    Revertir pase
  </Button>
) : (
  <Button
    variant="action"
    data-testid={`btn-pase-${alumno.id}`}
    onClick={() => setPaseTarget(alumno)}
  >
    Pase
  </Button>
)}
```

**Satisface**: S-8-A, S-8-F.

---

### 4.7 Implementar modal de fecha + handlers

Estado local:
```ts
const [paseTarget, setPaseTarget] = useState<AlumnoCursoCicloItem | null>(null);
const [paseFecha, setPaseFecha] = useState<string>('');
```

Modal (reusar `<Modal>` de `web/src/components/ui/modal.tsx`):
```tsx
<Modal isOpen={!!paseTarget} onClose={() => { setPaseTarget(null); setPaseFecha(''); }}>
  <input
    type="date"
    data-testid="input-fecha-pase"
    value={paseFecha}
    onChange={(e) => setPaseFecha(e.target.value)}
    max={new Date().toISOString().split('T')[0]}   // evita futura desde el picker
  />
  <Button disabled={!paseFecha} onClick={handleConfirmarPase}>Confirmar</Button>
  <Button onClick={() => { setPaseTarget(null); setPaseFecha(''); }}>Cancelar</Button>
</Modal>
```

Handlers:
```ts
async function handleConfirmarPase() {
  if (!paseTarget || !paseFecha) return;
  await apiClient.patch(`/course-cycles/${ccId}/alumnos/${paseTarget.id}/pase`, { fechaDePase: paseFecha });
  setPaseTarget(null);
  setPaseFecha('');
  load();   // recarga el listado
}

async function handleRevertirPase(rowId: string) {
  await apiClient.patch(`/course-cycles/${ccId}/alumnos/${rowId}/pase`, { fechaDePase: null });
  load();
}
```

Manejar errores con toast success/error siguiendo el patrón de acciones existentes en el panel.

**Satisface**: S-8-B, S-8-C, S-8-D, S-8-E, S-8-F.

---

### 4.8 [VERIFY PR4] Build + tests web

```bash
pnpm build
pnpm test
```

Criterio de done: compila; todos los tests de `alumnos-curso-ciclo-panel.test.tsx` pasan en GREEN; coverage ≥ 80% en scope web para el componente.

---

## Traceability matrix (tasks → spec)

| Task | Spec |
|------|------|
| 1.1 tests + 1.3 Student entity | S-1-A, S-1-B, S-1-C, S-2-C, S-3-D, S-4-A, S-4-B |
| 1.2 errores de dominio | S-3-D, S-5-A |
| 1.4 puertos domain | S-6-A, S-6-D |
| 1.5 + 1.6 Prisma schema + migración | S-10-A, S-10-B, S-10-C |
| 2.1 tests + 2.4 RegistrarPaseUseCase | S-2-A, S-2-B, S-2-C, S-3-D, S-4-A, S-4-B, S-7-A, S-7-B |
| 2.2 tests + 2.5 RemoveStudentFromCourseCycleUseCase | S-5-A, S-5-B |
| 2.6 PrismaStudentRepository | S-2-A, S-4-A |
| 2.7 findByCourseCycleEnriched | S-6-A, S-6-B, S-6-C, S-6-D |
| 3.1 tests controller | S-3-A…F, S-11-A…E |
| 3.2 DTO + schema Zod | S-3-A, S-3-B, S-3-D, S-6-D |
| 3.3 handler PATCH /pase | S-11-A, S-11-B, S-11-C, S-11-D, S-11-E |
| 3.4 module factories | DI prerequisito S-2, S-5 |
| 3.5 exception filter | S-3-D, S-5-A, S-11-E |
| 4.1 tests web | S-5-C, S-5-D, S-8-A…F, S-9-A…G |
| 4.2 interface AlumnoCursoCicloItem web | S-6-D |
| 4.3 columnas Pase + Fecha | S-9-C, S-9-D, S-9-E, S-9-F, S-9-G |
| 4.4 line-through | S-9-A, S-9-B |
| 4.5 Quitar disabled | S-5-C, S-5-D |
| 4.6 botón Pase / Revertir pase | S-8-A, S-8-F |
| 4.7 modal + handlers | S-8-B, S-8-C, S-8-D, S-8-E |

---

## Gotchas y riesgos a vigilar en apply

1. **Mocks de `StudentRepository`** (riesgo CRÍTICO): 7 archivos de test usan mocks del repositorio. Si alguno no recibe `setFechaDePase`, TypeScript puede no detectarlo por los casts `as unknown as`. Revisar manualmente cada archivo listado en T-2.3.

2. **DI de `RemoveStudentFromCourseCycleUseCase`**: la firma del factory en el module cambia (suma `'StudentRepository'`). Si algún otro módulo instancia este use-case directamente con la firma vieja, rompe. Verificar con `rg "RemoveStudentFromCourseCycleUseCase"` antes de PR3.

3. **Token `'StudentRepository'`**: confirmar que `StudentModule` lo exporta con ese string exacto. Buscar en `api/src/presentation/student/student.module.ts`.

4. **PR2 budget (~385 líneas)**: si los tests de infra (2.8) crecen, el PR puede cruzar 400 líneas. Si pasa, mover T-2.7 (infra enrich) a un PR2b.

5. **Timezone UI**: `toLocaleDateString('es-AR')` desde ISO UTC puede mostrar el día anterior en timezone negativa. Documentar y aceptar para v1 (sólo afecta display, no la persistencia).

6. **`enrollment.studentId`**: verificar que `AlumnosXCursoXCiclo` entity expone `studentId` como getter público (necesario en T-2.5).

7. **Orden de rutas NestJS**: la ruta estática `/alumnos/printable-bulk` debe declararse ANTES de `:id/pase`. Respetar el orden al agregar el nuevo handler en el controller.
