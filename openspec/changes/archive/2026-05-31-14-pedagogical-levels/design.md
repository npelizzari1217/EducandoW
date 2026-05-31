# Design: 14-pedagogical-levels

## Technical Approach

Implementar 4 bounded contexts pedagógicos como módulos NestJS independientes sobre Clean Architecture (domain → application → infrastructure → presentation). Cada nivel tiene su propia carpeta en cada capa sin compartir lógica entre sí. Los 18 nuevos modelos Prisma extienden `schema_tenant.prisma` con FKs a las tablas genéricas existentes (Student, Teacher, Subject, CourseSection). La estrategia es replicar el patrón establecido para cada nivel: entidades + VOs en domain, use cases `@Injectable` con `Result<T,E>`, repositories Prisma con `TenantContext`, controllers con Zod + RBAC, y páginas React (list + create + detail).

## Architecture Decisions

| Decisión | Opciones | Tradeoffs | Elección |
|---|---|---|---|
| **Módulo NestJS por nivel** | (A) 1 módulo por nivel vs (B) 1 módulo monolítico con sub-rutas | (A) Aísla DI, builds, y despliegue; (B) simplifica wiring pero acopla niveles | **A** — cada nivel es `Nivel{Inicial,Primario,Secundario,Terciario}Module` registrado en `app.module.ts` |
| **Token injection con `useExisting`** | (A) Token string 'SalaRepository' + useExisting vs (B) `@Inject()` directo de clase concreta | (A) Respeta DIP — el controller ve la interfaz; (B) rompe DIP pero menos boilerplate | **A** — `{ provide: 'SalaRepository', useExisting: PrismaSalaRepository }` |
| **Use cases `useFactory` vs `useClass`** | (A) `useFactory` con inyección explícita vs (B) `useClass` con `@Injectable()` | (A) Explícito, compatible con token injection; (B) más conciso | **A** — `{ provide: CreateSalaUseCase, useFactory: (r) => new CreateSalaUseCase(r), inject: ['SalaRepository'] }` |
| **Zod vs class-validator** | (A) Zod (proyecto) vs (B) class-validator + decorators | (A) Tipos inferidos, sin decorators, runtime-only; (B) tradicional NestJS | **A** — ya establecido en el proyecto con `ZodValidationPipe` |
| **Soft delete vs hard delete** | (A) `active=false` + `deletedAt` vs (B) `DELETE` real | (A) Auditoría y recuperación; (B) más simple pero irreversible | **A** — todas las entidades pedagógicas usan soft delete |
| **Tablas separadas por nivel vs tabla única con discriminador** | (A) `calificaciones_primario` + `calificaciones_secundario` separadas vs (B) una tabla `calificaciones` con columna `nivel` | (A) Schemas distintos por nivel, queries simples, sin polimorfismo; (B) menos tablas pero queries condicionales complejos | **A** — cada nivel tiene sus propias tablas, respetando bounded context |

## Data Flow

```
HTTP Request (Zod-validated DTO)
    │
    ▼
Controller (@Roles guard → AuthGuard, RolesGuard)
    │  throw result.unwrapErr() → NestJS exception filter
    ▼
Use Case (@Injectable, Result<T,E>)
    │  await repo.save(entity)
    ▼
Repository Interface (domain contract)
    │
    ▼
Prisma Repository (TenantContext.getClient())
    │  entity → Prisma row mapping (toDomain / upsert)
    ▼
PostgreSQL (tenant DB, schema_tenant)
```

- DTOs se validan en el controller con `ZodValidationPipe` antes de llegar al use case.
- Los use cases reciben datos primitivos (no DTOs), crean la entidad con `Entity.create()`, y persisten vía repo.
- El controller mapea la entidad de dominio a JSON plano con `mapSala()` / similar — exponiendo VO internals vía `.get()`.

## Cross-Level Isolation

Cada nivel es un bounded context independiente. No hay imports cruzados entre `packages/domain/src/inicial/` y `packages/domain/src/primario/`. La discriminación de nivel usa el `EducationalLevel` VO compartido en `shared/value-objects/` (enum 1-4), nunca strings crudos. Las FK entre tablas de distintos niveles NO existen — solo FK a tablas genéricas (Student, Teacher, Subject, CourseSection).

## File Changes

### Domain (`packages/domain/src/`)
| Archivo | Acción |
|---|---|
| `inicial/entities/sala.ts, informe-evolutivo.ts, planificacion.ts` | Create |
| `inicial/value-objects/age-group.ts, turno.ts, periodo.ts` | Create |
| `inicial/repositories/sala-repository.ts, informe-repository.ts, planificacion-repository.ts` | Create |
| `inicial/index.ts` | Create |
| `primario/entities/grado.ts, calificacion-primario.ts` | Create |
| `primario/value-objects/grado-numero.ts, division.ts, trimestre.ts` | Create |
| `primario/repositories/grado-repository.ts, calificacion-repository.ts` | Create |
| `primario/index.ts` | Create |
| `secundario/entities/curso.ts, mesa-examen.ts, regimen-academico.ts` | Create |
| `secundario/value-objects/orientacion.ts, condicion-alumno.ts, turno-examen.ts` | Create |
| `secundario/repositories/curso-repository.ts, mesa-examen-repository.ts, regimen-academico-repository.ts` | Create |
| `secundario/index.ts` | Create |
| `terciario/entities/carrera.ts, inscripcion-materia.ts, acta-examen.ts, titulo.ts` | Create |
| `terciario/value-objects/regimen-materia.ts, estado-inscripcion.ts, estado-titulo.ts, condicion-examen.ts` | Create |
| `terciario/repositories/carrera-repository.ts, inscripcion-repository.ts, acta-examen-repository.ts, titulo-repository.ts` | Create |
| `terciario/index.ts` | Create |

### Application (`api/src/application/`)
| Archivo | Acción |
|---|---|
| `nivel-inicial/use-cases/sala.use-cases.ts` (CreateSala, ListSalas, GetSala, UpdateSala, DeleteSala) | Create |
| `nivel-inicial/use-cases/informe-evolutivo.use-cases.ts` (CreateInforme, GetInforme, ListInformes, UpdateInforme) | Create |
| `nivel-inicial/use-cases/planificacion.use-cases.ts` (CreatePlanificacion, ListPlanificaciones, UpdatePlanificacion) | Create |
| `nivel-primario/use-cases/grado.use-cases.ts, calificacion.use-cases.ts` | Create |
| `nivel-secundario/use-cases/curso.use-cases.ts, mesa-examen.use-cases.ts, regimen-academico.use-cases.ts` | Create |
| `nivel-terciario/use-cases/carrera.use-cases.ts, inscripcion-materia.use-cases.ts, acta-examen.use-cases.ts, titulo.use-cases.ts` | Create |

### Infrastructure (`api/src/infrastructure/persistence/prisma/repositories/`)
| Archivo | Acción |
|---|---|
| `prisma-sala.repository.ts, prisma-informe.repository.ts, prisma-planificacion.repository.ts` | Create |
| `prisma-grado.repository.ts, prisma-calificacion-primaria.repository.ts` | Create |
| `prisma-curso.repository.ts, prisma-mesa-examen.repository.ts, prisma-regimen-academico.repository.ts` | Create |
| `prisma-carrera.repository.ts, prisma-inscripcion-materia.repository.ts, prisma-acta-examen.repository.ts, prisma-titulo.repository.ts` | Create |

### Presentation (`api/src/presentation/`)
| Archivo | Acción |
|---|---|
| `nivel-inicial/{sala,informe-evolutivo,planificacion}.controller.ts` + `nivel-inicial.module.ts` + `dto/*.dto.ts` (10 files) | Create |
| `nivel-primario/{grado,calificacion}.controller.ts` + `nivel-primario.module.ts` + `dto/*.dto.ts` (6 files) | Create |
| `nivel-secundario/{curso,mesa-examen,regimen-academico}.controller.ts` + `nivel-secundario.module.ts` + `dto/*.dto.ts` (9 files) | Create |
| `nivel-terciario/{carrera,inscripcion-materia,acta-examen,titulo}.controller.ts` + `nivel-terciario.module.ts` (5 files) | Create |

### Database
| Archivo | Acción |
|---|---|
| `api/prisma/schema_tenant.prisma` | Modify — agregar 18 modelos (6 Inicial + 2 Primario + 5 Secundario + 5 Terciario) |

### App Wiring
| Archivo | Acción |
|---|---|
| `api/src/app.module.ts` | Modify — importar 4 módulos nivel-* |

### Frontend (`web/src/niveles/`)
| Archivo | Acción |
|---|---|
| `inicial/salas/{page, sala-form}.tsx`, `inicial/informes/{page, informe-form}.tsx`, `inicial/planificaciones/{page, planificacion-form}.tsx` | Create |
| `primario/grados/{page, grado-form}.tsx`, `primario/calificaciones/{page, calificacion-form}.tsx` | Create |
| `secundario/cursos/{page, curso-form}.tsx`, `secundario/mesas-examen/{page, mesa-examen-form, inscripcion-dialog}.tsx` | Create |
| `terciario/carreras/{page, carrera-form}.tsx`, `terciario/inscripciones/{page, inscripcion-form}.tsx` | Create |

## Testing Strategy

| Capa | Qué probar | Enfoque | Cobertura objetivo |
|---|---|---|---|
| **Domain VOs** | Validación de `AgeGroup`, `GradoNumero`, `Turno`, `Orientacion`, `RegimenMateria`, `EstadoTitulo` — valores válidos e inválidos | Unit (Vitest) — testear `create()` con Result | 100% |
| **Domain Entities** | `Sala.create()` rechaza capacity=0, `CalificacionPrimario` valida nota 1-10, `InscripcionMateria` valida correlativas | Unit (Vitest) — testear factory + reglas de negocio | 100% |
| **Use Cases** | CRUD completo: crear con datos válidos → OK, crear con datos inválidos → Err, leer entidad inexistente → NotFoundError | Unit con mocks de repository (Vitest) | 80%+ |
| **Controllers** | Zod validation rechaza DTOs inválidos (HTTP 400), RBAC por rol, respuestas 201/200/204 | Integration (`@nestjs/testing`) | Por spec scenario |
| **Repositories** | `findById` retorna null para ID inexistente, `save` persiste y recupera correctamente, `softDelete` actualiza flags | Integration (Prisma + test DB) | Cada operación CRUD |

Escenarios de spec cubiertos:
- Inicial: crear sala válida, ageGroup inválido (400), teacher crea informe, crear planificación
- Primario: crear grado, grado duplicado (409), nota fuera de rango (400)
- Secundario: crear curso con orientación, mesa de examen, inscribir alumno, régimen académico
- Terciario: crear carrera, inscripción con correlativas OK y rechazada, acta con notas, título

## Migration / Rollout

- Migration de Prisma (`pnpm prisma:migrate`) agrega 18 tablas nuevas sin alterar las 19 existentes — zero-downtime.
- Rollback por nivel: revertir migration de ese nivel + eliminar su módulo NestJS + eliminar páginas frontend. Sin impacto en otros niveles.

## Open Questions

Ninguna — la implementación está completa. Este diseño documenta retroactivamente las decisiones ya aplicadas en el código.
