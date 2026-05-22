# EducandoW — Documentación General

> **Orquestador general**: Visión completa del negocio, arquitectura global y delegación a módulos.
> Cada módulo tiene su propio orquestador que descompone en tareas atómicas para agentes SDD.

---

## 📐 Arquitectura Global

```
                    ┌─────────────────────────┐
                    │   ORQUESTADOR GENERAL    │
                    │   (este documento)       │
                    │   • Visión de negocio    │
                    │   • DER completo         │
                    │   • Reglas globales      │
                    │   • Delegación           │
                    └────────┬────────────────┘
                             │
        ┌────────┬───────────┼───────────┬──────────┬──────────┐
        ▼        ▼           ▼           ▼          ▼          ▼
   ┌────────┐┌────────┐┌────────┐┌──────────┐┌────────┐┌──────────┐
   │  AUTH  ││ INSTIT ││  PLAN  ││  CICLO   ││ CALIF  ││ ASISTENC │
   │  00    ││  01    ││  02    ││   03     ││  04    ││   05     │
   └────────┘└────────┘└────────┘└──────────┘└────────┘└──────────┘
        │        │           │           │          │          │
        │        │           │           │          │          │
        ▼        ▼           ▼           ▼          ▼          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    NIVELES PEDAGÓGICOS                       │
   │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
   │   │ INICIAL  │  │ PRIMARIO │  │SECUNDARIO│  │ TERCIARIO│   │
   │   │   10     │  │   11     │  │   12     │  │   13     │   │
   │   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
   └─────────────────────────────────────────────────────────────┘
```

## 📋 Índice de Documentos

### Documentos Generales (leer primero)

| Documento | Contenido | Cuándo leerlo |
|---|---|---|
| [DER Completo](./DER-y-diseno-global.md) | 40 tablas, 51 reglas, jerarquía, SQL | Al iniciar el proyecto |
| [Arquitectura SaaS](./DER-y-diseno-global.md#0-arquitectura-saas-multi-tenant) | Multi-tenant, master/tenant DB | Al diseñar infraestructura |

### Módulos Transversales (afectan a todos los niveles)

| Módulo | Carpeta | Tablas | Reglas | Estado |
|---|---|---|---|---|
| [00 — Auth](./modulos/00-auth/README.md) | `modulos/00-auth/` | users, refresh_tokens | R1-R10 | ✅ Implementado |
| [01 — Instituciones](./modulos/01-instituciones/README.md) | `modulos/01-instituciones/` | institutions (25 campos) | R11-R15 | 📐 Diseñado |
| [02 — Plan de Estudios](./modulos/02-plan-estudios/README.md) | `modulos/02-plan-estudios/` | study_plans, study_plan_courses, study_plan_subjects, correlatives | R16-R22 | 📐 Diseñado |
| [03 — Ciclo Lectivo](./modulos/03-ciclo-lectivo/README.md) | `modulos/03-ciclo-lectivo/` | academic_cycles, academic_cycle_periods, academic_cycle_study_plans | R32-R39 | 📐 Diseñado |
| [04 — Calificaciones](./modulos/04-calificaciones/README.md) | `modulos/04-calificaciones/` | grade_scales, grading_period_types, subject_grading_configs, student_grades | R23-R31 | 📐 Diseñado |
| [05 — Asistencia](./modulos/05-asistencia/README.md) | `modulos/05-asistencia/` | attendance_codes, attendances | R40-R51 | 📐 Diseñado |

### Niveles Pedagógicos (implementan lógica específica)

| Nivel | Carpeta | Tablas propias | Estado |
|---|---|---|---|
| [10 — Inicial](./modulos/10-nivel-inicial/README.md) | `modulos/10-nivel-inicial/` | salas, informes_evolutivos, planificaciones... | 🔲 Sin diseñar |
| [11 — Primario](./modulos/11-nivel-primario/README.md) | `modulos/11-nivel-primario/` | grados, calificaciones_primario | 🔲 Sin diseñar |
| [12 — Secundario](./modulos/12-nivel-secundario/README.md) | `modulos/12-nivel-secundario/` | cursos, calificaciones_secundario, mesas_examen... | 🔲 Sin diseñar |
| [13 — Terciario](./modulos/13-nivel-terciario/README.md) | `modulos/13-nivel-terciario/` | inscripciones_materia, actas_examen, titulos | 🔲 Sin diseñar |

---

## 🔄 Cómo usar esta documentación

### Para el Orquestador General (este doc)
1. Lee el DER completo → entiende el negocio
2. Identifica qué módulo necesita trabajo
3. Delega al README del módulo correspondiente
4. El módulo tiene su propio orquestador que divide en tareas

### Para un Orquestador de Módulo (ej: `modulos/02-plan-estudios/README.md`)
```markdown
# Módulo: Plan de Estudios

## Contexto
- Tablas que maneja: study_plans, study_plan_courses, study_plan_subjects, correlatives
- Reglas que aplican: R16-R22
- Depende de: subjects (tabla ya existente)

## Tareas atómicas (para agentes SDD)
1. [ ] Crear entidades del dominio (StudyPlan, StudyPlanCourse, StudyPlanSubject, Correlative)
2. [ ] Crear interfaces de repositorio
3. [ ] Implementar repositorios Prisma
4. [ ] Crear use cases (CreateStudyPlan, ListStudyPlans, AddSubject, etc.)
5. [ ] Crear controller + DTOs + módulo
6. [ ] Escribir tests unitarios

## Contratos de API
POST   /v1/study-plans
GET    /v1/study-plans?level=SECUNDARIO
POST   /v1/study-plans/:id/subjects
...
```

### Para un Agente SDD (recibe UNA tarea)
- Recibe: "Crear entidades del dominio para StudyPlan"
- Contexto mínimo: el diseño de la entidad, las reglas que aplican
- No necesita conocer el DER completo
- Entrega: archivos implementados + tests

---

## 📊 Estado General

| Capa | Módulos completados | Módulos diseñados | Módulos pendientes |
|---|---|---|---|
| Transversal | Auth ✅ | 5 módulos | 0 |
| Niveles | 0 | 0 | 4 niveles |
| **Total** | **1/10** | **5/10** | **4/10** |
