import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LevelType } from '@educandow/domain';

// ── TenantContext mock (must be before the repo import) ──────
vi.mock('../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue('inst-uuid-001'),
  },
}));

import { TenantContext } from '../../auth/tenant.context';
import { PrismaCourseSectionRepo } from '../prisma/repositories/prisma-course-section.repository';

// ── Helpers ──────────────────────────────────────────────────

function makeMockClient(row: Record<string, unknown> | null) {
  return {
    courseSection: {
      findUnique: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue(row ? [row] : []),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe('PrismaCourseSectionRepo — level normalization in toDomain', () => {
  let repo: PrismaCourseSectionRepo;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaCourseSectionRepo();
  });

  it('reconstructs composite level 20 (Primario+Común, seed/legacy data) without recomposing to 200', async () => {
    // Regression: toDomain called Level.fromParts(20, 0) → 20*10+0=200 → throws
    (TenantContext.getClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockClient({
        id: 'cs-primario-composite',
        name: '3° Grado A',
        grade: '3',
        division: 'A',
        level: 20,    // composite stored by seed data (Primario=2, Común=0 → 20)
        modality: 0,
        academicYear: '2026',
      }),
    );

    const result = await repo.findById('cs-primario-composite');

    expect(result).not.toBeNull();
    expect(result!.level.get()).toBe(LevelType.PRIMARIO); // 20 — NOT 200
  });

  it('reconstructs base code 2 (Primario, API-saved data) correctly', async () => {
    // API save() stores levelCode (base=2) + modality (0) separately
    (TenantContext.getClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockClient({
        id: 'cs-primario-base',
        name: '1° Grado B',
        grade: '1',
        division: 'B',
        level: 2,    // base code stored by the save() method
        modality: 0,
        academicYear: '2026',
      }),
    );

    const result = await repo.findById('cs-primario-base');

    expect(result).not.toBeNull();
    expect(result!.level.get()).toBe(LevelType.PRIMARIO); // 20
  });

  it('reconstructs composite level 30 (Secundario+Común, seed/legacy) correctly', async () => {
    (TenantContext.getClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockClient({
        id: 'cs-secundario-composite',
        name: '1° Año A',
        grade: '1',
        division: 'A',
        level: 30,    // composite: Secundario+Común
        modality: 0,
        academicYear: '2026',
      }),
    );

    const result = await repo.findById('cs-secundario-composite');

    expect(result).not.toBeNull();
    expect(result!.level.get()).toBe(LevelType.SECUNDARIO); // 30
  });

  it('returns null when section does not exist', async () => {
    (TenantContext.getClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockClient(null),
    );

    const result = await repo.findById('cs-nonexistent');

    expect(result).toBeNull();
  });
});
