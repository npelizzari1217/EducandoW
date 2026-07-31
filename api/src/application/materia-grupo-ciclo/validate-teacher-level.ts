import { ValidationError, ok, err, Result } from '@educandow/domain';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

/**
 * Validates that a user's composite levels include the course-cycle's composite level.
 * ROOT and ADMIN bypass the check (allLevels).
 * Returns err(ValidationError) if user has no access to the CC's level.
 *
 * Extracted from CreateGrupoUseCase so UpdateGrupoUseCase can reuse it.
 */
export async function validateTeacherLevel(
  prisma: PrismaService,
  userId: string,
  courseCycleId: string,
): Promise<Result<void, ValidationError>> {
  const user = await prisma.getMasterClient().user.findUnique({
    where: { id: userId },
    select: {
      userRoles: { select: { role: { select: { name: true } } } },
      userLevels: { select: { level: true, modality: true } },
    },
  });
  if (!user) return ok(undefined);

  const roleNames = user.userRoles.map((ur: { role: { name: string } }) => ur.role.name);
  if (roleNames.includes('ROOT') || roleNames.includes('ADMIN')) return ok(undefined);

  const client = TenantContext.getClient();
  if (!client) return ok(undefined);

  const cc = await client.courseCycle.findUnique({
    where: { uuid: courseCycleId },
    select: { level: true },
  });
  if (!cc) return ok(undefined);

  const compositeLevels = user.userLevels.map(
    (ul: { level: number; modality: number }) => ul.level * 10 + ul.modality,
  );
  if (!compositeLevels.includes(cc.level)) {
    return err(new ValidationError('La materia no pertenece al nivel del docente'));
  }
  return ok(undefined);
}
