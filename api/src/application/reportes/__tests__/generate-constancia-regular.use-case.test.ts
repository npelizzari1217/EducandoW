import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateConstanciaRegularUseCase } from '../generate-constancia-regular.use-case';
import { ConstanciaError } from '../templates/constancia.template';
import { TenantContext } from '../../../infrastructure/auth/tenant.context';

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('../../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
    getInstitutionId: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../../../infrastructure/reporting/resolve-logo-data-uri', () => ({
  resolveLogoDataUri: vi.fn().mockResolvedValue(null),
}));

// ── Factories ───────────────────────────────────────────────────────────────

function makePdfGenerator() {
  return { generatePdf: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
}

// When called with no argument → returns a non-null institution (happy-path default).
// When called with null explicitly → findUnique returns null (fix-3: missing institution).
// When called with an object → findUnique returns that object (custom institution data).
function makePrisma(institutionOverride?: object | null) {
  const findUniqueResult =
    institutionOverride === undefined
      ? {
          id: 'inst-1',
          name: 'Escuela Test',
          cue: '123456',
          city: 'Buenos Aires',
          province: 'Buenos Aires',
          logoUrl: null,
        }
      : institutionOverride; // null → findUnique returns null; object → custom data

  return {
    getMasterClient: vi.fn().mockReturnValue({
      institution: {
        findUnique: vi.fn().mockResolvedValue(findUniqueResult),
      },
    }),
  };
}

function makeTenantClient(overrides: {
  axcc?: object | null;
  student?: object | null;
  courseCycle?: object | null;
} = {}) {
  const axcc =
    overrides.axcc !== undefined
      ? overrides.axcc
      : {
          id: 'axcc-1',
          studentId: 'stu-1',
          courseCycleId: 'cc-uuid-1',
        };

  const student =
    overrides.student !== undefined
      ? overrides.student
      : {
          id: 'stu-1',
          firstName: 'Juan',
          lastName: 'García',
          dni: '12345678',
          fechaDePase: null,
        };

  const courseCycle =
    overrides.courseCycle !== undefined
      ? overrides.courseCycle
      : {
          uuid: 'cc-uuid-1',
          level: 30,
          course: { grade: '3°', division: 'B' },
          cycle: { name: 'Ciclo 2026' },
        };

  return {
    alumnosXCursoXCiclo: {
      findUnique: vi.fn().mockResolvedValue(axcc),
    },
    student: {
      findUnique: vi.fn().mockResolvedValue(student),
    },
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(courseCycle),
    },
  };
}

const defaultInput = {
  destinatario: 'A pedido del interesado',
  fechaEmision: '2026-06-26',
};

// ── ConstanciaError shape ────────────────────────────────────────────────────

describe('ConstanciaError', () => {
  it('stores code and httpStatus', () => {
    const e = new ConstanciaError('test message', 'TEST_CODE', 404);
    expect(e.message).toBe('test message');
    expect(e.code).toBe('TEST_CODE');
    expect(e.httpStatus).toBe(404);
    expect(e.name).toBe('ConstanciaError');
  });

  it('defaults httpStatus to 422', () => {
    const e = new ConstanciaError('msg', 'CODE');
    expect(e.httpStatus).toBe(422);
  });
});

// ── GenerateConstanciaRegularUseCase.execute ─────────────────────────────────

describe('GenerateConstanciaRegularUseCase.execute', () => {
  beforeEach(() => {
    vi.mocked(TenantContext.getClient).mockReset();
    vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-1');
  });

  // ── Case (a): axcc inexistente → 404 ─────────────────────────────────────

  it('(a) throws AXCC_NOT_FOUND (404) when AlumnosXCursoXCiclo row does not exist', async () => {
    const tenantClient = makeTenantClient({ axcc: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      makePrisma() as never,
    );

    await expect(uc.execute('axcc-missing', defaultInput)).rejects.toThrowError(
      expect.objectContaining({ code: 'AXCC_NOT_FOUND', httpStatus: 404 }),
    );
  });

  // ── Case (b): student.fechaDePase != null → 422 ──────────────────────────

  it('(b) throws STUDENT_NOT_ELIGIBLE (422) when student has fechaDePase set', async () => {
    const tenantClient = makeTenantClient({
      student: {
        id: 'stu-1',
        firstName: 'Juan',
        lastName: 'García',
        dni: '12345678',
        fechaDePase: new Date('2026-03-15'),
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      makePrisma() as never,
    );

    await expect(uc.execute('axcc-1', defaultInput)).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_ELIGIBLE', httpStatus: 422 }),
    );
  });

  // ── Case (c): happy path → Buffer ─────────────────────────────────────────

  it('(c) returns a Buffer on happy path', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma() as never,
    );

    const result = await uc.execute('axcc-1', defaultInput);

    expect(result).toBeInstanceOf(Buffer);
    expect(pdfGenerator.generatePdf).toHaveBeenCalledOnce();
  });

  // ── Case (d): DatosConstancia assembled — 4 groups ───────────────────────

  it('(d) assembles DatosConstancia from all 4 data groups (master + tenant)', async () => {
    const tenantClient = makeTenantClient({
      courseCycle: {
        uuid: 'cc-uuid-1',
        level: 30,
        course: { grade: '3°', division: 'B' },
        cycle: { name: 'Ciclo 2026' },
      },
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma({
        id: 'inst-1',
        name: 'Colegio San Martín',
        cue: '999888',
        city: 'Rosario',
        province: 'Santa Fe',
        logoUrl: null,
      }) as never,
    );

    await uc.execute('axcc-1', defaultInput);

    const [htmlArg] = pdfGenerator.generatePdf.mock.calls[0] as [string];

    // Group A — Institución
    expect(htmlArg).toContain('Colegio San Martín');
    expect(htmlArg).toContain('999888');      // CUE
    expect(htmlArg).toContain('Rosario');     // localidad
    expect(htmlArg).toContain('Santa Fe');    // provincia

    // Group B — Alumno
    expect(htmlArg).toContain('García');      // apellido
    expect(htmlArg).toContain('Juan');        // nombre
    expect(htmlArg).toContain('12345678');    // DNI

    // Group C — Académico
    expect(htmlArg).toContain('Secundario'); // nivel
    expect(htmlArg).toContain('3°');         // grado
    expect(htmlArg).toContain('B');          // division
    expect(htmlArg).toContain('Ciclo 2026'); // cicloLectivo
    expect(htmlArg).toContain('alumno/a regular'); // verbatim phrase

    // Group D — Validación
    expect(htmlArg).toContain('A pedido del interesado'); // destinatario
    expect(htmlArg).toContain('26 de junio de 2026');      // fechaEmisionLarga
    expect(htmlArg).toContain('Firma y Sello');             // signature area
  });

  // ── Case (e): logoDataUri = null when logoUrl is null ──────────────────────

  it('(e) logoDataUri is null when institution.logoUrl is null (resolveLogoDataUri returns null)', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const { resolveLogoDataUri } = await import(
      '../../../infrastructure/reporting/resolve-logo-data-uri'
    );
    vi.mocked(resolveLogoDataUri).mockResolvedValue(null);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma({ id: 'inst-1', name: 'E', cue: null, city: null, province: null, logoUrl: null }) as never,
    );

    await uc.execute('axcc-1', defaultInput);

    // Template rendered without logo
    const [htmlArg] = pdfGenerator.generatePdf.mock.calls[0] as [string];
    // The {{#if logoDataUri}} block should be absent / empty
    expect(htmlArg).not.toMatch(/data:image/);
  });

  // ── Case (f): provincia = null when institution.province is null ────────────

  it('(f) provincia is null when institution.province is null — renders without provincia', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma({
        id: 'inst-1',
        name: 'Escuela X',
        cue: null,
        city: null,
        province: null,
        logoUrl: null,
      }) as never,
    );

    await uc.execute('axcc-1', defaultInput);

    // Should not throw; PDF generated successfully
    expect(pdfGenerator.generatePdf).toHaveBeenCalledOnce();
    const [htmlArg] = pdfGenerator.generatePdf.mock.calls[0] as [string];
    // province-related content should not appear (conditional block)
    expect(htmlArg).not.toContain('Buenos Aires');
  });

  // ── Case (g): fechaEmision parsed without TZ shift ───────────────────────────

  it('(g) "2026-06-26" formats to "26 de junio de 2026" without timezone shift', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma() as never,
    );

    await uc.execute('axcc-1', { destinatario: 'Test', fechaEmision: '2026-06-26' });

    const [htmlArg] = pdfGenerator.generatePdf.mock.calls[0] as [string];
    expect(htmlArg).toContain('26 de junio de 2026');
  });

  // ── Edge: each month formats correctly ──────────────────────────────────────

  it.each([
    ['2026-01-05', '5 de enero de 2026'],
    ['2026-02-28', '28 de febrero de 2026'],
    ['2026-03-01', '1 de marzo de 2026'],
    ['2026-12-31', '31 de diciembre de 2026'],
  ])('fechaEmision %s → "%s"', async (fecha, expected) => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const pdfGenerator = makePdfGenerator();
    const uc = new GenerateConstanciaRegularUseCase(
      pdfGenerator as never,
      makePrisma() as never,
    );

    await uc.execute('axcc-1', { destinatario: 'Test', fechaEmision: fecha });

    const [htmlArg] = pdfGenerator.generatePdf.mock.calls[0] as [string];
    expect(htmlArg).toContain(expected);
  });

  // ── Fix 1: Student null → 404 ──────────────────────────────────────────────
  // Orphaned axcc (FK not enforced at app level) must throw, not produce empty PDF.

  it('[fix-1] throws STUDENT_NOT_FOUND (404) when student row is null (orphaned axcc)', async () => {
    const tenantClient = makeTenantClient({ student: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      makePrisma() as never,
    );

    await expect(uc.execute('axcc-1', defaultInput)).rejects.toThrowError(
      expect.objectContaining({ code: 'STUDENT_NOT_FOUND', httpStatus: 404 }),
    );
  });

  // ── Fix 2: CourseCycle null → 404 ──────────────────────────────────────────

  it('[fix-2] throws COURSE_CYCLE_NOT_FOUND (404) when courseCycle is null', async () => {
    const tenantClient = makeTenantClient({ courseCycle: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      makePrisma() as never,
    );

    await expect(uc.execute('axcc-1', defaultInput)).rejects.toThrowError(
      expect.objectContaining({ code: 'COURSE_CYCLE_NOT_FOUND', httpStatus: 404 }),
    );
  });

  // ── Fix 3: Institution null when institutionId is set → 500 ─────────────────
  // institutionId present but no matching row = master DB inconsistency.

  it('[fix-3] throws INSTITUTION_NOT_FOUND (500) when institutionId is set but institution is null', async () => {
    vi.mocked(TenantContext.getInstitutionId).mockReturnValue('inst-999');
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      makePrisma(null) as never, // institution.findUnique returns null
    );

    await expect(uc.execute('axcc-1', defaultInput)).rejects.toThrowError(
      expect.objectContaining({ code: 'INSTITUTION_NOT_FOUND', httpStatus: 500 }),
    );
  });

  // ── Fix 5: REQ-7 master/tenant isolation ──────────────────────────────────
  // masterClient must NOT access tenant tables; tenantClient must NOT access master tables.

  it('[fix-5] tenant queries go to tenantClient; institution query goes to masterClient', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const prisma = makePrisma();
    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      prisma as never,
    );

    await uc.execute('axcc-1', defaultInput);

    // Tenant tables were accessed via tenantClient
    expect(tenantClient.alumnosXCursoXCiclo.findUnique).toHaveBeenCalled();
    expect(tenantClient.student.findUnique).toHaveBeenCalled();
    expect(tenantClient.courseCycle.findUnique).toHaveBeenCalled();

    // Institution came from masterClient
    const masterInstitutionFindUnique =
      prisma.getMasterClient().institution.findUnique as ReturnType<typeof vi.fn>;
    expect(masterInstitutionFindUnique).toHaveBeenCalled();

    // tenantClient has no institution property (cross-client isolation)
    expect((tenantClient as any).institution).toBeUndefined();

    // masterClient has no alumnosXCursoXCiclo property
    expect((prisma.getMasterClient() as any).alumnosXCursoXCiclo).toBeUndefined();
  });

  // ── Fix 7: institution.findUnique uses select (no sensitive fields) ──────────

  it('[fix-7] institution.findUnique is called with select limiting fields to what the use case needs', async () => {
    const tenantClient = makeTenantClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(tenantClient as any);

    const prisma = makePrisma();
    const uc = new GenerateConstanciaRegularUseCase(
      makePdfGenerator() as never,
      prisma as never,
    );

    await uc.execute('axcc-1', defaultInput);

    const findUniqueSpy = prisma.getMasterClient().institution.findUnique as ReturnType<typeof vi.fn>;
    const [callArg] = findUniqueSpy.mock.calls[0] as [{ where: unknown; select?: unknown }];
    expect(callArg.select).toEqual({
      name: true,
      cue: true,
      city: true,
      province: true,
      logoUrl: true,
    });
  });
});
