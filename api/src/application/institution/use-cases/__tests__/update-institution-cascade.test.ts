/**
 * T2.9.2 — UpdateInstitutionUseCase cascade tests (RED → GREEN).
 * REQ-11 / ADR-03
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateInstitutionUseCase } from '../institution.use-cases';
import { Institution } from '@educandow/domain';

// ── Helpers ──────────────────────────────────────────────────

function makeMockInst(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: { get: () => 'inst-001' },
    name: 'Escuela Test',
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
    bodyColor: null,
    footerColor: null,
    footerTextColor: null,
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
    institutionLevels: [{ level: 2, modality: 0 }], // PRIMARIO
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    ...overrides,
  } as unknown as Institution;
}

// ── Mocks ────────────────────────────────────────────────────

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

const mockEnsureTypes = {
  ensure: vi.fn(),
};

// ─────────────────────────────────────────────────────────────

describe('UpdateInstitutionUseCase — cascade: EnsureAttendanceTypes', () => {
  let useCase: UpdateInstitutionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.update.mockResolvedValue(undefined);
    mockEnsureTypes.ensure.mockResolvedValue(undefined);
    useCase = new UpdateInstitutionUseCase(mockRepo as any, mockEnsureTypes as any);
  });

  it('calls ensureTypes.ensure after update when institution_levels are provided — REQ-11/Escenario 11.1', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);

    const result = await useCase.execute(
      'inst-001',
      {
        institution_levels: [
          { level: 'PRIMARIO', modality: 'COMUN' },
          { level: 'SECUNDARIO', modality: 'COMUN' },
        ],
      },
      { institutionId: 'inst-001', isRoot: false },
    );

    expect(result.isOk()).toBe(true);
    expect(mockEnsureTypes.ensure).toHaveBeenCalledTimes(1);
    const [dbName, levels] = mockEnsureTypes.ensure.mock.calls[0];
    expect(dbName).toBe('educandow_inst-001');
    expect(levels).toContain(2); // PRIMARIO
    expect(levels).toContain(3); // SECUNDARIO
  });

  it('calls ensureTypes.ensure even when levels are not explicitly changed (idempotent best-effort) — REQ-11/Escenario 11.2', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);

    // Update without changing levels
    const result = await useCase.execute(
      'inst-001',
      { address: 'Nueva Dirección 123' },
      { institutionId: 'inst-001', isRoot: false },
    );

    expect(result.isOk()).toBe(true);
    // Best-effort: called with existing levels
    expect(mockEnsureTypes.ensure).toHaveBeenCalledTimes(1);
  });

  it('logs error and returns ok when ensureTypes.ensure throws — ADR-03 best-effort', async () => {
    const inst = makeMockInst();
    mockRepo.findById.mockResolvedValue(inst);
    mockEnsureTypes.ensure.mockRejectedValue(new Error('Cascade failed'));

    const result = await useCase.execute(
      'inst-001',
      { address: 'Nueva Dirección 456' },
      { institutionId: 'inst-001', isRoot: false },
    );

    // Update must succeed even if cascade fails (best-effort)
    expect(result.isOk()).toBe(true);
    // The error is swallowed / logged but not propagated
  });
});
