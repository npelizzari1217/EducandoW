/**
 * ListStudentsByCourseCycleUseCase — printable field tests (TDD, T08, SDD-2 PR-1)
 * Covers: Scenario I — GET /course-cycles/:ccId/alumnos includes printable per entry.
 * REQ-LIST-1
 *
 * Tests are RED until T10 updates AlumnoCursoCicloItem to include printable.
 * (The use-case already delegates to findByCourseCycleEnriched; after T04+T07 the
 * enriched type carries printable — the tests verify it flows through correctly.)
 */
import { describe, it, expect, vi } from 'vitest';
import { ListStudentsByCourseCycleUseCase } from '../list-students-by-course-cycle.use-case';
import type { AlumnosXCursoXCicloRepository, AlumnoCursoCicloEnriched } from '@educandow/domain';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRepo(result: AlumnoCursoCicloEnriched[] = []): AlumnosXCursoXCicloRepository {
  return {
    findByCourseCycle: vi.fn().mockResolvedValue([]),
    findByCourseCycleEnriched: vi.fn().mockResolvedValue(result),
    findById: vi.fn().mockResolvedValue(null),
    addStudent: vi.fn(),
    isMember: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue(undefined),
    setPrintable: vi.fn().mockResolvedValue(null),
    setPrintableBulk: vi.fn().mockResolvedValue(undefined),
  } as unknown as AlumnosXCursoXCicloRepository;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ListStudentsByCourseCycleUseCase — printable field (SDD-2)', () => {
  it('Scenario I: result includes printable=true for student A', async () => {
    const enriched: AlumnoCursoCicloEnriched[] = [
      { id: 'axcc-1', studentId: 's-1', studentName: 'Ana García', printable: true },
      { id: 'axcc-2', studentId: 's-2', studentName: 'Carlos López', printable: false },
    ];
    const repo = makeRepo(enriched);
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    const result = await uc.execute('cc-1');

    expect(result).toHaveLength(2);
    const a = result.find((r) => r.id === 'axcc-1');
    const b = result.find((r) => r.id === 'axcc-2');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // REQ-LIST-1: printable must be present and correct
    expect(a!.printable).toBe(true);
    expect(b!.printable).toBe(false);
  });

  it('Scenario I: each entry carries the printable boolean field', async () => {
    const enriched: AlumnoCursoCicloEnriched[] = [
      { id: 'axcc-3', studentId: 's-3', studentName: 'Lucía Martínez', printable: false },
    ];
    const repo = makeRepo(enriched);
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    const result = await uc.execute('cc-2');

    expect(result[0]).toHaveProperty('printable');
    expect(typeof result[0].printable).toBe('boolean');
  });

  it('empty list when no students — printable is irrelevant', async () => {
    const repo = makeRepo([]);
    const uc = new ListStudentsByCourseCycleUseCase(repo);

    const result = await uc.execute('cc-empty');

    expect(result).toEqual([]);
  });
});
