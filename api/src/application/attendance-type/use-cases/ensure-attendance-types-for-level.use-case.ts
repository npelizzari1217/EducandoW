import { Injectable } from '@nestjs/common';
import { EducationalLevelCode, AttendanceBehaviorValue } from '@educandow/domain';
import type { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * The 4 system attendance type codes generated per pedagogical level. REQ-9.
 * `behavior` fixed per code (REQ-P1-3/REQ-P1-4, ADR-02 step 3); `assignable`
 * kept for backward compat in the create payload but derives from behavior
 * at the repository layer (ADR-03) — repeated here only for readability.
 */
const SYSTEM_ATTENDANCE_TYPES = [
  { code: 'SAB', description: 'Sábado',         assignable: false, absenceValue: 0, isPresent: false, behavior: AttendanceBehaviorValue.NO_ELEGIBLE },
  { code: 'DOM', description: 'Domingo',         assignable: false, absenceValue: 0, isPresent: false, behavior: AttendanceBehaviorValue.NO_ELEGIBLE },
  { code: 'P',   description: 'Presente',        assignable: true,  absenceValue: 0, isPresent: true,  behavior: AttendanceBehaviorValue.NO_COMPUTA },
  { code: 'X',   description: 'Día no utilizado', assignable: false, absenceValue: 0, isPresent: false, behavior: AttendanceBehaviorValue.NO_ELEGIBLE },
] as const;

/** Pedagogical levels that receive system types (ADMINISTRACION=9 is excluded). */
const PEDAGOGICAL_LEVEL_CODES = new Set<number>([
  EducationalLevelCode.INICIAL,
  EducationalLevelCode.PRIMARIO,
  EducationalLevelCode.SECUNDARIO,
  EducationalLevelCode.TERCIARIO,
]);

/**
 * EnsureAttendanceTypesForLevelUseCase
 *
 * Idempotently provisions the 4 system attendance types (SAB/DOM/P/X) for each
 * pedagogical level of an institution.
 *
 * Uses PrismaService.getTenantClient(dbName) — NOT TenantContext — because this
 * use case runs from institution use cases outside of any request-scoped tenant.
 * (ADR-02)
 *
 * The upsert uses `update: {}` (no-op) so existing admin customizations are never
 * overwritten. (ADR-03)
 */
@Injectable()
export class EnsureAttendanceTypesForLevelUseCase {
  constructor(private readonly prismaService: PrismaService) {}

  async ensure(dbName: string, levels: EducationalLevelCode[]): Promise<void> {
    const client = this.prismaService.getTenantClient(dbName);

    // Deduplicate and filter out ADMINISTRACION
    const pedagogicalLevels = [...new Set(levels)].filter((l) =>
      PEDAGOGICAL_LEVEL_CODES.has(l),
    );

    for (const level of pedagogicalLevels) {
      for (const sysType of SYSTEM_ATTENDANCE_TYPES) {
        await client.attendanceType.upsert({
          where: {
            level_code: { level, code: sysType.code },
          },
          create: {
            level,
            code: sysType.code,
            description: sysType.description,
            absenceValue: sysType.absenceValue,
            isPresent: sysType.isPresent,
            assignable: sysType.assignable,
            behavior: sysType.behavior,
            isSystem: true,
            active: true,
          },
          update: {}, // idempotent: never overwrite admin customizations
        });
      }
    }
  }
}
