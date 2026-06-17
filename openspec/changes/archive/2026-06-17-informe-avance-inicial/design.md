# Design: informe-avance-inicial

> Fase: sdd-design · Store: hybrid · 2026-06-17 · Nivel afectado: INICIAL · Branch: feat/informe-avance-inicial
> Architecture: Clean / Hexagonal — use-case lee por repo+tenant client, template en infra, tipos de salida aditivos. Sin migración Prisma.

## 1. Contexto y enfoque

El modelo `InformeEvolutivo` (entidad + repo + Prisma + 4 use-cases + controller) YA existe y está cableado en `nivel-inicial.module`. El bug en vivo: `GenerateBoletinUseCase.buildMaterias()` NO tiene arm para Inicial → cae al path legacy `NotaTrimestral` (numérico, vacío para Inicial). Este change conecta el boletín al modelo existente vía **wire-up** (Approach A del proposal): inyectar `InformeRepository`, agregar `buildMateriasInicial`, un arm de dispatch, tipos de salida aditivos y reescribir el `.hbs`. **No se reescribe dominio, no hay migración, no se dropea `NotaTrimestral`.**

El batch (`GenerateBoletinBatchUseCase`) delega en `singleUC.execute(enrollmentId)` → hereda el fix sin arm propio (confirmado en `generate-boletin-batch.use-case.ts:76`).

## 2. Decisión clave RESUELTA: ¿qué período renderiza? → TODOS los trimestres disponibles

**Resolución (ADR-1).** El proposal dejó abierto: ¿uno o los tres informes? Regla del instructivo: *per-term invocation → ese term; annual invocation → todos los disponibles.*

Evidencia en código:
- `GenerateBoletinUseCase.execute(enrollmentId: string)` — **no recibe parámetro de período**. Genera un PDF anual por inscripción (`generate-boletin.use-case.ts:83`).
- `GenerateBoletinBatchUseCase.execute(cycleId)` itera enrollments y llama `singleUC.execute(enrollment.id)` — anual por ciclo.
- Precedente Primario/Secundario: ambos branches renderizan **todos los períodos** del año (columnas desde `SubjectGradingPeriod`). El boletín es, por diseño, un documento anual multi-período.

→ **La invocación es anual ⇒ el boletín de Inicial renderiza TODOS los `InformeEvolutivo` disponibles del alumno en su Sala para ese `academicYear`, ordenados 1T → 2T → 3T.** Esto NO es un STOP: la regla resuelve determinísticamente a partir del código y es consistente con los otros niveles.

`datos.periodo` (campo top-level del boletín) sigue portando `enrollment.academicYear` y se re-etiqueta en el template como **"Ciclo lectivo"** (es correcto: el año ES el período del documento). El **trimestre** se muestra por sección, en el encabezado de cada informe (`Informe — 1° Trimestre`, etc.). Esto resuelve la queja del proposal ("`{{periodo}}` muestra el año, debe mostrar el trimestre") de forma correcta para el caso multi-informe: año arriba, trimestre por sección.

> **RIESGO de producto (NO bloqueante, requiere validación):** en Argentina el informe evolutivo de Inicial suele ENTREGARSE por trimestre (un documento por período), no como resumen anual de los tres. El endpoint actual no ofrece selector de período, así que renderizar los tres en un PDF es la interpretación segura y consistente. Si la institución quiere emisión por trimestre, un change futuro debe agregar un parámetro de período a `execute()` (difiérase — alineado con P4 del proposal: estructura de períodos / `GradingPeriodDate`).

## 3. Decisión clave RESUELTA: enrollment → InformeEvolutivo lookup

El `Enrollment` de Inicial NO tiene `salaId`. El vínculo alumno↔Sala vive en `SalaEnrollment(studentId, salaId, academicYear)` (`schema.prisma:832`, `@@unique([studentId, salaId, academicYear])`). La `Sala` es year-specific (`Sala.academicYear`), así que `salaId` ya scope-ea el año.

**Path de resolución (ADR-2):**
1. `enrollment.studentId` + `enrollment.academicYear` → `client.salaEnrollment.findFirst({ where: { studentId, academicYear, active: true } })` → `salaId`. Si no hay SalaEnrollment → estado vacío (informesInicial = []).
2. `InformeRepository.findAll({ studentId, salaId })` → todos los informes (sin filtrar `periodo`). **Se reutiliza el método existente `findAll(filters)`** (`informe-repository.ts:11`) — NO se agrega método nuevo al port (mantener mínimo).
3. Filtrar por `salaId` ya acota al año; se ordena en memoria 1T→2T→3T.

> Resolución limpia, no bloqueante. No hace falta tocar el `InformeRepository` port ni el Prisma repo.

## 4. Componentes y data flow

```
execute(enrollmentId)
  └─ buildMaterias(client, enrollment)
       ├─ Math.floor(level/10)===2 → Primario   (sin cambios)
       ├─ Math.floor(level/10)===3 → Secundario (sin cambios)
       ├─ Math.floor(level/10)===1 → buildMateriasInicial  ◀── NUEVO arm
       └─ otro (Terciario)         → legacy NotaTrimestral  (sin cambios)

buildMateriasInicial(client, enrollment):
  SalaEnrollment(studentId, academicYear, active) → salaId
       └─ InformeRepository.findAll({ studentId, salaId })
            └─ map InformeEvolutivo → InformeInicialBoletin[]  (areas: AreaDesarrollo → AreaInicialBoletin)

execute: datos.informesInicial = result.informesInicial
       └─ template('INICIAL')(datos) → HTML → PDF
```

### 4.1 Inyección de dependencia (DI)
- `GenerateBoletinUseCase` recibe un 8º parámetro **opcional**: `private readonly informeRepo?: InformeRepository` (mismo patrón que `sgpRepo?`, `cvRepo?`, etc.). Import del tipo desde `@educandow/domain`.
- `reportes.module.ts`: agregar `PrismaInformeRepository` a `providers`, sumarlo al `useFactory`/`inject` de `GenerateBoletinUseCase` como 8º arg. (El repo ya existe en `prisma-informe.repository.ts` y se provee en `nivel-inicial.module` bajo token `'InformeRepository'`; aquí se inyecta la clase concreta directamente, consistente con los otros repos del módulo de reportes.)
- Si `informeRepo` no está inyectado → `buildMateriasInicial` retorna estado vacío (graceful, igual que los otros repos opcionales).

### 4.2 `buildMateriasInicial` (método privado nuevo)
```ts
private async buildMateriasInicial(
  client: TenantPrismaClient,
  enrollment: { studentId: string; academicYear: string },
): Promise<{ materias: MateriaBoletin[]; informesInicial: InformeInicialBoletin[] }> {
  if (!this.informeRepo) return { materias: [], informesInicial: [] };

  const salaEnrollment = await client.salaEnrollment.findFirst({
    where: { studentId: enrollment.studentId, academicYear: enrollment.academicYear, active: true },
  });
  if (!salaEnrollment) return { materias: [], informesInicial: [] };

  const informes = await this.informeRepo.findAll({
    studentId: enrollment.studentId,
    salaId: salaEnrollment.salaId,
  });
  if (informes.length === 0) return { materias: [], informesInicial: [] };

  const order: Record<string, number> = { '1T': 1, '2T': 2, '3T': 3 };
  const sorted = [...informes].sort(
    (a, b) => (order[a.periodo.get()] ?? 99) - (order[b.periodo.get()] ?? 99),
  );

  const informesInicial: InformeInicialBoletin[] = sorted.map((inf) => ({
    periodo: inf.periodo.get(),                       // "1T" | "2T" | "3T"
    fecha: formatFecha(inf.fecha),                    // dd/mm/aaaa (helper local, mismo estilo que buildMesasExamen)
    observacionesGenerales: inf.observacionesGenerales,
    areas: inf.areas.map((a) => ({
      nombre: a.area,            // free string (sin enum aún — P1 diferido)
      observacion: a.observacion,
      valoracion: a.valoracion,  // free string (sin VO aún — P3 diferido)
    })),
  }));

  return { materias: [], informesInicial };
}
```
- `materias: []` para Inicial: el nivel usa `informesInicial`, no la grilla compartida `materias`.
- Estado vacío (sin SalaEnrollment / sin informes) → `informesInicial: []` → el template muestra placeholder "Sin informes cargados" (no crashea).
- Reusa `InformeEvolutivo` (entidad de dominio) tal cual; `inf.periodo.get()`, `inf.areas`, `inf.observacionesGenerales` ya están expuestos.

### 4.3 Wire en `buildMaterias` y `execute`
- En `buildMaterias`, agregar antes del path legacy:
  ```ts
  if (Math.floor(enrollment.level / 10) === 1) {
    return this.buildMateriasInicial(client, enrollment);
  }
  ```
  Esto saca a Inicial del path legacy `NotaTrimestral` (que antes lo atrapaba). Extender el tipo de retorno de `buildMaterias` a `{ materias; previas?; informesInicial? }`.
- En `execute`, asignar `datos.informesInicial = informesInicial` (desestructurado del resultado de `buildMaterias`).

## 5. Tipos de salida (ADR-3: estructura dedicada, no overload de `MateriaBoletin`)

**Decisión:** en vez de agregar `observacion?` a `MateriaBoletin` y mapear cada área a una materia (sketch tentativo del proposal, válido sólo para UN informe), se agrega una estructura **dedicada y aislada** `informesInicial?: InformeInicialBoletin[]` en `DatosBoletin`.

**Por qué (rationale):**
- ADR-1 resolvió renderizar **múltiples** informes (1T/2T/3T). La forma plana `materias + observacion?` no representa limpio N informes × M áreas; obligaría a duplicar áreas o inventar agrupamientos sobre el tipo compartido.
- `MateriaBoletin`/`DatosBoletin.materias` lo consumen Primario/Secundario/Terciario. Tocarlo con campos narrativos de Inicial **aumenta superficie de regresión**. Una estructura propia → **cero impacto** en otros niveles (decisión #4 del prompt: "no regression" — esta opción lo cumple MEJOR).
- Screaming Architecture: el tipo grita "Inicial".

El prompt habilita esto explícitamente ("...o donde encaje"). Es la desviación justificada del sketch del proposal.

**Alternativa rechazada:** `MateriaBoletin.observacion?` + `DatosBoletin.observacionesGenerales?` (single informe). Rechazada porque sólo soporta un trimestre y contamina el tipo compartido.

```ts
// boletin.template.ts — aditivo, sólo Inicial

/** Un área de desarrollo dentro de un informe evolutivo de Inicial. */
export interface AreaInicialBoletin {
  /** Etiqueta de área, e.g. "SOCIO_AFECTIVA" (free string — sin enum aún). */
  nombre: string;
  /** Narrativa cualitativa — el campo clave de Inicial. */
  observacion: string;
  /** "DESTACADO" | "LOGRADO" | "EN_PROCESO" | "NO_LOGRADO" (free string). */
  valoracion: string;
}

/** Un informe evolutivo (un trimestre) para el boletín de Inicial. */
export interface InformeInicialBoletin {
  periodo: string;                  // "1T" | "2T" | "3T"
  fecha: string;                    // dd/mm/aaaa
  observacionesGenerales?: string;  // opcional
  areas: AreaInicialBoletin[];
}
```
En `DatosBoletin`, agregar:
```ts
/**
 * Informes evolutivos del alumno (todos los trimestres disponibles), ordenados 1T→2T→3T.
 * Sólo lo puebla el branch Inicial (buildMateriasInicial).
 * Undefined para Primario/Secundario/Terciario — {{#if informesInicial}} hace no-op.
 */
informesInicial?: InformeInicialBoletin[];
```
**Aditivo + opcional.** No se modifica `MateriaBoletin`. No hay regresión en otros niveles (sus templates no referencian `informesInicial`).

## 6. Reescritura de `boletin-inicial.hbs` (ADR-4)

Cambios respecto del template actual:
- **QUITAR** la columna "Docente" de la tabla de áreas (`Sala.teacherId` se removió en S3b-1; `materias[].docente` ya no se puebla para Inicial). El `<th>Docente</th>` y la fila "Firma del docente" del footer salen.
- **Iterar `{{#each informesInicial}}`**: una sección por trimestre.
  - Encabezado de sección: `Informe — {{periodoLabel periodo}}° Trimestre` + `Fecha: {{fecha}}`. (Mapeo 1T→"1°", o render directo "1T" — detalle de template.)
  - Bloque `{{#if observacionesGenerales}}` → párrafo "Observaciones generales".
  - Tabla de áreas con 3 columnas: **Área | Observación (narrativa) | Valoración** (sin Docente).
- **`{{periodo}}` (top-level)** se re-etiqueta a **"Ciclo lectivo"** en el bloque student-info (porta `academicYear`).
- **Estado vacío:** `{{#unless informesInicial}}` o `{{#if (eq informesInicial.length 0)}}` → "Sin informes evolutivos cargados para este ciclo."
- Asistencia: el bloque `{{#if asistencia}}` queda igual (sigue aplicando).

Esquema (pseudo-hbs):
```hbs
<div class="student-info">
  ... Alumno / DNI / Sala / Ciclo lectivo: {{periodo}}
</div>

{{#each informesInicial}}
  <div class="section-title">Informe — {{periodo}} · {{fecha}}</div>
  {{#if observacionesGenerales}}
    <p class="obs-generales">{{observacionesGenerales}}</p>
  {{/if}}
  <table class="grades">
    <thead><tr><th>Área</th><th>Observación</th><th>Valoración</th></tr></thead>
    <tbody>
      {{#each areas}}
        <tr><td>{{nombre}}</td><td>{{observacion}}</td><td>{{valoracion}}</td></tr>
      {{/each}}
    </tbody>
  </table>
{{else}}
  <p>Sin informes evolutivos cargados para este ciclo.</p>
{{/each}}

{{#if asistencia}} ... (sin cambios) {{/if}}
```

## 7. Estrategia de tests (TDD estricto — test primero)

| # | Test | Archivo | Asserta |
|---|------|---------|---------|
| 1 | `buildMateriasInicial`: mapea informes → `informesInicial[]` ordenado 1T→2T→3T, áreas mapeadas (nombre/observacion/valoracion), observacionesGenerales presente | `__tests__/generate-boletin.inicial.test.ts` (nuevo) | estructura + orden + lee `InformeRepository`, NO `NotaTrimestral` |
| 2 | `buildMateriasInicial`: sin SalaEnrollment → `informesInicial: []`; sin informes → `[]`; sin repo inyectado → `[]` | idem | estado vacío graceful |
| 3 | dispatch: `level` 10..19 entra a `buildMateriasInicial` y NO al path legacy `NotaTrimestral` | idem | `notaTrimestral.findMany` NO se llama para Inicial |
| 4 | No-regresión: Primario(20)/Secundario(30)/Terciario(40) NO pueblan `informesInicial` y su salida no cambia | `generate-boletin.use-case.test.ts` (extender) | `informesInicial` undefined; materias intactas |
| 5–8 | **4 use-cases de `InformeEvolutivo`** (Create/Get/List/Update) — no existen, TDD | `application/nivel-inicial/use-cases/__tests__/informe-evolutivo.use-cases.test.ts` (nuevo) | Create persiste vía repo; Get/Update NotFound; List aplica filtros; Update merge parcial |

Mocks: seguir el patrón existente (`makePdfGenerator`, `makePdfStorage`, `makePrisma`, mock `client.salaEnrollment.findFirst`, mock `InformeRepository.findAll`). `pnpm --filter api test`, coverage ≥ 80%.

## 8. Tamaño, archivos, entrega

Archivos tocados (~6–7):
- `api/src/application/reportes/generate-boletin.use-case.ts` — DI opcional + `buildMateriasInicial` + arm dispatch + retorno extendido (~60 líneas).
- `api/src/application/reportes/templates/boletin.template.ts` — 2 interfaces nuevas + 1 campo en `DatosBoletin` (~25 líneas, aditivo).
- `api/src/infrastructure/reporting/html-templates/boletin-inicial.hbs` — reescritura (~50 líneas netas).
- `api/src/presentation/reportes/reportes.module.ts` — provider + factory inject (~6 líneas).
- Tests nuevos/extendidos (~3 archivos, ~200 líneas).

**Estimado: ~250–350 líneas, single PR, sin migración Prisma, sin entidades nuevas.** Riesgo de budget 400-líneas: bajo. Single PR confirmado.

## 9. ADRs (resumen)

- **ADR-1** Renderizar TODOS los informes (1T→2T→3T). *Rechazado:* single informe (latest) — la invocación es anual y Primario/Secundario ya renderizan todos los períodos.
- **ADR-2** Lookup `enrollment → SalaEnrollment(studentId, academicYear) → salaId → InformeRepository.findAll({studentId, salaId})`. Reutiliza `findAll` existente; sin método nuevo en el port.
- **ADR-3** Tipo dedicado `informesInicial?: InformeInicialBoletin[]` en `DatosBoletin`. *Rechazado:* `observacion?` sobre el `MateriaBoletin` compartido — multi-informe no encaja y aumenta regresión.
- **ADR-4** `boletin-inicial.hbs`: secciones por trimestre, sin columna Docente, `{{periodo}}`→"Ciclo lectivo", trimestre por sección, estado vacío.

## 10. Riesgos / supuestos a validar

- **PRODUCTO (medio, validar):** ¿el informe de Inicial se entrega por trimestre o como resumen anual de los tres? El endpoint no tiene selector de período → este design renderiza los tres. Si se quiere por-trimestre, requiere parámetro de período en `execute()` (futuro, P4).
- **Datos (bajo):** `InformeRepository.findAll` NO filtra `active` (incluiría informes soft-deleted). Comportamiento pre-existente compartido con `ListInformesUseCase`. No se toca el repo en este change; flag como deferred.
- **Datos (bajo):** un alumno con >1 SalaEnrollment activo en el mismo año (raro; `@@unique` lo permite entre salas distintas) → `findFirst` toma uno. Aceptable para MVP.
- **Bajo:** `area`/`valoracion` son free strings (sin enum/VO) — P1/P3 diferidos.
</content>
</invoke>
