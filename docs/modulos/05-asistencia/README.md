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

## Tareas atómicas

| # | Tarea | Agente |
|---|---|---|
| 1 | Crear entidades: AttendanceCode | sdd-apply |
| 2 | Actualizar Attendance (subject_id, cycle_id, status_code FK) | sdd-apply |
| 3 | Repositorios + Prisma | sdd-apply |
| 4 | Use cases: CRUD códigos, tomar asistencia, totales | sdd-apply |
| 5 | Controller + DTOs + módulo | sdd-apply |
| 6 | Precarga de códigos del sistema (seed) | sdd-apply |
| 7 | Tests | sdd-apply |

## Contratos de API

```
GET    /v1/attendance-codes?level=SECUNDARIO  → códigos disponibles
POST   /v1/attendance-codes                   → crear código personalizado
POST   /v1/attendance                         → tomar asistencia del día
GET    /v1/attendance?studentId=X&cycleId=Y   → historial
GET    /v1/attendance/report?studentId=X      → totales mensuales + ciclo
```
