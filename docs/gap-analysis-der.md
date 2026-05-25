# Gap Analysis: DER (61 tablas) vs Implementación Actual

> **Fecha**: 2026-05-25
> **Contexto**: Comparación entre el DER deseado (61 tablas, 11 módulos) y el estado actual del
> código (14 modelos Prisma: 4 en master DB + 10 en tenant DB).
> **Arquitectura actual**: Multi-tenant con database-per-tenant. Master DB (`educandow_master`)
> contiene `users`, `institutions`, `refresh_tokens`. Tenant DB contiene datos pedagógicos.

---

## Tabla Comparativa — Una fila por cada tabla del DER

### MÓDULO 1: Core (8 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 1 | `usuarios` | ✅ Parcial | `User` (master) | id, email, name (combinado), passwordHash, role (string), failedAttempts, lockedUntil, active | nombre/apellido separados, telefono, direccion, estado (el DER lo pide como campo, no booleano), relacion M:N a roles | ⚠️ AGREGAR CAMPOS |
| 2 | `roles` | ❌ No existe | — | — | id_rol, nombre_rol, descripcion. El rol actual es un string inline (`"ADMIN"`, `"TEACHER"`) en `User` y `RefreshToken`. No hay tabla de roles. | 🆕 CREAR TABLA |
| 3 | `usuarios_roles` | ❌ No existe | — | — | Tabla M:N completa. Actualmente la relación usuario-rol es 1:1 (un string). El DER la pide M:N. | 🆕 CREAR TABLA |
| 4 | `tokens_seguridad` | 🟡 Parcial | `RefreshToken` (master) | id, token, userId, tipo_token → role (parcial), fecha_expiracion → expiresAt | `tipo_token` (el DER lo quiere genérico: refresh, password-reset, email-verify, etc.). La tabla actual solo cubre refresh tokens. Campos extra en actual no pedidos: `role`, `institutionId`, `active`, `deletedAt`. | 🔄 REFACTOR |
| 5 | `dispositivos_usuarios` | ❌ No existe | — | — | Tabla completa. No hay equivalente actual. | 🆕 CREAR TABLA |
| 6 | `logs_actividad` | ❌ No existe | — | — | Tabla completa. No hay auditoría implementada. | 🆕 CREAR TABLA |
| 7 | `permisos` | ❌ No existe | — | — | Tabla completa. No hay sistema de permisos granular; todo se maneja por rol string. | 🆕 CREAR TABLA |
| 8 | `roles_permisos` | ❌ No existe | — | — | Tabla M:N completa. | 🆕 CREAR TABLA |

### MÓDULO 2: Estructura Académica (7 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 9 | `anos_lectivos` | ✅ Parcial | `AcademicCycle` (tenant) | id, name ≈ ano_nombre, startDate ≈ fecha_inicio, endDate ≈ fecha_fin, active ≈ activo | — | ✅ OK |
| 10 | `niveles_educativos` | ❌ No existe | — | — | Tabla completa. Actualmente el nivel es un `Int` disperso por múltiples tablas (`InstitutionLevel.level`, `AcademicCycle.level`, `Subject.level`, `CourseSection.level`). No hay catálogo de niveles. | 🆕 CREAR TABLA |
| 11 | `cursos` | 🔄 Diferente | `CourseSection` (tenant) | id, name ≈ nombre_curso, relacionado a nivel via campo `level: Int`, academicYear (string) | `cupo_maximo` no existe. FK a `niveles_educativos` y `anos_lectivos` no existen (usa level inline Int + academicYear String). Campos extra: `grade`, `division`, `modality`. **Diferencia de modelo**: el DER referencia tablas de lookup; la implementación actual usa campos inline. | 🔄 REFACTOR |
| 12 | `materias` | ✅ Parcial | `Subject` (tenant) | id, name ≈ nombre_materia | `codigo`, `descripcion`. Campos extra en actual: `level` (Int), `modality` (Int). | ⚠️ AGREGAR CAMPOS |
| 13 | `clases_asignaciones` | ✅ OK | `SubjectAssignment` (tenant) | id, subjectId ≈ id_materia, teacherId ≈ id_profesor, courseSectionId ≈ id_curso | — | ✅ OK |
| 14 | `aulas_fisicas` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 15 | `horarios_clases` | ❌ No existe | — | — | Tabla completa. Depende de `aulas_fisicas` (#14). | 🆕 CREAR TABLA |

### MÓDULO 3: Matrículas y Familia (4 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 16 | `matriculas` | ✅ Parcial | `Enrollment` (tenant) | id, studentId ≈ id_alumno, status ≈ estado_matricula, enrolledAt ≈ fecha_matricula | `legajo_numero`. **Diferencia estructural**: DER tiene FK `id_curso` → `cursos`; actual tiene `level`+`modality`+`academicYear`+`grade`+`division` inline + FK `cycleId` → `AcademicCycle`. No hay FK a `CourseSection`. **Inconsistencia a resolver**: cuál es el modelo canónico. | ⚠️ AGREGAR CAMPOS |
| 17 | `tutores_alumnos` | 🟡 Embrionario | `Student.guardianName`, `Student.guardianPhone` | — | Tabla completa M:N con `parentesco`, `es_responsable_economico`, `autorizado_retirar`. La tabla actual solo tiene dos strings planos en Student (un solo tutor). No existe tabla `tutores`. | 🆕 CREAR TABLA |
| 18 | `historial_academico` | ❌ No existe | — | — | Tabla completa. El `Enrollment` actual registra año a año pero no tiene `resultado_final` ni `promedio_general`. | 🆕 CREAR TABLA |
| 19 | `documentacion_alumnos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 4: Evaluación y Asistencia (6 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 20 | `evaluaciones` | ❌ No existe | — | — | Tabla completa. La implementación actual no modela evaluaciones como entidad separada; califica directamente contra `subject` + `courseSection`. | 🆕 CREAR TABLA |
| 21 | `notas` | 🔄 Diferente | `Grade` (tenant) | id, studentId ≈ id_alumno, numericValue ≈ valor_nota, qualitativeValue ≈ comentarios, evaluatedAt ≈ fecha_registro | **Diferencia estructural clave**: DER tiene FK `id_evaluacion` → `evaluaciones` + FK `id_alumno`. Actual tiene `subjectId`, `courseSectionId`, `cycleId`, `period` (string). La actual no tiene `comentarios` (usa `qualitativeValue` que es distinto). `notas` depende de `evaluaciones` (#20) que no existe. | 🔄 REFACTOR |
| 22 | `periodos_evaluacion` | 🟡 Embrionario | `AcademicCycle` + `period` string en `Grade` | — | Tabla completa con `id_periodo`, `id_ano_lectivo`, `nombre_periodo`, `fecha_desde`, `fecha_hasta`. Actualmente `period` es solo un string (`"1T"`, `"2T"`) sin fechas ni FK. | 🆕 CREAR TABLA |
| 23 | `notas_trimestrales` | ❌ No existe | — | — | Tabla completa. Es una tabla de cierre/consolidación diferente a `notas`. | 🆕 CREAR TABLA |
| 24 | `asistencias` | ✅ Parcial | `Attendance` (tenant) | id, studentId ≈ id_alumno, date ≈ fecha, note ≈ observaciones | `id_asignacion` (FK a SubjectAssignment). Actual usa `courseSectionId` + `subjectId` por separado. DER usa `estado` como string; actual usa `statusId` FK → `AttendanceStatus` (más robusto). | ⚠️ AGREGAR CAMPOS |
| 25 | `justificantes_asistencia` | ❌ No existe | — | — | Tabla completa. Depende de `tutores` (#17) e `id_tutor`. | 🆕 CREAR TABLA |

### MÓDULO 5: Convivencia y Disciplina (3 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 26 | `tipos_incidencias` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 27 | `incidencias_disciplina` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 28 | `sanciones` | ❌ No existe | — | — | Tabla completa. Depende de `incidencias_disciplina` (#27). | 🆕 CREAR TABLA |

### MÓDULO 6: Comunicaciones (6 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 29 | `mensajes` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 30 | `mensajes_destinatarios` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 31 | `mensajes_adjuntos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 32 | `notificaciones_push` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 33 | `avisos_cartelera` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 34 | `aviso_curso_alcance` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 7: Finanzas (8 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 35 | `conceptos_pago` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 36 | `cuentas_corrientes_alumnos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 37 | `cargos_generados` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 38 | `pagos_recibidos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 39 | `pagos_cargos_detalle` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 40 | `metodos_pago` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 41 | `becas_descuentos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 42 | `alumnos_becas` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 8: LMS Ligero (5 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 43 | `tareas_asignadas` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 44 | `tareas_entregas` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 45 | `materiales_didacticos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 46 | `libros_biblioteca` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 47 | `prestamos_libros` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 9: Servicios Complementarios (7 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 48 | `rutas_transporte` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 49 | `paradas_transporte` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 50 | `alumnos_transporte` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 51 | `comedor_menus` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 52 | `comedor_inscritos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 53 | `actividades_extraescolares` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 54 | `inscritos_extraescolares` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 10: Eventos y Médico (3 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 55 | `eventos_calendario` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 56 | `fichas_medicas_alumnos` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |
| 57 | `visitas_enfermeria` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

### MÓDULO 11: Configuración (4 tablas)

| # | Tabla DER | Existe? | Nombre actual | Campos cubiertos | Campos faltantes | Acción |
|---|-----------|---------|---------------|-----------------|------------------|--------|
| 58 | `configuracion_sistema` | 🟡 Dispersa | `Institution` (master) — 25 campos | Parte de la config está en `Institution` (SMTP, socket, colores, branding, flags `sendEmail`, `sendMessages`). | Tabla completa como entidad separada no existe. La config actual está acoplada a `Institution`. El DER la quiere como tabla independiente con posiblemente estructura key-value. | 🔄 REFACTOR |
| 59 | `datos_institucion` | ✅ OK | `Institution` (master) | name, address, city, postalCode, country, phone, website, contactEmail, logoUrl, cue, ministryReg | — | ✅ OK |
| 60 | `paises` | ❌ No existe | — | — | Tabla completa. Actualmente `country` es un string con default `"AR"`. | 🆕 CREAR TABLA |
| 61 | `provincias_estados` | ❌ No existe | — | — | Tabla completa. | 🆕 CREAR TABLA |

---

## Resumen Ejecutivo

### Totales generales

| Métrica | Cantidad | % |
|----------|----------|---|
| **Total tablas en DER** | **61** | 100% |
| ✅ **OK** (fully implemented) | **4** | 6.6% |
| ⚠️ **AGREGAR CAMPOS** (exists, missing fields) | **5** | 8.2% |
| 🔄 **REFACTOR** (exists, needs structural changes) | **4** | 6.6% |
| 🆕 **CREAR TABLA** (doesn't exist at all) | **48** | 78.7% |

### Desglose por módulo

| Módulo | Tablas DER | ✅ OK | ⚠️ Parcial | 🔄 Refactor | 🆕 Nuevas | % Cubierto |
|--------|-----------|-------|------------|-------------|-----------|------------|
| 1. Core | 8 | 0 | 2 | 1 | 5 | 25% |
| 2. Estructura Académica | 7 | 2 | 1 | 1 | 3 | 43% |
| 3. Matrículas y Familia | 4 | 0 | 2 | 0 | 2 | 25% |
| 4. Evaluación y Asistencia | 6 | 0 | 1 | 1 | 4 | 8% |
| 5. Convivencia y Disciplina | 3 | 0 | 0 | 0 | 3 | 0% |
| 6. Comunicaciones | 6 | 0 | 0 | 0 | 6 | 0% |
| 7. Finanzas | 8 | 0 | 0 | 0 | 8 | 0% |
| 8. LMS Ligero | 5 | 0 | 0 | 0 | 5 | 0% |
| 9. Servicios Complementarios | 7 | 0 | 0 | 0 | 7 | 0% |
| 10. Eventos y Médico | 3 | 0 | 0 | 0 | 3 | 0% |
| 11. Configuración | 4 | 1 | 0 | 1 | 2 | 25% |

### Lo que SÍ existe (14 modelos actuales)

| Modelo actual | DB | Tablas DER que cubre |
|---------------|-----|---------------------|
| `User` | Master | `usuarios` (#1) — parcial |
| `RefreshToken` | Master | `tokens_seguridad` (#4) — parcial |
| `Institution` | Master | `datos_institucion` (#59) + `configuracion_sistema` (#58) — parcial |
| `InstitutionLevel` | Master | — (no tiene equivalente directo en el DER) |
| `Student` | Tenant | — (no es tabla del DER; alimenta `matriculas`, `notas`, `asistencias`) |
| `Teacher` | Tenant | — (no es tabla del DER; alimenta `clases_asignaciones`) |
| `AcademicCycle` | Tenant | `anos_lectivos` (#9) — buena cobertura |
| `Enrollment` | Tenant | `matriculas` (#16) — parcial |
| `Subject` | Tenant | `materias` (#12) — parcial |
| `CourseSection` | Tenant | `cursos` (#11) — difiere en modelo |
| `SubjectAssignment` | Tenant | `clases_asignaciones` (#13) — buena cobertura |
| `Grade` | Tenant | `notas` (#21) — difiere en modelo |
| `AttendanceStatus` | Tenant | — (no es tabla del DER; mejora sobre `estado` string) |
| `Attendance` | Tenant | `asistencias` (#24) — parcial |

### Decisiones de diseño que requieren discusión

1. **`User` (master) vs `usuarios` (DER)**: El DER parece asumir una DB única donde `usuarios` vive junto a todo lo demás. En la arquitectura multi-tenant actual, `User` está en master DB y `Student`/`Teacher` están en tenant DB. Hay que decidir si `usuarios` del DER incluye o no a los alumnos/docentes, o si es solo para usuarios del sistema (admin, staff).

2. **Roles M:N vs Rol inline**: El cambio más disruptivo del Módulo 1. El DER pide tabla `roles` + `usuarios_roles` (M:N) + `permisos` + `roles_permisos`. La implementación actual tiene un string `role` en `User`. Implementar RBAC completo es un proyecto en sí mismo. Evaluar si con un enum de roles alcanza para la fase actual o si se necesita granularidad de permisos desde ya.

3. **`evaluaciones` + `notas` vs `Grade`**: La diferencia más profunda en el modelo pedagógico. El DER modela: `clases_asignaciones → evaluaciones → notas` (una asignación tiene muchas evaluaciones, cada evaluación tiene muchas notas). La implementación actual modela: `SubjectAssignment → Grade` (directo, con `period` como string). Esto afecta cómo se registran las calificaciones y requiere reescribir el módulo de grading.

4. **`cursos` con FKs vs `CourseSection` con campos inline**: El DER referencia `niveles_educativos` y `anos_lectivos` como tablas de lookup. La implementación actual usa `level: Int` y `academicYear: String` inline. Crear las tablas de lookup implicaría migrar datos y cambiar queries en todo el sistema.

5. **`horarios_clases` depende de `aulas_fisicas`**: Ambas son nuevas. Si no se implementan juntas, `horarios_clases` queda cojo (necesita `id_aula_fisica`). Conviene planificar ambas en el mismo sprint.

6. **`tutores_alumnos` implica crear tabla `tutores`**: Actualmente `guardianName` y `guardianPhone` son strings planos en `Student`. Para implementar la relación M:N con `parentesco`, `es_responsable_economico`, `autorizado_retirar`, se necesita una entidad `Tutor` separada (o reutilizar `Student`/`User` con rol tutor).

7. **`notas_trimestrales` (#23) vs `historial_academico` (#18)**: Ambas parecen tener solapamiento conceptual (ambas consolidan información del alumno). El DER podría estar duplicando responsabilidad. Vale la pena revisar si se pueden unificar.

8. **Módulos 5-10 (36 tablas, 59% del DER) no tienen NINGÚN código**: Son módulos completamente nuevos. Conviene priorizarlos por valor de negocio, no intentar implementarlos todos de una vez.

### Tablas del DER que NO existen como modelos pero tienen datos embrionarios

| Tabla DER | Dónde está la data hoy |
|-----------|------------------------|
| `tutores_alumnos` | `Student.guardianName`, `Student.guardianPhone` (strings planos) |
| `roles` | `User.role` (string inline), `RefreshToken.role` |
| `periodos_evaluacion` | `Grade.period` (string como `"1T"`, `"2T"`, `"3T"`) |
| `niveles_educativos` | `level: Int` disperso en `InstitutionLevel`, `AcademicCycle`, `Subject`, `CourseSection`, `Enrollment` |
| `configuracion_sistema` | Campos sueltos en `Institution` (SMTP, socket, colores, flags) |
| `historial_academico` | `Enrollment` registra año a año pero sin resultado final ni promedio |

### Riesgos identificados

- **R1 — Explosión de tablas**: Pasar de 14 a 61 modelos (+335%) es un cambio masivo. Las migraciones de Prisma van a ser complejas.
- **R2 — RBAC es un proyecto aparte**: Implementar `roles` + `usuarios_roles` + `permisos` + `roles_permisos` + `logs_actividad` es funcionalidad de seguridad que toca cada endpoint. No es un "agregar tabla".
- **R3 — Migración de datos**: Tablas como `Grade → notas` implican migrar datos existentes a una estructura diferente. Riesgo de pérdida de datos históricos.
- **R4 — Tenant isolation**: Las tablas del DER no distinguen master vs tenant. Hay que decidir para cada tabla nueva en qué DB vive. `roles`, `permisos`, `usuarios_roles` probablemente van en master. `evaluaciones`, `notas`, `tutorias` van en tenant.
- **R5 — Dependencias en cadena**: Muchas tablas dependen de otras que también son nuevas (ej: `sanciones → incidencias → tipos_incidencias`). Implementar de atrás para adelante.

### Recomendación de priorización

Basado en dependencias y valor de negocio:

```
FASE 1 — Fundaciones (sin dependencias externas)
├── Módulo 1: roles, permisos, usuarios_roles, roles_permisos
├── Módulo 11: paises, provincias_estados
├── Módulo 2: niveles_educativos, aulas_fisicas

FASE 2 — Core pedagógico
├── Módulo 2: cursos (refactor), materias (agregar campos), horarios_clases
├── Módulo 3: matriculas (agregar campos), tutores_alumnos, historial_academico
├── Módulo 4: evaluaciones, periodos_evaluacion, notas (refactor), notas_trimestrales, justificantes_asistencia

FASE 3 — Operaciones
├── Módulo 1: logs_actividad, dispositivos_usuarios
├── Módulo 5: tipos_incidencias, incidencias_disciplina, sanciones
├── Módulo 3: documentacion_alumnos

FASE 4 — Features adicionales (por valor de negocio)
├── Módulo 7: Finanzas (8 tablas)
├── Módulo 6: Comunicaciones (6 tablas)
├── Módulo 8: LMS Ligero (5 tablas)
├── Módulo 9: Servicios Complementarios (7 tablas)
├── Módulo 10: Eventos y Médico (3 tablas)
```
