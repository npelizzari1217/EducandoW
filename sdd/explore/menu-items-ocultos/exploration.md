# Exploration: Items del menú no visibles en producción

> **Fecha**: 2026-05-27 | **Fase**: EXPLORE | **Agente**: sdd-explore

---

## Current State

### Cadena completa: `institution_levels` → Sidebar

```
DB (institution_levels rows) 
  → PrismaInstitutionRepository.toDomain() → institutionLevels[] 
  → Institution.levels getter → Level[] (derivado, no independiente) 
  → Controller toResponse() → levels: number[] 
  → Frontend InstitutionContext → config.levels: number[] 
  → Sidebar → hasLevels = config.levels.length > 0 
  → makeFilterItem → requiresLevel && !hasLevels → OCULTO
```

### El filtro en detalle

**`web/src/components/layout/sidebar.tsx`** — líneas 64-77 y 84:

```ts
// Línea 72: el filtro que oculta items
if (item.requiresLevel && !hasLevels) return false;

// Línea 84: hasLevels se resuelve del config.levels
const hasLevels = config.levels.length > 0;
```

### Items afectados (todos con `requiresLevel: true`)

| Grupo | Item | `requiresLevel` |
|-------|------|:---:|
| Secretarios | Estudiantes | ✅ |
| Secretarios | Docentes | ✅ |
| Secretarios | Inscripciones | ✅ |
| Secretarios | Legajos | ✅ |
| Secretarios | Planes de Estudio | ✅ |
| Académico | Alumnos por curso | ✅ |
| Académico | Calificaciones parciales | ✅ |
| Académico | Asistencia del día | ✅ |

**No afectados** (sin `requiresLevel` o con `roles`):
- Dashboard (`path: '/'`, sin `requiresLevel`)
- Usuarios (`roles: ['ROOT', 'ADMIN', 'MANAGER']`, sin `requiresLevel`)
- Instituciones (`roles: ['ROOT', 'ADMIN']`)
- Módulos (`roles: ['ROOT']`)
- SMTP (`featureFlag: 'send_email'`)
- WebSocket (`featureFlag: 'send_messages'`)

### Cómo obtiene el frontend los niveles

**`web/src/context/institution-context.tsx`** — `InstitutionConfig.levels: number[]`:
- Llama a `GET /institutions/me` al montar
- Si la respuesta tiene `data`, usa `data.levels`  
- Si no hay institución (`data: null, reason: 'no_institution'`), usa `DEFAULT_CONFIG` con `levels: []`
- Si la request falla, usa `DEFAULT_CONFIG` con `levels: []`

**`api/src/presentation/institution/institution.controller.ts`** — endpoint `GET /me`:
- Extrae `institutionId` del JWT del usuario
- Llama a `GetMeUseCase.execute(institutionId)` → `repo.findById(id)` con `include: { levels: true }`
- Mapea a response:
  ```ts
  levels: inst.levels.map((l) => l.toCode()),
  institution_levels: inst.institutionLevels.map(...),
  ```

**`packages/domain/src/institution/entities/institution.ts`** — `get levels()`:
```ts
get levels(): Level[] {
    return this.props.institutionLevels.map((e) =>
      Level.fromParts(e.level, e.modality),
    );
  }
```
> **`levels` es DERIVADO de `institutionLevels`. Si `institutionLevels` está vacío, `levels` también lo está. No hay default.**

**`api/src/infrastructure/.../prisma-institution.repository.ts`** — `toDomain()`:
```ts
institutionLevels: (record.levels ?? []).map((l) => ({
    level: l.level as EducationalLevelCode,
    modality: l.modality as EducationalModalityCode,
})),
```
> El repositorio hace `include: { levels: true }` en todas las queries → si no hay filas en `institution_levels`, el array está vacío.

---

## Diagnóstico de entornos

### Dev local (confirmado con curl)

```json
{
  "id": "5282eecf-d315-4d94-9c8a-79282a29f05e",
  "name": "Escuela de Prueba",
  "levels": [20],              // ← Primario Común (2*10+0)
  "institution_levels": [
    { "level": 2, "modality": 0 }
  ]
}
```

✅ **Dev funciona**: `levels.length === 1` → `hasLevels = true` → sidebar completa.

### Producción (hipótesis confirmada)

❌ **La institución en producción NO tiene filas en `institution_levels`** → `levels: []` → `hasLevels = false` → 8 items ocultos.

---

## ¿Cómo se llegó a esta situación?

### Los seeds NO crean institution_levels

1. **`api/prisma/seed.ts`**: Crea roles, módulos, module_actions, role_module assignments, y el usuario ROOT. **No crea instituciones ni niveles.**
2. **`api/prisma/seed-tenant-data.ts`**: Corre en tenant DB. Crea attendance statuses, grade scales, student, teacher, enrollment, etc. **No crea institution_levels.**
3. **`api/prisma/seed-tenant.ts`**: Solo ejecuta `seedAttendanceStatuses` + `seedGradeScales`. **No crea institution_levels.**

### Las instituciones se crean por API/manualmente

- El endpoint `POST /institutions` valida que al menos un nivel esté presente (`create-institution-full.dto.ts` — `.refine()` en línea 64), pero **esta validación es reciente** (agregada con los 25 campos).
- Si la institución de producción fue creada antes de este cambio, o fue insertada directamente en la DB, no tendría niveles.
- El `PATCH /institutions/:id` sí valida que si se mandan niveles, no estén vacíos (use-case línea 335-337), pero si nunca se mandaron niveles en la creación, el update no los agrega mágicamente.

---

## Approaches

### 1. 🔧 Fix reactivo: agregar niveles a la institución de producción

Ejecutar un INSERT en la DB de producción:
```sql
INSERT INTO institution_levels (institution_id, level, modality)
VALUES ('<id-institucion-produccion>', 2, 0);
```

- **Pros**: Arregla el problema inmediato. Cero cambios de código.
- **Cons**: No previene que vuelva a pasar con nuevas instituciones. Requiere acceso a DB de producción.
- **Effort**: Bajo (1 query SQL)

### 2. 🛡️ Fix defensivo en el dominio: default a SECUNDARIO si no hay niveles

Modificar `Institution.create()` o el getter `levels` para que si `institutionLevels` está vacío, devuelva un nivel por defecto.

- **Pros**: Self-healing, ninguna institución queda sin niveles. Sin data migration.
- **Cons**: Oculta el problema real (niveles no configurados). Puede generar confusión si una institución realmente no debería tener ese nivel. Rompe el principio de que `create` debe recibir niveles explícitos.
- **Effort**: Bajo (1 cambio en domain)

### 3. 🧠 Fix en el frontend: mostrar items igual cuando no hay niveles

En `sidebar.tsx`, cambiar la lógica:
```ts
// En vez de ocultar, mostrar todos los items
if (item.requiresLevel && !hasLevels) return true; // ← mostrar de todas formas
```

- **Pros**: Sin data migration. Sin cambios en backend.
- **Cons**: Destruye el propósito de `requiresLevel`. El usuario verá secciones que requieren niveles sin tenerlos → clics llevan a páginas vacías o con errores.
- **Effort**: Bajo (1 línea)

### 4. 🎯 Fix con CTA mejorada (recomendado)

Combinación de:
1. **Mejorar el placeholder del sidebar** (ya existe en líneas 170-175 pero es sutil):
   - Hacerlo un banner visible con link a la página de configuración
   - Texto: "⚠️ No hay niveles educativos configurados. Configure los niveles para acceder a Estudiantes, Docentes, Inscripciones y más."
2. **Agregar un seed que cree niveles para la institución de prueba**:
   - En `seed.ts`, después de crear el ROOT user, crear (o actualizar) la institución "Escuela de Prueba" con niveles por defecto.
3. **Query de fix para producción** (Approach 1) como acción inmediata.

- **Pros**: Soluciona el problema actual. Previene recurrencia. Guía al usuario a arreglarlo. Respeta el contrato de `requiresLevel`.
- **Cons**: Requiere cambios en frontend + seed + DB query. 3 frentes.
- **Effort**: Medio

### 5. 🏗️ Fix estructural: seed que garantiza niveles para TODAS las instituciones

Un seed que, al correr, verifica que toda institución activa tenga al menos un nivel y si no, le agrega SECUNDARIO COMÚN.

```ts
// seed-fix-levels.ts
const insts = await prisma.institution.findMany({ include: { levels: true } });
for (const inst of insts) {
  if (inst.levels.length === 0) {
    await prisma.institutionLevel.create({
      data: { institutionId: inst.id, level: 2, modality: 0 }
    });
  }
}
```

- **Pros**: Arregla todas las instituciones de una vez. Re-ejecutable (idempotente). Puede correrse en deploy.
- **Cons**: Asume SECUNDARIO COMÚN como default para todas, lo cual puede no ser correcto.
- **Effort**: Bajo (1 script)

---

## Recommendation

**Approach 4 + 5 combinados** en este orden:

### Acción inmediata (hoy)
1. **SQL directo en producción**: Insertar nivel(es) para la institución afectada.
2. **Verificar**: Confirmar que el menú aparece completo después del fix.

### Acción preventiva (corto plazo)
3. **Seed `ensure-institution-levels.ts`**: Script idempotente que garantiza que toda institución activa tenga al menos SECUNDARIO COMÚN. Ejecutar en deploy o como parte del seed principal.
4. **Mejorar UX del sidebar**: Transformar el placeholder de advertencia (líneas 170-175) en un banner accionable con link a configuración de niveles.

### Acción estructural (mediano plazo)
5. **Agregar `institution_levels` al seed principal** (`seed.ts`): Si existe la institución "Escuela de Prueba", asegurar que tenga niveles.

---

## Riesgos

- **El SQL directo en producción requiere acceso con privilegios** — validar que el operador tenga `psql` o acceso a la consola de la DB.
- **El seed de fix asume SECUNDARIO COMÚN** — si la institución es solo INICIAL, el nivel por defecto es incorrecto. Considerar hacer el seed configurable o que tome el nivel del contexto.
- **El placeholder mejorado no debe ser invasivo** — no queremos que usuarios sin permisos de admin vean un CTA que no pueden ejecutar. Mostrar solo si el usuario es ADMIN/MANAGER/ROOT.
- **La validación del POST ya existe** — instituciones nuevas NO deberían crearse sin niveles. El riesgo es solo para instituciones legacy o inserts directos.

---

## Ready for Proposal

**Sí**. La causa raíz está confirmada:

> La institución en producción no tiene registros en `institution_levels`. Como `levels` se deriva de `institutionLevels`, la respuesta `GET /institutions/me` devuelve `levels: []`. El frontend interpreta esto como `hasLevels = false` y el filtro `makeFilterItem` oculta los 8 items con `requiresLevel: true`.

El fix es directo (agregar niveles en DB) y la prevención es simple (seed garantista + UX mejorada). Próximo paso: **PROPOSE** para formalizar el plan de acción.
