/**
 * PrismaAlumnosXCursoXCicloRepository — unit tests for SDD-2 additions (T07).
 *
 * Tests: setPrintable, setPrintableBulk, findByCourseCycleEnriched (includes printable).
 * Mocks TenantContext.getClient() — no real DB required.
 *
 * REQ-TOG-1, REQ-TOG-2, REQ-TOG-3, REQ-LIST-1 (SDD-2)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAlumnosXCursoXCicloRepository } from '../prisma-alumnos-x-curso-x-ciclo.repository';
import { TenantContext } from '../../../../auth/tenant.context';

vi.mock('../../../../auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Types / helpers ────────────────────────────────────────────────────────────

type MockRow = {
  id: string;
  courseCycleId: string;
  studentId: string;
  printable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function makeRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 'axcc-1',
    courseCycleId: 'cc-1',
    studentId: 's-1',
    printable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type MockClient = {
  alumnosXCursoXCiclo: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  student: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeMockClient(overrides: Partial<{
  axccRows: MockRow[];
  students: { id: string; firstName: string; lastName: string }[];
  updateRow: MockRow;
}> = {}): MockClient {
  const axccRows = overrides.axccRows ?? [];
  const students = overrides.students ?? [];
  const updateRow = overrides.updateRow ?? makeRow();

  return {
    alumnosXCursoXCiclo: {
      findMany: vi.fn().mockResolvedValue(axccRows),
      findUnique: vi.fn().mockResolvedValue(axccRows[0] ?? null),
      update: vi.fn().mockResolvedValue(updateRow),
      updateMany: vi.fn().mockResolvedValue({ count: axccRows.length }),
      upsert: vi.fn().mockResolvedValue(axccRows[0] ?? makeRow()),
      count: vi.fn().mockResolvedValue(axccRows.length),
      delete: vi.fn().mockResolvedValue(axccRows[0] ?? makeRow()),
    },
    student: {
      findMany: vi.fn().mockResolvedValue(students),
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// setPrintable
// ══════════════════════════════════════════════════════════════════════════════

describe('PrismaAlumnosXCursoXCicloRepository.setPrintable', () => {
  let repo: PrismaAlumnosXCursoXCicloRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXCursoXCicloRepository();
  });

  it('calls client.update with correct id and value=true, returns domain entity', async () => {
    const updatedRow = makeRow({ id: 'axcc-1', printable: true });
    const client = makeMockClient({ updateRow: updatedRow });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    const result = await repo.setPrintable('axcc-1', true);

    expect(client.alumnosXCursoXCiclo.update).toHaveBeenCalledWith({
      where: { id: 'axcc-1' },
      data: { printable: true, updatedAt: expect.any(Date) },
    });
    expect(result.printable).toBe(true);
    expect(result.id).toBe('axcc-1');
  });

  it('calls client.update with value=false, returns domain entity', async () => {
    const updatedRow = makeRow({ id: 'axcc-1', printable: false });
    const client = makeMockClient({ updateRow: updatedRow });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    const result = await repo.setPrintable('axcc-1', false);

    expect(client.alumnosXCursoXCiclo.update).toHaveBeenCalledWith({
      where: { id: 'axcc-1' },
      data: { printable: false, updatedAt: expect.any(Date) },
    });
    expect(result.printable).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// setPrintableBulk
// ══════════════════════════════════════════════════════════════════════════════

describe('PrismaAlumnosXCursoXCicloRepository.setPrintableBulk', () => {
  let repo: PrismaAlumnosXCursoXCicloRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXCursoXCicloRepository();
  });

  it('Scenario F (Todos): calls updateMany with courseCycleId and value=true', async () => {
    const rows = [makeRow({ id: 'axcc-1' }), makeRow({ id: 'axcc-2' })];
    const client = makeMockClient({ axccRows: rows });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    await repo.setPrintableBulk('cc-1', true);

    expect(client.alumnosXCursoXCiclo.updateMany).toHaveBeenCalledWith({
      where: { courseCycleId: 'cc-1' },
      data: { printable: true, updatedAt: expect.any(Date) },
    });
    expect(client.alumnosXCursoXCiclo.updateMany).toHaveBeenCalledTimes(1);
  });

  it('Scenario G (Ninguno): calls updateMany with courseCycleId and value=false', async () => {
    const client = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    await repo.setPrintableBulk('cc-1', false);

    expect(client.alumnosXCursoXCiclo.updateMany).toHaveBeenCalledWith({
      where: { courseCycleId: 'cc-1' },
      data: { printable: false, updatedAt: expect.any(Date) },
    });
  });

  it('Scenario H (tenant isolation): only scopes to given courseCycleId — no cross-CC update', async () => {
    const client = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    await repo.setPrintableBulk('cc-T1', false);

    expect(client.alumnosXCursoXCiclo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseCycleId: 'cc-T1' } }),
    );
    // No other courseCycleId was passed
    const calls = client.alumnosXCursoXCiclo.updateMany.mock.calls as Array<[{ where: { courseCycleId: string } }]>;
    expect(calls.every((c) => c[0].where.courseCycleId === 'cc-T1')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// findByCourseCycleEnriched — printable field (REQ-LIST-1)
// ══════════════════════════════════════════════════════════════════════════════

describe('PrismaAlumnosXCursoXCicloRepository.findByCourseCycleEnriched — printable (SDD-2)', () => {
  let repo: PrismaAlumnosXCursoXCicloRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXCursoXCicloRepository();
  });

  it('Scenario I: each enriched entry includes the printable flag from the DB row', async () => {
    const rows = [
      makeRow({ id: 'axcc-1', studentId: 's-1', printable: true }),
      makeRow({ id: 'axcc-2', studentId: 's-2', printable: false }),
    ];
    const students = [
      { id: 's-1', firstName: 'Ana', lastName: 'García' },
      { id: 's-2', firstName: 'Carlos', lastName: 'López' },
    ];
    const client = makeMockClient({ axccRows: rows, students });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    const result = await repo.findByCourseCycleEnriched('cc-1');

    expect(result).toHaveLength(2);
    const a = result.find((r) => r.id === 'axcc-1');
    const b = result.find((r) => r.id === 'axcc-2');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.printable).toBe(true);
    expect(b!.printable).toBe(false);
    expect(a!.studentName).toBe('Ana García');
    expect(b!.studentName).toBe('Carlos López');
  });

  it('returns empty array when no rows exist — printable is irrelevant', async () => {
    const client = makeMockClient({ axccRows: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    const result = await repo.findByCourseCycleEnriched('cc-empty');

    expect(result).toEqual([]);
  });

  it('orders enriched result by lastName + firstName (es)', async () => {
    // Insertion order (createdAt) is intentionally NOT alphabetical.
    const client = makeMockClient({
      axccRows: [
        makeRow({ id: 'axcc-1', studentId: 's-zarate' }),
        makeRow({ id: 'axcc-2', studentId: 's-alvarez-c' }),
        makeRow({ id: 'axcc-3', studentId: 's-alvarez-a' }),
      ],
      students: [
        { id: 's-zarate', firstName: 'Beto', lastName: 'Zárate' },
        { id: 's-alvarez-c', firstName: 'Carlos', lastName: 'Álvarez' },
        { id: 's-alvarez-a', firstName: 'Ana', lastName: 'Álvarez' },
      ],
    });
    vi.mocked(TenantContext.getClient).mockReturnValue(client as unknown as ReturnType<typeof TenantContext.getClient>);

    const result = await repo.findByCourseCycleEnriched('cc-1');

    // Álvarez before Zárate; within Álvarez, Ana before Carlos
    expect(result.map((r) => r.studentName)).toEqual(['Ana Álvarez', 'Carlos Álvarez', 'Beto Zárate']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// findByCourseCycleEnriched — S-7: pase global (fecha_de_pase vive en Student)
// ══════════════════════════════════════════════════════════════════════════════

describe('PrismaAlumnosXCursoXCicloRepository.findByCourseCycleEnriched — S-7 pase global', () => {
  let repo: PrismaAlumnosXCursoXCicloRepository;

  beforeEach(() => {
    repo = new PrismaAlumnosXCursoXCicloRepository();
  });

  it('S-7: pase registrado desde CC-B es visible al listar CC-A (fechaDePase vive en Student, no en la inscripción)', async () => {
    // fecha_de_pase vive en Student, no en AlumnosXCursoXCiclo.
    // Registrar el pase desde cualquier CC actualiza Student.fecha_de_pase;
    // findByCourseCycleEnriched de CUALQUIER CC hace JOIN con Student
    // y expone ese valor — el pase es GLOBAL al alumno.
    const fechaDePase = new Date('2026-06-01T00:00:00.000Z');
    const studentWithPase = { id: 's-1', firstName: 'Juan', lastName: 'Pérez', fechaDePase };

    function makePaseClient(ccId: string, rowId: string) {
      return {
        alumnosXCursoXCiclo: {
          findMany: vi.fn().mockResolvedValue([
            makeRow({ id: rowId, courseCycleId: ccId, studentId: 's-1' }),
          ]),
          findUnique: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          upsert: vi.fn(),
          count: vi.fn(),
          delete: vi.fn(),
        },
        student: {
          findMany: vi.fn().mockResolvedValue([studentWithPase]),
        },
      };
    }

    // CC-A: listado del curso donde NO se registró el pase
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makePaseClient('cc-a', 'axcc-a') as unknown as ReturnType<typeof TenantContext.getClient>,
    );
    const resultA = await repo.findByCourseCycleEnriched('cc-a');

    // CC-B: listado del curso desde el que SÍ se registró el pase
    vi.mocked(TenantContext.getClient).mockReturnValue(
      makePaseClient('cc-b', 'axcc-b') as unknown as ReturnType<typeof TenantContext.getClient>,
    );
    const resultB = await repo.findByCourseCycleEnriched('cc-b');

    // Ambos listados exponen el mismo fechaDePase del alumno
    expect(resultA).toHaveLength(1);
    expect(resultB).toHaveLength(1);
    expect(resultA[0].studentId).toBe('s-1');
    expect(resultB[0].studentId).toBe('s-1');
    expect(resultA[0].fechaDePase).toBe(fechaDePase.toISOString());
    expect(resultB[0].fechaDePase).toBe(fechaDePase.toISOString());
    expect(resultA[0].fechaDePase).not.toBeNull();
    expect(resultB[0].fechaDePase).not.toBeNull();
  });
});
