/**
 * GenerateAttendanceTypesPdfUseCase — unit tests (PR4, T21 — RED).
 *
 * Pattern mirrors generate-asistencia-mensual-pdf.use-case.test.ts: mocked
 * TenantContext + mocked PrismaService/PdfGeneratorService/repo, no NestJS, no DB,
 * no Puppeteer. Applies EXACTLY the same scope as ListAttendanceTypesUseCase
 * (design.md §4.3 / ADD-3.1–ADD-3.4): reuses resolveAccessScope, does NOT
 * reimplement the modality-collapse logic.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { AttendanceTypeLevelOutOfScopeError } from '@educandow/domain';
import { AttendanceType, AttendanceTypeCode, AttendanceBehavior, AttendanceBehaviorValue } from '@educandow/domain';

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn(),
  },
}));

import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GenerateAttendanceTypesPdfUseCase: any;
beforeAll(async () => {
  const mod = await import('../use-cases/generate-attendance-types-pdf.use-case');
  GenerateAttendanceTypesPdfUseCase = mod.GenerateAttendanceTypesPdfUseCase;
});

// ── Current-user fixtures (same shape as attendance-type.use-cases.test.ts) ──

const rootUser = { roles: ['ROOT'] };
const teacherLevel2 = { roles: ['TEACHER'], levels: [20] };
const teacherLevels2And3 = { roles: ['TEACHER'], levels: [20, 21, 30] };

function makeEntity(overrides: { id?: string; level?: number; code?: string } = {}) {
  return AttendanceType.reconstruct({
    id: overrides.id ?? 'at-1',
    code: AttendanceTypeCode.reconstruct(overrides.code ?? 'P'),
    description: 'Presente',
    absenceValue: 0,
    level: overrides.level ?? 2,
    behavior: AttendanceBehavior.reconstruct(AttendanceBehaviorValue.NO_COMPUTA),
    isSystem: false,
    active: true,
  });
}

function makeUC({
  types = [makeEntity()],
  institution = { name: 'Escuela Test', logoUrl: null },
}: {
  types?: AttendanceType[];
  institution?: { name: string; logoUrl: string | null } | null;
} = {}) {
  vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-1');

  const repo = {
    findById: vi.fn(),
    findByLevelCode: vi.fn(),
    list: vi.fn().mockResolvedValue(types),
    save: vi.fn(),
    delete: vi.fn(),
    existsByLevelCode: vi.fn(),
  };
  const pdfGenerator = {
    generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')),
  };
  const prisma = {
    getMasterClient: vi.fn().mockReturnValue({
      institution: { findUnique: vi.fn().mockResolvedValue(institution) },
    }),
  };

  const uc = new GenerateAttendanceTypesPdfUseCase(pdfGenerator, prisma, repo);
  return { uc, repo, pdfGenerator, prisma };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GenerateAttendanceTypesPdfUseCase — scope (mirrors ListAttendanceTypesUseCase)', () => {
  it('docente con un nivel base: repo.list se llama con allowedLevels=[base]', async () => {
    const { uc, repo } = makeUC();

    await uc.execute({ currentUser: teacherLevel2 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ allowedLevels: [2] }));
  });

  it('docente con multi-nivel: allowedLevels es la unión de niveles base', async () => {
    const { uc, repo } = makeUC();

    await uc.execute({ currentUser: teacherLevels2And3 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ allowedLevels: [2, 3] }));
  });

  it('ROOT/ADMIN: repo.list se llama SIN allowedLevels', async () => {
    const { uc, repo } = makeUC();

    await uc.execute({ currentUser: rootUser });

    const callArg = repo.list.mock.calls[0][0];
    expect(callArg?.allowedLevels).toBeUndefined();
  });

  it('level explícito fuera de scope: lanza AttendanceTypeLevelOutOfScopeError y NUNCA llama generatePdf', async () => {
    const { uc, repo, pdfGenerator } = makeUC();

    await expect(uc.execute({ level: 3, currentUser: teacherLevel2 })).rejects.toBeInstanceOf(
      AttendanceTypeLevelOutOfScopeError,
    );

    expect(repo.list).not.toHaveBeenCalled();
    expect(pdfGenerator.generatePdf).not.toHaveBeenCalled();
  });

  it('level explícito dentro de scope: no lanza y filtra por ese nivel', async () => {
    const { uc, repo } = makeUC();

    await uc.execute({ level: 2, currentUser: teacherLevel2 });

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ level: 2, allowedLevels: [2] }),
    );
  });

  it('active se propaga a los filtros del repo igual que el listado', async () => {
    const { uc, repo } = makeUC();

    await uc.execute({ active: false, currentUser: rootUser });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });
});

describe('GenerateAttendanceTypesPdfUseCase — render pipeline', () => {
  it('llama pdfGenerator.generatePdf(html) exactamente una vez, sin landscape (portrait A4 por defecto)', async () => {
    const { uc, pdfGenerator } = makeUC();

    await uc.execute({ currentUser: rootUser });

    expect(pdfGenerator.generatePdf).toHaveBeenCalledTimes(1);
    const [html, options] = pdfGenerator.generatePdf.mock.calls[0];
    expect(typeof html).toBe('string');
    expect(options).toBeUndefined();
  });

  it('arma el view-model esperado: filas mapeadas desde los AttendanceType retornados por el repo', async () => {
    const types = [
      makeEntity({ id: 'a1', code: 'P', level: 2 }),
      makeEntity({ id: 'a2', code: 'T', level: 2 }),
    ];
    const { uc, pdfGenerator } = makeUC({ types });

    await uc.execute({ currentUser: rootUser });

    const [html] = pdfGenerator.generatePdf.mock.calls[0];
    expect(html).toContain('P');
    expect(html).toContain('T');
  });

  it('resuelve institución/logo igual que generate-asistencia-mensual-pdf.use-case (resolveInstitution)', async () => {
    const { uc, prisma } = makeUC({ institution: { name: 'Mi Escuela', logoUrl: null } });

    await uc.execute({ currentUser: rootUser });

    expect(prisma.getMasterClient).toHaveBeenCalled();
  });

  it('retorna el Buffer producido por pdfGenerator.generatePdf', async () => {
    const { uc, pdfGenerator } = makeUC();
    pdfGenerator.generatePdf.mockResolvedValue(Buffer.from('MY-PDF'));

    const result = await uc.execute({ currentUser: rootUser });

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('MY-PDF');
  });
});
