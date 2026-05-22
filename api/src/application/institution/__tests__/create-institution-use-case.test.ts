import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateInstitutionUseCase, CreateInstitutionInput } from '../use-cases/institution.use-cases';

// Mock repository
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

describe('CreateInstitutionUseCase', () => {
  let useCase: CreateInstitutionUseCase;

  const validInput: CreateInstitutionInput = {
    name: 'Escuela Nueva',
    levels: ['INICIAL', 'PRIMARIO'],
    country: 'AR',
    header_color: '#1a56db',
    header_text_color: '#ffffff',
    body_text_color: '#333333',
    smtp_host: 'smtp.gmail.com',
    smtp_user: 'notifications@school.edu',
    smtp_pass: 'secure-password',
    smtp_encryption: 'TLS',
    smtp_port: 587,
    logo_url: 'https://cdn.example.com/logo.png',
    send_email: true,
    send_messages: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateInstitutionUseCase(mockRepo as any);
  });

  it('creates institution with valid SMTP + branding config', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const inst = result.unwrap();
      expect(inst.name).toBe('Escuela Nueva');
      expect(inst.smtpHost).toBe('smtp.gmail.com');
      expect(inst.smtpPort).toBe(587);
      expect(inst.headerColor?.get()).toBe('#1a56db');
    }
  });

  it('rejects duplicate institution name', async () => {
    mockRepo.existsByName.mockResolvedValue(true);

    const result = await useCase.execute(validInput);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('Ya existe');
  });

  it('rejects duplicate CUE', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue({ id: 'existing' });

    const result = await useCase.execute({
      ...validInput,
      cue: 'ABC123',
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('CUE');
  });

  it('rejects invalid SMTP encryption', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);

    const result = await useCase.execute({
      ...validInput,
      smtp_encryption: 'STARTTLS',
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('SMTP encryption');
  });

  it('rejects invalid SMTP port (out of range)', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);

    const result = await useCase.execute({
      ...validInput,
      smtp_port: 0,
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('SMTP port');
  });

  it('creates institution with minimal fields (name + levels)', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      name: 'Minimal School',
      levels: ['INICIAL'],
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const inst = result.unwrap();
      expect(inst.active).toBe(true);
      expect(inst.sendEmail).toBe(false);
      expect(inst.country).toBe('AR');
    }
  });

  it('rejects empty levels array', async () => {
    mockRepo.existsByName.mockResolvedValue(false);

    const result = await useCase.execute({
      name: 'No Levels School',
      levels: [],
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toContain('nivel');
  });

  it('generates dbName automatically', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);

    const result = await useCase.execute(validInput);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const inst = result.unwrap();
      expect(inst.dbName).toContain('educandow_');
    }
  });

  it('accepts valid smtp_encryption NONE', async () => {
    mockRepo.existsByName.mockResolvedValue(false);
    mockRepo.findByCue.mockResolvedValue(null);
    mockRepo.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      ...validInput,
      smtp_encryption: 'NONE',
    });
    expect(result.isOk()).toBe(true);
  });
});
