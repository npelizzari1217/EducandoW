import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Mock bcrypt and crypto for deterministic tests
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('abcdefghijklmnop'), // 16 chars
    }),
  };
});

const mockMasterClient = {
  user: {
    create: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
  },
};

let CreateInstitutionAdminUseCase: typeof import('../create-institution-admin.use-case').CreateInstitutionAdminUseCase;

beforeAll(async () => {
  ({ CreateInstitutionAdminUseCase } = await import('../create-institution-admin.use-case'));
});

describe('CreateInstitutionAdminUseCase', () => {
  let useCase: InstanceType<typeof CreateInstitutionAdminUseCase>;

  const defaultInput = {
    adminEmail: 'admin@school.edu',
    dbName: 'educandow_test123',
    institutionId: 'inst-uuid-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — partial mock
    useCase = new CreateInstitutionAdminUseCase(mockMasterClient);
  });

  describe('happy path', () => {
    it('generates a random password and hashes it', async () => {
      const bcrypt = await import('bcrypt');
      (bcrypt.default.hash as any).mockResolvedValue('$2b$12$hashedpassword');

      mockMasterClient.user.create.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'admin@school.edu',
        institutionId: 'inst-uuid-1',
        name: 'Administrador',
      });

      const result = await useCase.execute(defaultInput);

      // Verify crypto generated random bytes
      const cryptoModule = await import('crypto');
      expect(cryptoModule.randomBytes).toHaveBeenCalledWith(8);

      // Verify bcrypt was called with the generated password
      expect(bcrypt.default.hash).toHaveBeenCalledWith('abcdefghijklmnop', 12);

      // Verify the master client was called correctly
      expect(mockMasterClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'admin@school.edu',
          passwordHash: '$2b$12$hashedpassword',
          institutionId: 'inst-uuid-1',
          name: 'Administrador',
        }),
      });

      // Verify the returned credentials
      expect(result).toEqual({
        email: 'admin@school.edu',
        password: 'abcdefghijklmnop',
      });
    });

    it('creates an ADMIN role assignment for the user', async () => {
      const bcrypt = await import('bcrypt');
      (bcrypt.default.hash as any).mockResolvedValue('$2b$12$hash');

      mockMasterClient.user.create.mockResolvedValue({
        id: 'user-uuid-2',
        email: 'admin@school.edu',
        institutionId: 'inst-uuid-1',
        name: 'Administrador',
      });

      mockMasterClient.userRole.create.mockResolvedValue({});

      await useCase.execute(defaultInput);

      expect(mockMasterClient.userRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: 'user-uuid-2' } },
          role: { connect: { name: 'ADMIN' } },
        }),
      });
    });
  });

  describe('error handling', () => {
    it('throws when user creation fails', async () => {
      const bcrypt = await import('bcrypt');
      (bcrypt.default.hash as any).mockResolvedValue('$2b$12$hash');

      mockMasterClient.user.create.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(defaultInput)).rejects.toThrow('DB error');
    });

    it('throws when password hashing fails', async () => {
      const bcrypt = await import('bcrypt');
      (bcrypt.default.hash as any).mockRejectedValue(new Error('bcrypt error'));

      await expect(useCase.execute(defaultInput)).rejects.toThrow('bcrypt error');
    });
  });
});
