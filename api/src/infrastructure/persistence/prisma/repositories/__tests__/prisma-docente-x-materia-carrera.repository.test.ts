/**
 * T-08 [RED] — PrismaDocenteXMateriaCarreraRepository tests.
 * Mocks TenantContext; no real DB required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaDocenteXMateriaCarreraRepository } from '../prisma-docente-x-materia-carrera.repository';
import { TenantContext } from '../../../../auth/tenant.context';
import { DocenteXMateriaCarrera } from '@educandow/domain';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Row factory ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dxmc-1',
    userId: 'user-1',
    materiaCarreraId: 'materia-1',
    anioAcademico: '2026',
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Mock client factory ─────────────────────────────────────────────────────────

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    docenteXMateriaCarrera: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

describe('PrismaDocenteXMateriaCarreraRepository', () => {
  let client: ReturnType<typeof makeClient>;
  let repo: PrismaDocenteXMateriaCarreraRepository;

  beforeEach(() => {
    client = makeClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(client as never);
    repo = new PrismaDocenteXMateriaCarreraRepository();
  });

  // ── findActiveAssignment ─────────────────────────────────────────────────────

  describe('findActiveAssignment', () => {
    it('returns entity when active=true row exists', async () => {
      client.docenteXMateriaCarrera.findFirst.mockResolvedValue(makeRow());
      const result = await repo.findActiveAssignment('user-1', 'materia-1', '2026');
      expect(result).toBeInstanceOf(DocenteXMateriaCarrera);
      expect(client.docenteXMateriaCarrera.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', materiaCarreraId: 'materia-1', anioAcademico: '2026', active: true },
      });
    });

    it('returns null for inactive rows (SPEC-3.D)', async () => {
      client.docenteXMateriaCarrera.findFirst.mockResolvedValue(null);
      const result = await repo.findActiveAssignment('user-1', 'materia-1', '2026');
      expect(result).toBeNull();
    });
  });

  // ── findAny ─────────────────────────────────────────────────────────────────

  describe('findAny', () => {
    it('returns row regardless of active flag', async () => {
      const inactiveRow = makeRow({ active: false });
      client.docenteXMateriaCarrera.findFirst.mockResolvedValue(inactiveRow);
      const result = await repo.findAny('user-1', 'materia-1', '2026');
      expect(result).toBeInstanceOf(DocenteXMateriaCarrera);
      expect(result!.active).toBe(false);
      expect(client.docenteXMateriaCarrera.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', materiaCarreraId: 'materia-1', anioAcademico: '2026' },
      });
    });

    it('returns null when not found', async () => {
      const result = await repo.findAny('user-x', 'materia-x', '2026');
      expect(result).toBeNull();
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns entity when found', async () => {
      client.docenteXMateriaCarrera.findUnique.mockResolvedValue(makeRow());
      const result = await repo.findById('dxmc-1');
      expect(result).toBeInstanceOf(DocenteXMateriaCarrera);
      expect(result!.id).toBe('dxmc-1');
    });

    it('returns null when not found', async () => {
      const result = await repo.findById('nope');
      expect(result).toBeNull();
    });
  });

  // ── listByMateria ────────────────────────────────────────────────────────────

  describe('listByMateria', () => {
    it('filters active=true', async () => {
      client.docenteXMateriaCarrera.findMany.mockResolvedValue([makeRow()]);
      const result = await repo.listByMateria('materia-1');
      expect(result).toHaveLength(1);
      expect(client.docenteXMateriaCarrera.findMany).toHaveBeenCalledWith({
        where: { materiaCarreraId: 'materia-1', active: true },
      });
    });

    it('also filters by anioAcademico when supplied (SPEC-4.3)', async () => {
      client.docenteXMateriaCarrera.findMany.mockResolvedValue([makeRow()]);
      await repo.listByMateria('materia-1', '2026');
      expect(client.docenteXMateriaCarrera.findMany).toHaveBeenCalledWith({
        where: { materiaCarreraId: 'materia-1', anioAcademico: '2026', active: true },
      });
    });
  });

  // ── listByDocente ────────────────────────────────────────────────────────────

  describe('listByDocente', () => {
    it('filters active=true (SPEC-4.4)', async () => {
      client.docenteXMateriaCarrera.findMany.mockResolvedValue([makeRow()]);
      const result = await repo.listByDocente('user-1');
      expect(result).toHaveLength(1);
      expect(client.docenteXMateriaCarrera.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', active: true },
      });
    });
  });

  // ── save ────────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('calls upsert with correct shape', async () => {
      const entity = DocenteXMateriaCarrera.create({
        userId: 'user-1',
        materiaCarreraId: 'materia-1',
        anioAcademico: '2026',
      });
      await repo.save(entity);
      expect(client.docenteXMateriaCarrera.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: entity.id },
          create: expect.objectContaining({
            id: entity.id,
            userId: 'user-1',
            materiaCarreraId: 'materia-1',
            anioAcademico: '2026',
            active: true,
          }),
          update: expect.objectContaining({
            active: entity.active,
            updatedAt: entity.updatedAt,
          }),
        }),
      );
    });
  });
});
