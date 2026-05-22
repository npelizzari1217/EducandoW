# Módulo 05 — Asistencia

> **Orquestador del módulo**: Códigos de asistencia configurables, registro diario, totales.
> **Depende de**: Ciclo Lectivo (03).
> **Usado por**: Niveles (10-13), Informes.

## Contexto

- **Tablas propias**: `attendance_codes`, `attendances` (modificada)
- **Reglas que aplican**: R40-R51
- **Base de datos**: Tenant DB

## Modelo de datos reducido

```
attendance_codes (CATÁLOGO configurable por nivel):
  id, level, code, description, base_status,
  printable_code, absence_value, is_system, active, order
  UNIQUE(level, code)

  PRECARGA SISTEMA (is_system=true, no modificable):
    P=Presente(0), SAB=Sábado(0), DOM=Domingo(0), X=NoExiste(0)
  EDITABLES POR USUARIO:
    A=Ausente(1), T=Tarde(0.5), SA=SalidaAnt(0.25), J=Justificado(0)

attendances:
  id, student_id FK, course_section_id FK,
  subject_id FK? (NULL=curso, valor=materia),
  cycle_id FK, date, status_code FK → attendance_codes
  UNIQUE(student_id, course_section_id, subject_id, date)
```

## Reglas del módulo

| # | Regla |
|---|---|
| R40 | attendances tiene cycle_id FK |
| R41 | EARLY_DEPARTURE incluido en estados base |
| R43 | Registro DIARIO: alumno + fecha + curso/materia |
| R44 | subject_id NULL = primario (por curso), valor = por materia |
| R45 | Totales mensuales: GROUP BY mes. Ciclo: GROUP BY cycle_id |
| R46 | "Quedó libre" = ausentes > límite |
| R47 | attendance_codes configurable por usuario |
| R48 | P, SAB, DOM, X son is_system=true, no se borran |
| R49 | absence_value fraccionario (0, 0.5, 1) |
| R50 | printable_code = lo impreso ("-", "A", "½") |
| R51 | X = días inexistentes (30 feb, 29 feb no bisiesto) |

## Pipeline SDD completo

| Fase | Sub-agente | Estado |
|---|---|---|
| 1. EXPLORE | `sdd-explore` | 🔲 |
| 2. PROPOSE | `sdd-propose` | 🔲 |
| 3. SPEC | `sdd-spec` | 🔲 |
| 4. DESIGN | `sdd-design` | 🔲 |
| 5. TASKS | `sdd-tasks` | 🔲 |
| 6. APPLY-PLAN | `sdd-apply-plan` | 🔲 |
| 7. APPLY | `sdd-apply` (múltiples) | 🔲 |
| 8. VERIFY | `sdd-verify` | 🔲 |
| 9. ARCHIVE | `sdd-archive` | 🔲 |

## Tareas atómicas (salida de TASKS)

| # | Tarea | Tipo |
|---|---|---|
| 1 | Crear entidad: AttendanceCode | domain |
| 2 | Actualizar Attendance (subject_id FK?, cycle_id FK, status_code FK) | domain+infra |
| 3 | Repositorios + Prisma | infra |
| 4 | Use cases: CRUD códigos, tomar asistencia, totales mensuales/ciclo | application |
| 5 | Controller + DTOs + módulo | presentation |
| 6 | Precarga de códigos del sistema (seed: P, SAB, DOM, X) | infra |
| 7 | Tests unitarios + e2e | test |

## Contratos de API

```
GET    /v1/attendance-codes?level=SECUNDARIO  → códigos disponibles
POST   /v1/attendance-codes                   → crear código personalizado
POST   /v1/attendance                         → tomar asistencia del día
GET    /v1/attendance?studentId=X&cycleId=Y   → historial
GET    /v1/attendance/report?studentId=X      → totales mensuales + ciclo
```
