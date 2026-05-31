# Tasks: 14-pedagogical-levels

## Fase 0 — Schema de base de datos (compartida)

**T0.1** — Agregar 18 tablas faltantes a `api/prisma/schema_tenant.prisma`:
- Inicial: `Sala`, `SalaEnrollment`, `InformeEvolutivo`, `AreaDesarrollo`, `Planificacion`, `SecuenciaDidactica`
- Primario: `Grado`, `CalificacionPrimario`
- Secundario: `Curso`, `CalificacionSecundario`, `MesaExamen`, `MesaExamenInscripcion`, `RegimenAcademico`
- Terciario: `Carrera`, `MateriaCarrera`, `Correlatividad`, `InscripcionMateria`, `ActaExamen`, `ActaExamenNota`, `Titulo`

**T0.2** — Generar Prisma Client tenant: `pnpm prisma:generate`

**T0.3** — Crear migration: `pnpm prisma:migrate`

## Fase 1 — Nivel Inicial

**T1.1** — Domain: `packages/domain/src/inicial/`
- Entities: `Sala`, `InformeEvolutivo`, `AreaDesarrollo`, `Planificacion`
- VOs: `AgeGroup` (3|4|5), `Turno` (MAÑANA|TARDE), `AreaDesarrolloTipo`
- Repository interfaces: `ISalaRepository`, `IInformeEvolutivoRepository`, `IPlanificacionRepository`

**T1.2** — Application: `api/src/application/nivel-inicial/use-cases/`
- Sala: CreateSala, ListSalas, GetSala, UpdateSala, DeleteSala
- InformeEvolutivo: CreateInforme, GetInforme, UpdateInforme
- Planificacion: CreatePlanificacion, ListPlanificaciones, UpdatePlanificacion

**T1.3** — Infrastructure: Prisma repositories para Inicial

**T1.4** — Presentation: `api/src/presentation/nivel-inicial/`
- `sala.controller.ts` — CRUD completo
- `informe-evolutivo.controller.ts` — CRUD
- `planificacion.controller.ts` — CRUD
- DTOs con validación Zod

**T1.5** — Frontend: `web/src/niveles/inicial/`
- Página de Salas (list + create + detail)
- Página de Informes Evolutivos
- Página de Planificaciones

## Fase 2 — Nivel Primario

**T2.1** — Domain: `packages/domain/src/primario/`
- Entities: `Grado`, `CalificacionPrimario`
- VOs: `GradoNumero` (1-6), `Division` (A|B|C), `Trimestre`
- Repository interfaces

**T2.2** — Application: `api/src/application/nivel-primario/use-cases/`
- Grado: CRUD
- CalificacionPrimario: CreateCalificacion, ListCalificaciones, UpdateCalificacion (trimestral 1-10)

**T2.3** — Infrastructure: Prisma repositories

**T2.4** — Presentation: `api/src/presentation/nivel-primario/`
- `grado.controller.ts`
- `calificacion.controller.ts`

**T2.5** — Frontend: `web/src/niveles/primario/`
- Página de Grados
- Página de Calificaciones

## Fase 3 — Nivel Secundario

**T3.1** — Domain: `packages/domain/src/secundario/`
- Entities: `Curso`, `MesaExamen`, `RegimenAcademico`
- VOs: `Orientacion`, `CondicionAlumno`
- Repository interfaces

**T3.2** — Application: `api/src/application/nivel-secundario/use-cases/`
- Curso: CRUD
- MesaExamen: CreateMesa, ListMesas, InscribirAlumno
- RegimenAcademico: CRUD

**T3.3** — Infrastructure: Prisma repositories

**T3.4** — Presentation: `api/src/presentation/nivel-secundario/`
- `curso.controller.ts`
- `mesa-examen.controller.ts`
- `regimen-academico.controller.ts`

**T3.5** — Frontend: `web/src/niveles/secundario/`
- Página de Cursos
- Página de Mesas de Examen

## Fase 4 — Nivel Terciario

**T4.1** — Domain: `packages/domain/src/terciario/`
- Entities: `Carrera`, `InscripcionMateria`, `ActaExamen`, `Titulo`
- VOs: `RegimenMateria` (PROMOCIONAL|REGULAR|LIBRE), `EstadoTitulo`
- Repository interfaces

**T4.2** — Application: `api/src/application/nivel-terciario/use-cases/`
- Carrera: CRUD
- InscripcionMateria: CreateInscripcion, ValidarCorrelativas, ListInscripciones
- ActaExamen: CreateActa, RegistrarNota
- Titulo: CreateTitulo, UpdateEstado

**T4.3** — Infrastructure: Prisma repositories

**T4.4** — Presentation: `api/src/presentation/nivel-terciario/`
- `carrera.controller.ts`
- `inscripcion-materia.controller.ts`
- `acta-examen.controller.ts`
- `titulo.controller.ts`

**T4.5** — Frontend: `web/src/niveles/terciario/`
- Página de Carreras
- Página de Inscripciones a Materias

## Fase 5 — Integración

**T5.1** — Registrar los 4 módulos en `api/src/app.module.ts`
**T5.2** — Agregar items al sidebar para cada nivel (filtrados por `requiresLevel`)
**T5.3** — Verificar que build y tests pasen: `pnpm build && pnpm test`
**T5.4** — Verificar typecheck: `pnpm lint`
