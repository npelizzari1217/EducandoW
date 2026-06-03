import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to prevent hoisting conflicts
const { mockFindMany, mockUpsert } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn(),
    institution: {
      findMany: mockFindMany,
    },
    institutionLevel: {
      upsert: mockUpsert,
    },
  })),
}));

import { ensureInstitutionLevels } from '../../prisma/seed';

describe('ensureInstitutionLevels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when all active institutions already have levels', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    // Dynamic import to get mocked PrismaClient
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await ensureInstitutionLevels(prisma as any);

    // No upserts should be called
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts Primario Común level for institutions missing levels', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'inst-1' }, { id: 'inst-2' }]);
    mockUpsert.mockResolvedValue({});

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await ensureInstitutionLevels(prisma as any);

    // Should have called upsert for each missing institution
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    
    // Verify the first call used correct parameters
    const firstCall = mockUpsert.mock.calls[0][0];
    expect(firstCall.where).toEqual({
      institutionId_level_modality: {
        institutionId: 'inst-1',
        level: 2,
        modality: 0,
      },
    });
    expect(firstCall.create).toEqual({
      institutionId: 'inst-1',
      level: 2,
      modality: 0,
    });
    expect(firstCall.update).toEqual({});
  });

  it('uses idempotent upsert (update: {}) so re-runs do not fail', async () => {
    mockFindMany.mockResolvedValueOnce([{ id: 'inst-abc' }]);
    mockUpsert.mockResolvedValue({});

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await ensureInstitutionLevels(prisma as any);

    // Verify update is empty (no-op — idempotent)
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.update).toEqual({});
  });

  it('does not throw when findMany returns empty array', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await expect(ensureInstitutionLevels(prisma as any)).resolves.toBeUndefined();
  });
});
