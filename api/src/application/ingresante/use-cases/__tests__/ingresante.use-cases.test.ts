import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateIngresanteUseCase,
  UpdateIngresanteStatusUseCase,
  ListIngresantesUseCase,
  PromoteIngresanteUseCase,
} from '../ingresante.use-cases';
import { ok, err, ValidationError, NotFoundError, EducationalLevelCode } from '@educandow/domain';
import type { IngresanteRepository, AcademicCycleRepository } from '@educandow/domain';
import { Ingresante, IngresanteStatus, Id, Level, LevelType } from '@educandow/domain';
import type { CreateStudentUseCase } from '../../../student/use-cases/student.use-cases';
import type { CreateEnrollmentUseCase } from '../../../enrollment/use-cases/enrollment.use-cases';
import type { TenantTransactionRunner } from '../../../shared/ports/tenant-transaction-runner';

// ── Helpers ─────────────────────────────────────────────────────────────────

const CYCLE_UUID = '00000000-0000-0000-0000-000000000001';
const STUDENT_UUID = '00000000-0000-0000-0000-000000000010';
const ENROLLMENT_UUID = '00000000-0000-0000-0000-000000000020';
const INGRESANTE_UUID = '00000000-0000-0000-0000-000000000030';

function makeIngresante(status: 'INSCRIPTO' | 'PAGO_MATRICULA' | 'ACEPTADO' | 'INGRESO' | 'NO_INGRESARA' = 'INSCRIPTO'): Ingresante {
  return Ingresante.reconstruct({
    id: Id.reconstruct(INGRESANTE_UUID),
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    level: Level.reconstruct(LevelType.PRIMARIO),
    status: IngresanteStatus.reconstruct(status),
    createdAt: new Date(),
  });
}

function makeIngresanteWithCycle(status: 'ACEPTADO' = 'ACEPTADO'): Ingresante {
  return Ingresante.reconstruct({
    id: Id.reconstruct(INGRESANTE_UUID),
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    level: Level.reconstruct(LevelType.PRIMARIO),
    status: IngresanteStatus.reconstruct(status),
    cycleId: Id.reconstruct(CYCLE_UUID),
    createdAt: new Date(),
  });
}

function makeMockIngresanteRepo(overrides: Partial<IngresanteRepository> = {}): IngresanteRepository {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByStatus: vi.fn(),
    findAll: vi.fn(),
    findByDni: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

function makeMockCycleRepo(overrides: Partial<AcademicCycleRepository> = {}): AcademicCycleRepository {
  return {
    findById: vi.fn(),
    findByUuid: vi.fn().mockResolvedValue(null),
    findByCode: vi.fn(),
    findActive: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    softDelete: vi.fn(),
    ...overrides,
  };
}

function makeMockStudentUC(studentId = STUDENT_UUID): CreateStudentUseCase {
  const mockStudent = { id: { get: () => studentId } };
  return {
    execute: vi.fn().mockResolvedValue(ok(mockStudent)),
  } as unknown as CreateStudentUseCase;
}

function makeMockEnrollmentUC(enrollmentId = ENROLLMENT_UUID): CreateEnrollmentUseCase {
  const mockEnrollment = { id: { get: () => enrollmentId } };
  return {
    execute: vi.fn().mockResolvedValue(ok(mockEnrollment)),
  } as unknown as CreateEnrollmentUseCase;
}

/** Passthrough runner: executes the work callback directly (no real transaction). */
function makeMockRunner(): TenantTransactionRunner {
  return {
    run: vi.fn().mockImplementation((work: () => Promise<unknown>) => work()),
  };
}

/** Builds a mock AcademicCycle whose level matches the given EducationalLevelCode. */
function makeMockCycle(levelCode: EducationalLevelCode = EducationalLevelCode.PRIMARIO) {
  return {
    startDate: new Date('2025-03-01'),
    level: { code: levelCode },
  };
}

// ── CreateIngresanteUseCase ───────────────────────────────────────────────────

describe('CreateIngresanteUseCase', () => {
  let repo: IngresanteRepository;
  let cycleRepo: AcademicCycleRepository;

  beforeEach(() => {
    repo = makeMockIngresanteRepo();
    cycleRepo = makeMockCycleRepo({
      findByUuid: vi.fn().mockResolvedValue(makeMockCycle(EducationalLevelCode.PRIMARIO)),
    });
  });

  it('creates an ingresante with status INSCRIPTO', async () => {
    const uc = new CreateIngresanteUseCase(repo, cycleRepo);
    const result = await uc.execute({
      firstName: 'María',
      lastName: 'González',
      dni: '87654321',
      level: 'PRIMARIO',
      cycleId: CYCLE_UUID,
    });

    expect(result.isOk()).toBe(true);
    const i = result.unwrap();
    expect(i.status.value).toBe('INSCRIPTO');
    expect(repo.save).toHaveBeenCalledWith(i);
  });

  it('sets all provided fields', async () => {
    // cycle repo returning SECUNDARIO to match the requested level
    const cycleRepoSec = makeMockCycleRepo({
      findByUuid: vi.fn().mockResolvedValue(makeMockCycle(EducationalLevelCode.SECUNDARIO)),
    });
    const uc = new CreateIngresanteUseCase(repo, cycleRepoSec);
    const result = await uc.execute({
      firstName: 'Carlos',
      lastName: 'López',
      dni: '11112222',
      birthDate: '2008-05-20',
      address: 'Av. Corrientes 1000',
      phone: '1155556666',
      email: 'carlos@example.com',
      cycleId: CYCLE_UUID,
      level: 'SECUNDARIO',
    });

    expect(result.isOk()).toBe(true);
    const i = result.unwrap();
    expect(i.firstName).toBe('Carlos');
    expect(i.lastName).toBe('López');
    expect(i.dni).toBe('11112222');
    expect(i.birthDate).toBeInstanceOf(Date);
    expect(i.address).toBe('Av. Corrientes 1000');
    expect(i.phone).toBe('1155556666');
    expect(i.email).toBe('carlos@example.com');
    expect(i.cycleId?.get()).toBe(CYCLE_UUID);
    expect(i.level.toString()).toBe('SECUNDARIO');
  });

  it('returns err when firstName is empty', async () => {
    const uc = new CreateIngresanteUseCase(repo, cycleRepo);
    const result = await uc.execute({ firstName: '', lastName: 'Test', dni: '12345678', level: 'PRIMARIO', cycleId: CYCLE_UUID });
    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns err when level is invalid', async () => {
    const uc = new CreateIngresanteUseCase(repo, cycleRepo);
    await expect(() =>
      uc.execute({ firstName: 'A', lastName: 'B', dni: '12345678', level: 'NOPE_INVALID_XYZ', cycleId: CYCLE_UUID }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  // ── B-3: cycleId required + level↔cycle coherence (RED) ──

  it('SC-CYC-01: returns err(ValidationError) when cycleId is missing', async () => {
    const uc = new CreateIngresanteUseCase(repo, cycleRepo);
    const result = await uc.execute({
      firstName: 'Ana',
      lastName: 'López',
      dni: '22222222',
      level: 'PRIMARIO',
      cycleId: '',
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('SC-CYC-05: returns err(ValidationError) when cycleId level does not match requested level', async () => {
    // cycleRepo returns a SECUNDARIO cycle but we request level=PRIMARIO
    const mismatchCycleRepo = makeMockCycleRepo({
      findByUuid: vi.fn().mockResolvedValue(makeMockCycle(EducationalLevelCode.SECUNDARIO)),
    });
    const uc = new CreateIngresanteUseCase(repo, mismatchCycleRepo);
    const result = await uc.execute({
      firstName: 'Ana',
      lastName: 'López',
      dni: '22222222',
      level: 'PRIMARIO',
      cycleId: CYCLE_UUID,
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) when cycle is not found', async () => {
    const notFoundCycleRepo = makeMockCycleRepo({
      findByUuid: vi.fn().mockResolvedValue(null),
    });
    const uc = new CreateIngresanteUseCase(repo, notFoundCycleRepo);
    const result = await uc.execute({
      firstName: 'Ana',
      lastName: 'López',
      dni: '22222222',
      level: 'PRIMARIO',
      cycleId: CYCLE_UUID,
    });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ── UpdateIngresanteStatusUseCase ─────────────────────────────────────────────

describe('UpdateIngresanteStatusUseCase', () => {
  let repo: IngresanteRepository;

  beforeEach(() => {
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('INSCRIPTO')),
    });
  });

  it('updates status to a valid value and saves', async () => {
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'PAGO_MATRICULA' });

    expect(result.isOk()).toBe(true);
    const i = result.unwrap();
    expect(i.status.value).toBe('PAGO_MATRICULA');
    expect(repo.save).toHaveBeenCalledWith(i);
  });

  it('updates to ACEPTADO (PAGO_MATRICULA → ACEPTADO is valid)', async () => {
    // Mock returns PAGO_MATRICULA so ACEPTADO is a valid next state
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('PAGO_MATRICULA')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'ACEPTADO' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status.value).toBe('ACEPTADO');
  });

  it('updates to NO_INGRESARA', async () => {
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'NO_INGRESARA' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status.value).toBe('NO_INGRESARA');
  });

  it('rejects setting INGRESO via this path', async () => {
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'INGRESO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('INGRESO');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid status string', async () => {
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'FANTASMA' });
    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns NotFoundError when ingresante does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'PAGO_MATRICULA' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── B-1: transition enforcement (RED) ───────────────────

  it('SC-SM-02: INSCRIPTO→ACEPTADO (skip) → err(ValidationError) with both states in message', async () => {
    // findById returns INSCRIPTO (default beforeEach)
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'ACEPTADO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('INSCRIPTO');
    expect(result.unwrapErr().message).toContain('ACEPTADO');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('SC-SM-03: PAGO_MATRICULA→INSCRIPTO (backward) → err(ValidationError)', async () => {
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('PAGO_MATRICULA')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'INSCRIPTO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('SC-SM-04: INGRESO→any (terminal) → err(ValidationError)', async () => {
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('INGRESO')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'INSCRIPTO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('SC-SM-05: NO_INGRESARA→any (terminal) → err(ValidationError)', async () => {
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('NO_INGRESARA')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'INSCRIPTO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('SC-SM-09: ACEPTADO→INGRESO via status-update → rejected by explicit guard (before transitionTo)', async () => {
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('ACEPTADO')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'INGRESO' });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('INGRESO');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('SC-SM-10: ACEPTADO→NO_INGRESARA from legacy record (reconstruct, D2 non-retroactive) → ok', async () => {
    // Legacy record reconstructed in ACEPTADO; future transitions must follow rules
    repo = makeMockIngresanteRepo({
      findById: vi.fn().mockResolvedValue(makeIngresante('ACEPTADO')),
    });
    const uc = new UpdateIngresanteStatusUseCase(repo);
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, status: 'NO_INGRESARA' });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status.value).toBe('NO_INGRESARA');
  });
});

// ── ListIngresantesUseCase ───────────────────────────────────────────────────

describe('ListIngresantesUseCase', () => {
  it('execute() returns all ingresantes', async () => {
    const list = [makeIngresante('INSCRIPTO'), makeIngresante('ACEPTADO')];
    const repo = makeMockIngresanteRepo({ findAll: vi.fn().mockResolvedValue(list) });
    const uc = new ListIngresantesUseCase(repo);
    const result = await uc.execute();
    expect(result).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalled();
  });

  it('executeByStatus() filters by status', async () => {
    const aceptados = [makeIngresante('ACEPTADO')];
    const repo = makeMockIngresanteRepo({ findByStatus: vi.fn().mockResolvedValue(aceptados) });
    const uc = new ListIngresantesUseCase(repo);
    const result = await uc.executeByStatus('ACEPTADO');
    expect(result).toHaveLength(1);
    expect(repo.findByStatus).toHaveBeenCalledWith('ACEPTADO');
  });
});

// ── PromoteIngresanteUseCase ─────────────────────────────────────────────────

describe('PromoteIngresanteUseCase', () => {
  const INSTITUTION_ID = '00000000-0000-0000-0000-000000000099';

  it('rejects promote when ingresante is not found', async () => {
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(null) });
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('rejects promote when ingresante status is not ACEPTADO', async () => {
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(makeIngresante('INSCRIPTO')) });
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(result.unwrapErr().message).toContain('ACEPTADO');
  });

  it('rejects promote when status is PAGO_MATRICULA', async () => {
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(makeIngresante('PAGO_MATRICULA')) });
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });
    expect(result.isErr()).toBe(true);
  });

  it('on ACEPTADO: creates student with ingresante data', async () => {
    const ingresante = makeIngresante('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const createStudentUC = makeMockStudentUC();
    const uc = new PromoteIngresanteUseCase(repo, createStudentUC, makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());

    await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(createStudentUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: ingresante.firstName,
        lastName: ingresante.lastName,
        dni: ingresante.dni,
        institutionId: INSTITUTION_ID,
      }),
    );
  });

  it('on ACEPTADO: creates enrollment with correct studentId and cycleId', async () => {
    const ingresante = makeIngresanteWithCycle('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const createEnrollmentUC = makeMockEnrollmentUC();
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), createEnrollmentUC, makeMockCycleRepo(), makeMockRunner());

    await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(createEnrollmentUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: STUDENT_UUID,
        cycleId: CYCLE_UUID,
        institutionId: INSTITUTION_ID,
        level: 'PRIMARIO',
      }),
    );
  });

  it('on ACEPTADO: academicYear derived from AcademicCycle startDate', async () => {
    const ingresante = makeIngresanteWithCycle('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });

    const mockCycle = { startDate: new Date('2025-03-01') };
    const cycleRepo = makeMockCycleRepo({
      findByUuid: vi.fn().mockResolvedValue(mockCycle),
    });

    const createEnrollmentUC = makeMockEnrollmentUC();
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), createEnrollmentUC, cycleRepo, makeMockRunner());

    await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(createEnrollmentUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ academicYear: '2025' }),
    );
  });

  it('on ACEPTADO: uses current year when no cycleId', async () => {
    const ingresante = makeIngresante('ACEPTADO'); // no cycleId
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const createEnrollmentUC = makeMockEnrollmentUC();
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), createEnrollmentUC, makeMockCycleRepo(), makeMockRunner());

    await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    const currentYear = String(new Date().getFullYear());
    expect(createEnrollmentUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ academicYear: currentYear }),
    );
  });

  it('on ACEPTADO: ingresante is saved with status INGRESO', async () => {
    const ingresante = makeIngresante('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());

    await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(repo.save).toHaveBeenCalledWith(ingresante);
    expect(ingresante.status.value).toBe('INGRESO');
  });

  it('on ACEPTADO: returns studentId and enrollmentId', async () => {
    const ingresante = makeIngresante('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());

    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ studentId: STUDENT_UUID, enrollmentId: ENROLLMENT_UUID });
  });

  it('SC-PRM-02: CreateStudentUseCase fails → repo.save not called, ingresante remains ACEPTADO', async () => {
    const ingresante = makeIngresante('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const createStudentUC = {
      execute: vi.fn().mockResolvedValue(err(new ValidationError('Ya existe un estudiante con ese DNI'))),
    } as unknown as CreateStudentUseCase;

    const uc = new PromoteIngresanteUseCase(repo, createStudentUC, makeMockEnrollmentUC(), makeMockCycleRepo(), makeMockRunner());
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
    expect(ingresante.status.value).toBe('ACEPTADO');
  });

  it('SC-PRM-03: CreateEnrollmentUseCase fails → repo.save not called, ingresante remains ACEPTADO', async () => {
    const ingresante = makeIngresante('ACEPTADO');
    const repo = makeMockIngresanteRepo({ findById: vi.fn().mockResolvedValue(ingresante) });
    const createEnrollmentUC = {
      execute: vi.fn().mockResolvedValue(err(new ValidationError('Enrollment failed'))),
    } as unknown as CreateEnrollmentUseCase;

    const uc = new PromoteIngresanteUseCase(repo, makeMockStudentUC(), createEnrollmentUC, makeMockCycleRepo(), makeMockRunner());
    const result = await uc.execute({ ingresanteId: INGRESANTE_UUID, institutionId: INSTITUTION_ID });

    expect(result.isErr()).toBe(true);
    expect(repo.save).not.toHaveBeenCalled();
    expect(ingresante.status.value).toBe('ACEPTADO');
  });
});
