import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshTokenUseCase } from '../refresh-token.use-case';
import type { RefreshTokenRepository } from '@educandow/domain';
import type { UserRepository } from '@educandow/domain';
import type { AuthPort } from '../../ports/auth-port';
import { EducationalLevelCode } from '@educandow/domain';
import { EducationalModalityCode } from '@educandow/domain';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let mockRefreshTokenRepo: RefreshTokenRepository;
  let mockUserRepo: UserRepository;
  let mockAuthPort: AuthPort;

  const validToken = 'valid-refresh-token';
  const userId = 'user-123';
  const futureDate = new Date(Date.now() + 86400000); // 1 day ahead

  beforeEach(() => {
    mockRefreshTokenRepo = {
      findByToken: vi.fn(),
      create: vi.fn(),
      deleteByToken: vi.fn(),
      deleteAllForUser: vi.fn(),
    };

    mockUserRepo = {
      existsByEmail: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
    };

    mockAuthPort = {
      sign: vi.fn((_payload) => 'signed.jwt.token'),
      verify: vi.fn(),
    };

    useCase = new RefreshTokenUseCase(
      mockRefreshTokenRepo,
      mockUserRepo,
      mockAuthPort,
    );
  });

  // ── Helpers ──────────────────────────────────────────────────
  function setupValidRefresh() {
    (mockRefreshTokenRepo.findByToken as any).mockResolvedValue({
      userId,
      expiresAt: futureDate,
    });

    const mockUser = {
      id: { get: () => userId },
      roles: ['TEACHER'],
      modules: [{ moduleCode: 'CLASSROOMS', actions: ['READ'] }],
      institutionId: 'inst-1',
      levels: [
        { level: EducationalLevelCode.PRIMARIO, modality: EducationalModalityCode.COMUN },
        { level: EducationalLevelCode.SECUNDARIO, modality: EducationalModalityCode.TALLERES },
      ],
    };

    (mockUserRepo.findById as any).mockResolvedValue(mockUser);
  }

  // ── Verification Test ────────────────────────────────────────
  it('should include levels and userLevels in the new JWT after refresh', async () => {
    // GIVEN a valid refresh token pointing to a user with levels
    setupValidRefresh();

    // WHEN the refresh token use case executes
    const result = await useCase.execute(validToken);

    // THEN the result is ok
    expect(result.isOk()).toBe(true);
    const { accessToken } = result.unwrap();
    expect(accessToken).toBe('signed.jwt.token');

    // AND jwtAuthPort.sign was called
    expect(mockAuthPort.sign).toHaveBeenCalledTimes(1);
    const signCallArgs = (mockAuthPort.sign as any).mock.calls[0][0];

    // THEN the JWT payload includes levels (computed as level*10 + modality)
    expect(signCallArgs.levels).toEqual([20, 31]); // 2*10+0=20, 3*10+1=31
    expect(signCallArgs.userLevels).toEqual([
      { level: 2, modality: 0 },
      { level: 3, modality: 1 },
    ]);

    // THEN standard fields are also present
    expect(signCallArgs.sub).toBe(userId);
    expect(signCallArgs.roles).toEqual(['TEACHER']);
    expect(signCallArgs.modules).toEqual([{ moduleCode: 'CLASSROOMS', actions: ['READ'] }]);
    expect(signCallArgs.institutionId).toBe('inst-1');
    expect(signCallArgs.dbName).toBeNull();
  });

  // ── Null levels case ─────────────────────────────────────────
  it('should handle users with no levels (empty array)', async () => {
    // GIVEN a user with no levels assigned
    (mockRefreshTokenRepo.findByToken as any).mockResolvedValue({
      userId,
      expiresAt: futureDate,
    });

    const mockUser = {
      id: { get: () => userId },
      roles: ['TEACHER'],
      modules: [],
      institutionId: 'inst-1',
      levels: [],
    };

    (mockUserRepo.findById as any).mockResolvedValue(mockUser);

    // WHEN the refresh executes
    const result = await useCase.execute(validToken);

    // THEN it succeeds with empty levels array
    expect(result.isOk()).toBe(true);
    const signCallArgs = (mockAuthPort.sign as any).mock.calls[0][0];
    expect(signCallArgs.levels).toEqual([]);
    expect(signCallArgs.userLevels).toEqual([]);
  });

  // ── Invalid token ────────────────────────────────────────────
  it('should return error for expired refresh token', async () => {
    (mockRefreshTokenRepo.findByToken as any).mockResolvedValue({
      userId,
      expiresAt: new Date(Date.now() - 1000), // in the past
    });

    const result = await useCase.execute(validToken);

    expect(result.isErr()).toBe(true);
    expect(mockAuthPort.sign).not.toHaveBeenCalled();
  });

  // ── User not found ──────────────────────────────────────────
  it('should return error when user not found', async () => {
    (mockRefreshTokenRepo.findByToken as any).mockResolvedValue({
      userId,
      expiresAt: futureDate,
    });
    (mockUserRepo.findById as any).mockResolvedValue(null);

    const result = await useCase.execute(validToken);

    expect(result.isErr()).toBe(true);
    expect(mockAuthPort.sign).not.toHaveBeenCalled();
  });
});
