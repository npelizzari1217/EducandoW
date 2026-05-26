import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateInstitutionUseCase, UpdateInstitutionInput } from '../use-cases/institution.use-cases';
import { Institution, ForbiddenError, NotFoundError } from '@educandow/domain';

function makeMockInst(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: { get: () => 'inst-001' },
    name: 'Escuela Test',
    cue: { get: () => 'ABC123' },
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
    smtpHost: null,
    smtpUser: null,
    smtpPass: null,
    smtpEncryption: null,
    smtpPort: null,
    sendEmail: false,
    sendMessages: false,
    socketHost: null,
    socketPort: null,
    active: true,
    dbName: 'educandow_inst-001',
    levels: [],
    institutionLevels: [],
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

describe('UpdateInstitutionUseCase — authorization', () => {
  let useCase: UpdateInstitutionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new UpdateInstitutionUseCase(mockRepo as any);
  });

  it('rejects admin editing a different institution (403)', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute('inst-001', { name: 'Hacked' }, {
      institutionId: 'inst-999',
      isRoot: false,
    });

    expect(result.isErr()).toBe(true);
    const errVal = result.unwrapErr();
    expect(errVal).toBeInstanceOf(ForbiddenError);
    expect(errVal.code).toBe('FORBIDDEN');
  });

  it('allows admin editing own institution', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);
    mockRepo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('inst-001', { phone: '555-1234' }, {
      institutionId: 'inst-001',
      isRoot: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap().phone).toBe('555-1234');
    }
  });

  it('rejects admin changing active field (403)', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute('inst-001', { active: false }, {
      institutionId: 'inst-001',
      isRoot: false,
    });

    expect(result.isErr()).toBe(true);
    const errVal = result.unwrapErr();
    expect(errVal).toBeInstanceOf(ForbiddenError);
    expect(errVal.code).toBe('FORBIDDEN');
  });

  it('allows ROOT to change active field', async () => {
    const inst = makeMockInst({ active: true });
    mockRepo.findById.mockResolvedValue(inst);
    mockRepo.update.mockResolvedValue(undefined);
    mockRepo.findByCue.mockResolvedValue(null);

    const result = await useCase.execute('inst-001', { active: false }, {
      institutionId: 'inst-999',
      isRoot: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap().active).toBe(false);
    }
  });

  it('returns NotFoundError for non-existent institution', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', { name: 'Nope' }, {
      institutionId: 'inst-001',
      isRoot: false,
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });
});
