import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetMeUseCase, DeleteInstitutionUseCase } from '../use-cases/institution.use-cases';
import { Institution } from '@educandow/domain';

// Helper: create a mock Institution with all 25 fields
function makeMockInstitution(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: { get: () => 'inst-001' },
    name: 'Escuela Test',
    cue: { get: () => 'ABC123' },
    ministryReg: 'MIN-001',
    address: 'Calle Falsa 123',
    city: 'Buenos Aires',
    postalCode: 'C1425',
    country: 'AR',
    phone: '5411123456',
    website: 'https://escuela.edu.ar',
    contactEmail: 'info@escuela.edu.ar',
    logoUrl: 'https://cdn.example.com/logo.png',
    headerColor: { get: () => '#1a56db' },
    headerTextColor: { get: () => '#ffffff' },
    bodyTextColor: { get: () => '#333333' },
    smtpHost: 'smtp.gmail.com',
    smtpUser: 'notifications@school.edu',
    smtpPass: 'secret-smtp-password',
    smtpEncryption: 'TLS',
    smtpPort: 587,
    sendEmail: true,
    sendMessages: false,
    socketHost: 'ws.school.edu',
    socketPort: 8080,
    active: true,
    dbName: 'educandow_inst-001',
    levels: [{ toString: () => 'INICIAL' }, { toString: () => 'PRIMARIO' }],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    ...overrides,
  } as unknown as Institution;
}

const mockRepo = {
  findById: vi.fn(),
  findAll: vi.fn(),
  findByCue: vi.fn(),
  findByDbName: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  softDelete: vi.fn(),
  existsByName: vi.fn(),
};

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetMeUseCase(mockRepo as any);
  });

  it('returns institution config when institutionId is valid', async () => {
    const inst = makeMockInstitution();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute('inst-001');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const i = result.unwrap();
      expect(i.name).toBe('Escuela Test');
      expect(i.smtpHost).toBe('smtp.gmail.com');
      expect(i.active).toBe(true);
      expect(i.levels.length).toBe(2);
      // smtpPass is still in the entity (domain object), stripping is done at controller level
    }
  });

  it('returns NotFoundError when institutionId is null', async () => {
    const result = await useCase.execute(null);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('not found');
  });

  it('returns NotFoundError when institutionId is undefined', async () => {
    const result = await useCase.execute(undefined);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('not found');
  });

  it('returns NotFoundError when institution does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('not found');
  });

  it('includes all 25 fields in the returned entity', async () => {
    const inst = makeMockInstitution();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute('inst-001');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const i = result.unwrap();
      expect(i.name).toBeDefined();
      expect(i.cue).toBeDefined();
      expect(i.ministryReg).toBeDefined();
      expect(i.address).toBeDefined();
      expect(i.city).toBeDefined();
      expect(i.postalCode).toBeDefined();
      expect(i.country).toBeDefined();
      expect(i.phone).toBeDefined();
      expect(i.website).toBeDefined();
      expect(i.contactEmail).toBeDefined();
      expect(i.logoUrl).toBeDefined();
      expect(i.headerColor).toBeDefined();
      expect(i.headerTextColor).toBeDefined();
      expect(i.bodyTextColor).toBeDefined();
      expect(i.smtpHost).toBeDefined();
      expect(i.smtpUser).toBeDefined();
      expect(i.smtpPass).toBeDefined(); // domain entity has it
      expect(i.smtpEncryption).toBeDefined();
      expect(i.smtpPort).toBeDefined();
      expect(i.sendEmail).toBeDefined();
      expect(i.sendMessages).toBeDefined();
      expect(i.socketHost).toBeDefined();
      expect(i.socketPort).toBeDefined();
      expect(i.active).toBeDefined();
      expect(i.dbName).toBeDefined();
      expect(i.levels).toBeDefined();
    }
  });
});

describe('DeleteInstitutionUseCase', () => {
  let useCase: DeleteInstitutionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new DeleteInstitutionUseCase(mockRepo as any);
  });

  it('uses softDelete (not hard delete) to deactivate the institution', async () => {
    const inst = makeMockInstitution();
    mockRepo.findById.mockResolvedValue(inst);
    mockRepo.softDelete.mockResolvedValue(undefined);

    await useCase.execute('inst-001');

    expect(mockRepo.softDelete).toHaveBeenCalledWith('inst-001');
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('returns NotFoundError when institution does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('not found');
  });

  it('succeeds when institution already inactive (idempotent)', async () => {
    const inst = makeMockInstitution({ active: false });
    mockRepo.findById.mockResolvedValue(inst);
    mockRepo.softDelete.mockResolvedValue(undefined);

    const result = await useCase.execute('inst-001');
    expect(result.isOk()).toBe(true);
    expect(mockRepo.softDelete).toHaveBeenCalledWith('inst-001');
  });
});
