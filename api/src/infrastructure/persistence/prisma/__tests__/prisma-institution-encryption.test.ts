import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock Prisma client and encryption service
const mockPrismaInstitution = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findFirst: vi.fn(),
};

const mockClient = {
  institution: mockPrismaInstitution,
  institutionLevel: {
    deleteMany: vi.fn(),
  },
};

const mockPrismaService = {
  getMasterClient: vi.fn().mockReturnValue(mockClient),
};

// Mock process.env
const ENCRYPTION_KEY = 'abcdefghijklmnopqrstuvwx12345678';
const originalEnv = { ...process.env };

describe('PrismaInstitutionRepository — SMTP encryption roundtrip', () => {
  let repository: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Set encryption key
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;

    // Dynamic import to ensure fresh module with correct env
    const mod = await import('../repositories/prisma-institution.repository');
    const RepoClass = mod.PrismaInstitutionRepository;
    repository = new RepoClass(mockPrismaService as any);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('encrypts smtp_pass when saving (ciphertext ≠ plaintext)', async () => {
    let savedSmtpPass: any;
    mockPrismaInstitution.upsert.mockImplementation(async (args: any) => {
      savedSmtpPass = args.create.smtpPass ?? args.update.smtpPass;
      return { ...args.create, id: 'inst-1' };
    });

    const { Institution } = await import('@educandow/domain');
    const { EducationalLevelCode, EducationalModalityCode } = await import('@educandow/domain');
    const inst = Institution.create({
      name: 'Test School',
      smtpPass: 'my-plain-password',
      institutionLevels: [{ level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN }],
    });

    await repository.save(inst);

    expect(savedSmtpPass).toBeDefined();
    expect(savedSmtpPass).not.toBe('my-plain-password');
    expect(savedSmtpPass.length).toBeGreaterThan(0);
  });

  it('decrypts smtp_pass when reading from DB', async () => {
    const { Institution } = await import('@educandow/domain');

    // First encrypt manually to get a known ciphertext
    const { EncryptionService } = await import('../../../crypto/encryption.service');
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8');
    const encryptedPass = EncryptionService.encrypt('decrypt-me', key);

    const dbRecord = {
      id: 'inst-2',
      name: 'Decrypt School',
      cue: null,
      ministryReg: null,
      address: null,
      city: null,
      postalCode: null,
      country: 'AR',
      phone: null,
      website: null,
      contactEmail: null,
      logoUrl: null,
      headerColor: null,
      headerTextColor: null,
      bodyTextColor: null,
      smtpHost: 'smtp.test.com',
      smtpUser: 'user@test.com',
      smtpPass: encryptedPass,
      smtpEncryption: 'TLS',
      smtpPort: 587,
      sendEmail: false,
      sendMessages: false,
      socketHost: null,
      socketPort: null,
      active: true,
      dbName: 'educandow_inst-2',
      levels: [{ level: 1, modality: 0 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaInstitution.findUnique.mockResolvedValue(dbRecord);

    const institution = await repository.findById('inst-2');
    expect(institution).not.toBeNull();
    expect(institution.smtpPass).toBe('decrypt-me');
  });

  it('decrypted smtpPass matches original after save → read roundtrip', async () => {
    const originalPassword = 'roundtrip-secret-456';

    // Capture what gets saved (flatten the Prisma nested write)
    let savedRecord: any;
    mockPrismaInstitution.upsert.mockImplementation(async (args: any) => {
      const flatLevels = args.create.levels?.create ?? [];
      savedRecord = { ...args.create, id: args.create.id ?? 'inst-3', levels: flatLevels };
      return savedRecord;
    });

    // Mock findUnique to return the saved record
    mockPrismaInstitution.findUnique.mockImplementation(async () => savedRecord);

    const { Institution } = await import('@educandow/domain');
    const { EducationalLevelCode, EducationalModalityCode } = await import('@educandow/domain');
    const inst = Institution.create({
      name: 'Roundtrip School',
      smtpPass: originalPassword,
      institutionLevels: [{ level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN }],
    });

    await repository.save(inst);

    const readBack = await repository.findById('inst-3');
    expect(readBack).not.toBeNull();
    expect(readBack.smtpPass).toBe(originalPassword);
  });

  it('handles null smtp_pass gracefully', async () => {
    mockPrismaInstitution.upsert.mockImplementation(async (args: any) => {
      return { ...args.create, id: 'inst-4' };
    });

    const { Institution } = await import('@educandow/domain');
    const { EducationalLevelCode, EducationalModalityCode } = await import('@educandow/domain');
    const inst = Institution.create({
      name: 'No SMTP School',
      institutionLevels: [{ level: EducationalLevelCode.INICIAL, modality: EducationalModalityCode.COMUN }],
    });

    await repository.save(inst);

    // Should not throw
    expect(true).toBe(true);
  });
});
