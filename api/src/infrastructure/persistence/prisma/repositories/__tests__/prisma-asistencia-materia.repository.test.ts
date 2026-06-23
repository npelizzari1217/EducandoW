/**
 * PrismaAsistenciaMateriaRepository — unit tests.
 * TDD RED → GREEN for findByScopeAndMonthEnriched (T-BE-2b).
 *
 * Covers:
 *   REPO-MAT-T01: findMany called with correct include + orderBy (no studentIds filter)
 *   REPO-MAT-T02: maps to { attendance, studentName: "Apellido, Nombre" }
 *   REPO-MAT-T03: studentIds filter applied when provided
 *   REPO-MAT-T04: findByScopeAndMonth unchanged (no regression — still returns domain entities)
 *
 * Pattern: mock TenantContext.getClient(), no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsistenciaXMateriaXAlumnoXCursoXCiclo } from '@educandow/domain';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

import { TenantContext } from '../../../../auth/tenant.context';
import { PrismaAsistenciaMateriaRepository } from '../prisma-asistencia-materia.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-m1',
    materiaXCursoXCicloId: 'mx-1',
    studentId: 'stu-1',
    year: 2026,
    month: 6,
    days: { '1': 'P' },
    createdAt: new Date('2026-06-01'),
    updatedAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function makePrismaRowWithStudent(
  studentId: string,
  lastName: string,
  firstName: string,
  rowOverrides: Record<string, unknown> = {},
) {
  return {
    ...makePrismaRow({ studentId, ...rowOverrides }),
    student: { firstName, lastName },
  };
}

function makeClient(rows: unknown[]) {
  return {
    asistenciaXMateriaXAlumnoXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PrismaAsistenciaMateriaRepository — findByScopeAndMonthEnriched', () => {
  let repo: PrismaAsistenciaMateriaRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAsistenciaMateriaRepository();
  });

  describe('REPO-MAT-T01: findMany called with correct include + orderBy', () => {
    it('passes include: { student: { select: { firstName, lastName } } } and orderBy by name', async () => {
      const prismaRow = makePrismaRowWithStudent('stu-1', 'García', 'Luis');
      const client = makeClient([prismaRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.findByScopeAndMonthEnriched('mx-1', 2026, 6);

      expect(client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith({
        where: { materiaXCursoXCicloId: 'mx-1', year: 2026, month: 6 },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      });
    });
  });

  describe('REPO-MAT-T02: maps to { attendance, studentName: "Apellido, Nombre" }', () => {
    it('returns enriched wrapper with correct studentName format', async () => {
      const prismaRow = makePrismaRowWithStudent('stu-1', 'Zelaya', 'Ana');
      const client = makeClient([prismaRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findByScopeAndMonthEnriched('mx-1', 2026, 6);

      expect(result).toHaveLength(1);
      expect(result[0].studentName).toBe('Zelaya, Ana');
      expect(result[0].attendance).toBeInstanceOf(AsistenciaXMateriaXAlumnoXCursoXCiclo);
      expect(result[0].attendance.studentId).toBe('stu-1');
    });

    it('maps multiple rows in DB-returned order', async () => {
      const rows = [
        makePrismaRowWithStudent('stu-a', 'García', 'Ana', { id: 'row-a' }),
        makePrismaRowWithStudent('stu-b', 'García', 'Luis', { id: 'row-b' }),
        makePrismaRowWithStudent('stu-c', 'Zelaya', 'Ana', { id: 'row-c' }),
      ];
      const client = makeClient(rows);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findByScopeAndMonthEnriched('mx-1', 2026, 6);

      expect(result).toHaveLength(3);
      expect(result[0].studentName).toBe('García, Ana');
      expect(result[1].studentName).toBe('García, Luis');
      expect(result[2].studentName).toBe('Zelaya, Ana');
    });
  });

  describe('REPO-MAT-T03: studentIds filter applied when provided', () => {
    it('includes studentId: { in: studentIds } in where clause when filter is given', async () => {
      const prismaRow = makePrismaRowWithStudent('stu-1', 'García', 'Luis');
      const client = makeClient([prismaRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      await repo.findByScopeAndMonthEnriched('mx-1', 2026, 6, ['stu-1', 'stu-2']);

      expect(client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith({
        where: {
          materiaXCursoXCicloId: 'mx-1',
          year: 2026,
          month: 6,
          studentId: { in: ['stu-1', 'stu-2'] },
        },
        include: { student: { select: { firstName: true, lastName: true } } },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      });
    });
  });

  describe('REPO-MAT-T04: findByScopeAndMonth unchanged (no regression)', () => {
    it('findByScopeAndMonth still returns domain entities without studentName', async () => {
      const prismaRow = makePrismaRow();
      const client = makeClient([prismaRow]);
      vi.mocked(TenantContext.getClient).mockReturnValue(client as never);

      const result = await repo.findByScopeAndMonth('mx-1', 2026, 6);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AsistenciaXMateriaXAlumnoXCursoXCiclo);
      expect((result[0] as unknown as Record<string, unknown>)['student']).toBeUndefined();

      expect(client.asistenciaXMateriaXAlumnoXCursoXCiclo.findMany).toHaveBeenCalledWith({
        where: { materiaXCursoXCicloId: 'mx-1', year: 2026, month: 6 },
        orderBy: { studentId: 'asc' },
      });
    });
  });
});
