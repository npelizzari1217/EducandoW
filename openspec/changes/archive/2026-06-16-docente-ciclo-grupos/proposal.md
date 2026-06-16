# Proposal: Docente / Materia / Grupo por Ciclo

> **Cambio GRANDE — entrega MULTI-PR (7 fases secuenciales).** Cada fase es un PR independiente con su migración.

## Intent

El modelo actual NO guarda historial por ciclo: `SubjectAssignment` es atemporal (sin `cycleId`), no permite **materias partidas** (varios docentes sobre subconjuntos de alumnos), y los datos de persona viven en `Teacher` (tenant) en vez del `User` estable. Además hay un **BUG de autorización**: `upsert-subject-period-grades` y `upsert-subject-final-grades` NO validan que el docente esté asignado (solo el GET valida) — cualquier docente puede escribir notas de cualquier materia.

## Scope

### In Scope
- Subir datos de persona (DNI, título, teléfono, nombre/apellido) de `Teacher` a `User` (master).
- Entidades nuevas (tenant): `DocenteXCiclo` (cubre docentes Y preceptores — los diferencia el módulo del User), `MateriaXCursoXCiclo`, `AlumnosXMateriaXCursoXCiclo`, `GrupoXCursoXMateriaXCiclo` (Modelo 1: grupo = 1 docente + sus alumnos), `AlumnosXGrupoXCursoXMateriaXCiclo`.
- Asignación en dos ejes: nivel grupo (docente de materia) y nivel curso (preceptor/titular + turno).
- Notas por alumno-materia compartidas (alcance=grupo); asistencia diaria (curso/preceptor) + por materia (grupo/docente).
- **Fix del bug**: validar asignación del docente al escribir notas/asistencia.
- Migraciones de datos en prod: `Teacher`→`User`+`DocenteXCiclo`; `SubjectAssignment`→grupos materializados.

### Out of Scope
- Cambios al modelo de acceso de 3 puertas (ya implementado, ver `educandow/rbac-access-model`).
- Boletines/PDF y otros reportes existentes (se adaptan, no se rediseñan).
- Optativas/inscripción de alumnos como flujo de UI propio (la base soporta subconjuntos; el flujo se difiere).
- Asignación masiva ("de a bloque") de alumnos al `CursoXCiclo` — se hará por separado más adelante (por ahora, carga manual de a uno).

## Capabilities

### New Capabilities
- `docente-ciclo`: participación de personal por ciclo (docentes y preceptores).
- `materia-grupo-ciclo`: materialización de materias del plan, grupos y membresía de alumnos por ciclo.
- `asignacion-curso-ciclo`: preceptor/titular con turno a nivel curso.

### Modified Capabilities
- `smart-course-creation`: al GENERAR el `CursoXCiclo` (elegir ciclo + plan de estudio + botón "Generar") se crean las `MateriaXCursoXCiclo` del plan. Los alumnos del curso se cargan A MANO (no se autogeneran). Crear el ciclo lectivo NO genera materias.
- (notas/asistencia): alcance=grupo + validación de asignación en escritura (incluye el fix del bug).

## Approach

- **Modelo 1**: el grupo es la unidad docente+alumnos; materia normal = 1 grupo (todos), partida = varios. Restricción dura: grupo ⊆ materia ⊆ curso; nunca alumnos de otro curso; solape permitido (co-docencia).
- **Multi-tenant**: persona en `User` (prisma_master); todo lo pedagógico en tenant (prisma_tenant).
- **Generación del `CursoXCiclo`**: el usuario elige ciclo + plan de estudio y presiona "Generar" → se crean las `MateriaXCursoXCiclo` del plan. Los alumnos del curso-ciclo se cargan manualmente, tomándolos de los alumnos YA INSCRIPTOS de la institución (no del flujo de inscripción/ingresantes). Migración de datos existentes por fase.
- **Acceso 3 puertas**: asignación (grupo/curso)=alcance, módulos del User=permisos.

### Plan por fases (orden aprobado)
1. Persona en `User` + migración. 2. `DocenteXCiclo` + migrar `Teacher`. 3. Materia + AlumnosXMateria + Grupos + AlumnosXGrupo (materializar plan, migrar `SubjectAssignment`). 4. Asignación nivel curso (preceptor/titular+turno). 5. Notas por grupo + validación (cae el fix). 6. Asistencia (diaria + por materia). 7. UI.

**Nivel pedagógico**: principal SECUNDARIO/TERCIARIO (materias partidas, preceptores); estructura aplica a ALL donde corresponda.

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Migrar `Teacher`/`SubjectAssignment` sobre datos en prod | Alta | Migración por fase, backup previo, scripts idempotentes, validación post-migración |
| Datos de persona duplicados (Teacher vs User) | Media | Fase 1 unifica en `User`; `Teacher` queda obsoleto y se retira tras fase 2 |
| Performance de materialización al crear ciclo | Media | Batch insert, índices por `cycleId`, medición en dataset real |
| Solape de grupos (co-docencia) genera notas/asistencia ambiguas | Media | 1 registro por alumno-materia compartido; alcance=grupo en lectura |

## Rollback Plan

Cada fase = 1 PR con migración reversible. Rollback = revertir el PR + `down` de la migración. Las entidades nuevas conviven con las viejas hasta el retiro explícito (`Teacher` se elimina recién tras validar fase 2), así un rollback de fase tardía no rompe las previas.

## Dependencies

- Modelo de acceso de 3 puertas (implementado, #962).
- Plan de estudios y `CourseCycle` existentes (fuente de materialización).

## Success Criteria

- [ ] Datos de persona viven en `User`; `Teacher` migrado.
- [ ] Materias partidas: >1 grupo por materia con docentes y subconjuntos de alumnos distintos.
- [ ] Historial por ciclo: asignaciones y grupos quedan ligados a `cycleId`.
- [ ] Escritura de notas/asistencia RECHAZA a docente no asignado (bug cerrado).
- [ ] Asistencia diaria (preceptor) y por materia (docente) operativas por separado.
</content>
</invoke>
