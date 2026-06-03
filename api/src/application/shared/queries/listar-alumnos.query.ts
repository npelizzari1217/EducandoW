import { ok, Result } from '@educandow/domain';
import { Query } from '../commands/command';
import type { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';

export interface ListadoAlumno {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  nivel: string;
  grado?: string;
  division?: string;
  estado: string;
}

export interface ListarAlumnosInput {
  institutionId: string;
  level?: string;
  grade?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface ListarAlumnosDeps {
  prisma: TenantPrismaClient;
}

export class ListarAlumnosQuery implements Query<ListarAlumnosInput, ListadoAlumno[]> {
  constructor(private readonly deps: ListarAlumnosDeps) {}

  async execute(input: ListarAlumnosInput): Promise<Result<ListadoAlumno[], Error>> {
    const where: Record<string, unknown> = {};
    if (input.search) {
      where.OR = [
        { firstName: { contains: input.search, mode: 'insensitive' } },
        { lastName: { contains: input.search, mode: 'insensitive' } },
        { dni: { contains: input.search } },
      ];
    }

    const alumnos = await this.deps.prisma.student.findMany({
      where: where as Record<string, unknown>,
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { level: true, grade: true, division: true },
        },
      },
      skip: ((input.page ?? 1) - 1) * (input.pageSize ?? 20),
      take: input.pageSize ?? 20,
    });

    const result = alumnos.map((a: Record<string, unknown>) => ({
      id: a.id as string,
      nombre: a.firstName as string,
      apellido: a.lastName as string,
      dni: a.dni as string,
      nivel: (a.enrollments as Array<Record<string, unknown>>)?.[0]?.level as string ?? '',
      grado: (a.enrollments as Array<Record<string, unknown>>)?.[0]?.grade as string | undefined,
      division: (a.enrollments as Array<Record<string, unknown>>)?.[0]?.division as string | undefined,
      estado: (a.enrollments as Array<Record<string, unknown>>)?.[0]?.status as string ?? 'SIN_INSCRIPCION',
    }));

    return ok(result);
  }
}
