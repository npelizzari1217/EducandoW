import { Injectable } from '@nestjs/common';
import type { DocenteXCicloRepository } from '@educandow/domain';
import { PrismaService } from '../../infrastructure/persistence/prisma/prisma.service';

export interface DocenteXCicloEntry {
  docenteXCicloId: string;
  userId: string;
  cycleId: string;
  active: boolean;
  // Persona from master User (DC-R2, DC-S4)
  firstName: string | null;
  lastName: string | null;
  dni: string | null;
  title: string | null;
  phone: string | null;
}

/**
 * ListDocentesXCicloUseCase — F2-P1, F2-P2.
 *
 * Returns all active DocenteXCiclo records for a cycle, enriched with persona
 * fields joined from the master User (DC-R2: persona lives in User, not here).
 */
@Injectable()
export class ListDocentesXCicloUseCase {
  constructor(
    private readonly repo: DocenteXCicloRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cycleId: string): Promise<DocenteXCicloEntry[]> {
    const records = await this.repo.findByCycleId(cycleId);
    if (records.length === 0) return [];

    // Batch-fetch persona from master User (DC-S4)
    const userIds = [...new Set(records.map((r) => r.userId))];
    const users = await this.prisma.getMasterClient().user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dni: true,
        title: true,
        phone: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return records.map((d) => {
      const user = userMap.get(d.userId);
      return {
        docenteXCicloId: d.id,
        userId: d.userId,
        cycleId: d.cycleId,
        active: d.active,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        dni: user?.dni ?? null,
        title: user?.title ?? null,
        phone: user?.phone ?? null,
      };
    });
  }
}
