# Design: Permisos de Estudiantes con Tutores

## Technical Approach

Domain-first siguiendo el patrón existente (entity + repo interface → Prisma schema → repo impl → use cases → controller). Se agrega la entidad `StudentGuardian` (N:M), nuevos campos en `Student`, endpoints con field-level permissions en el use case (no en el guard), y seed RBAC para TUTOR/STUDENT.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Field-level validation location | Controller vs Use case | Controller conoce HTTP no dominio; use case recibe body+roles y valida | **Use case**: recibe body + caller roles, devuelve `ForbiddenError` si campos bloqueados |
| userId en StudentGuardian (cross-DB) | FK real vs validación app-layer | FK requiere mismo DB, imposible en multi-tenant | **Validación app-layer**: log warning si userId no existe en master, sin FK |
| guardianName/phone legacy | Dropear vs preservar | Dropear rompe rollback y pierde datos sin User match | **Preservar**: campos se mantienen, migración crea StudentGuardian solo si hay User match |
| StudentGuardian vs embed en User | Tabla separada vs campo en User | User está en master DB (cross-DB), imposible FK directa. N:M natural entre Student y User | **Entidad separada** en tenant DB con userId como string |

## Data Flow

```
PATCH /students/:id
  Controller (@Roles STUDENTS:UPDATE | STUDENTS:READ+field-check)
    → PatchStudentUseCase.execute(id, body, { userId, roles })
      1. Valida existencia del student
      2. Determina allowedFields según roles (TUTOR/STUDENT → 6 campos; resto → all)
      3. Si body tiene campos bloqueados → ForbiddenError
      4. Si TUTOR/STUDENT, verifica ownership (userId match o guardian link)
      5. Actualiza y guarda

GET /students/me
  Controller (@Roles STUDENTS:READ)
    → GetMyStudentDataUseCase.execute(userId)
      1. studentRepo.findByUserId(userId) → Student | null
      2. Si null → NotFoundError

GET /students/my-children
  Controller (@Roles STUDENTS:READ)
    → GetMyChildrenUseCase.execute(userId)
      1. studentGuardianRepo.findByGuardianUserId(userId)
      2. Mapea guardianIds → studentRepo.findById()
```

## File Changes

### Domain (`packages/domain/src/personnel/`)
| File | Action | Description |
|------|--------|-------------|
| `entities/student.ts` | Modify | +`address`, `phone`, `photoUrl`, `userId` en `StudentProps` y getters |
| `entities/student-guardian.ts` | Create | Entity: `id`, `studentId`, `userId`, `relationship`, `createdAt` |
| `entities/index.ts` | Modify | Re-export `StudentGuardian` |
| `repositories/student-repository.ts` | Modify | +`findByUserId`, `findByGuardianUserId` |
| `repositories/student-guardian-repository.ts` | Create | Interface: `save`, `findById`, `findByStudentId`, `findByGuardianUserId`, `delete`, `findByComposite` |
| `index.ts` | Modify | Re-export `StudentGuardianRepository` |

### Prisma Schema (`api/prisma/`)
| File | Action | Description |
|------|--------|-------------|
| `schema_tenant.prisma` | Modify | +`address`, `phone`, `photoUrl`, `userId` en model Student; nuevo model `StudentGuardian` con `@@unique([studentId, userId])` |
| `seed.ts` | Modify | TUTOR: +`m-students:READ`, STUDENT: +`m-students:READ` |
| `seed-rbac.sql` | Modify | +INSERT role_modules para `r-tutor` y `r-student` con module `m-students`, action `READ` |

### Infrastructure (`api/src/infrastructure/persistence/prisma/repositories/`)
| File | Action | Description |
|------|--------|-------------|
| `prisma-student.repository.ts` | Modify | +`findByUserId`, `findByGuardianUserId`, actualizar `save()` y `toDomain()` con nuevos campos |
| `prisma-student-guardian.repository.ts` | Create | Implementa `StudentGuardianRepository` con Prisma tenant client |

### Application (`api/src/application/student/`)
| File | Action | Description |
|------|--------|-------------|
| `use-cases/student.use-cases.ts` | Modify | +`PatchStudentUseCase`, `GetMyStudentDataUseCase`, `GetMyChildrenUseCase`, `AssignGuardianUseCase`, `RemoveGuardianUseCase` |

### Presentation (`api/src/presentation/student/`)
| File | Action | Description |
|------|--------|-------------|
| `dto/update-student.dto.ts` | Create | `UpdateStudentSchema` (Zod partial fields) |
| `dto/assign-guardian.dto.ts` | Create | `AssignGuardianSchema`: `userId` (uuid), `relationship` (enum) |
| `student.controller.ts` | Modify | +PATCH `/:id`, GET `/me`, GET `/my-children`, POST `/:id/guardians`, DELETE `/:id/guardians/:gid` |
| `student.module.ts` | Modify | Registrar nuevos use cases y `PrismaStudentGuardianRepository` |

### Frontend (`web/src/pages/dashboard/`)
| File | Action | Description |
|------|--------|-------------|
| `students.tsx` | Modify | Detectar rol TUTOR → llamar `/my-children`, STUDENT → `/me`. Campos readonly según rol en form de edición. |

### Migration (`api/prisma/migrations/`)
| File | Action | Description |
|------|--------|-------------|
| `migration.sql` | Create | Prisma migrate: +cols Student, +table StudentGuardian |
| `migrate-guardians.ts` | Create | Script idempotente: leer guardianPhone, buscar User por phone, crear StudentGuardian |

## Interfaces / Contracts

```typescript
// StudentGuardian entity (domain)
interface StudentGuardianProps {
  id: Id; studentId: string; userId: string;
  relationship: 'mother' | 'father' | 'legal_guardian' | 'other';
  createdAt: Date;
}

// StudentGuardianRepository (domain)
interface StudentGuardianRepository {
  save(g: StudentGuardian): Promise<void>;
  findById(id: string): Promise<StudentGuardian | null>;
  findByStudentId(sid: string): Promise<StudentGuardian[]>;
  findByGuardianUserId(uid: string): Promise<StudentGuardian[]>;
  delete(id: string): Promise<void>;
  findByComposite(sid: string, uid: string): Promise<StudentGuardian | null>;
}

// Field-level permission array (use case)
const ALLOWED_TUTOR_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Domain | `StudentGuardian.create()`, `Student` nuevos getters | Vitest unit tests en `packages/domain/src/personnel/__tests__/` |
| Application | `PatchStudentUseCase`: field-block rejection, ownership check, allowed field update | Mock repos, test por rol |
| Infrastructure | `PrismaStudentGuardianRepository`: composite unique, CRUD | Integration test con tenant DB |
| Presentation | Controller: 403 en campos bloqueados, 404 en /me sin student, 200 en /my-children vacío | E2E con supertest |

## Migration / Rollout

1. Prisma migrate agrega columnas y tabla `student_guardians`
2. Script `migrate-guardians.ts` (idempotente): recorre Students con `guardianPhone`, busca User en master DB por phone match, crea `StudentGuardian` con `relationship: 'other'`
3. Seed: `pnpm prisma db seed` actualiza `role_modules`
4. Rollback: revert commit + revertir migración. guardianName/phone preservados.

## Open Questions

None.
