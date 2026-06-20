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
  institutionId?: string;
  level?: string;
  grade?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface ListarAlumnosDeps {
  prisma: TenantPrismaClient;
}

/**
 * ListarAlumnosQuery — SDD-2 R13.
 *
 * nivel/grado/division/estado are resolved from AlumnosXCursoXCiclo → CourseCycle → CourseSection
 * instead of the legacy student.enrollments include.
 * - nivel  = String(alumnosXCursoXCiclo[0].courseCycle.level)
 * - grado  = courseCycle.course.grade
 * - division = courseCycle.course.division
 * - estado = 'ACTIVE' when row exists; 'SIN_INSCRIPCION' when not.
 */
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
        alumnosXCursoXCiclo: {
          take: 1,
          orderBy: { createdAt: 'desc' as const },
          include: {
            courseCycle: {
              select: {
                level: true,
                course: { select: { grade: true, division: true } },
              },
            },
          },
        },
      },
      skip: ((input.page ?? 1) - 1) * (input.pageSize ?? 20),
      take: input.pageSize ?? 20,
    });

    const result = alumnos.map((a: Record<string, unknown>) => {
      const axcc = (a.alumnosXCursoXCiclo as Array<Record<string, unknown>>)?.[0];
      const cc = axcc?.courseCycle as Record<string, unknown> | undefined;
      const course = cc?.course as Record<string, unknown> | undefined;
      return {
        id: a.id as string,
        nombre: a.firstName as string,
        apellido: a.lastName as string,
        dni: a.dni as string,
        nivel: axcc ? String(cc?.level ?? '') : '',
        grado: course?.grade as string | undefined,
        division: course?.division as string | undefined,
        estado: axcc ? 'ACTIVE' : 'SIN_INSCRIPCION',
      };
    });

    return ok(result);
  }
}
