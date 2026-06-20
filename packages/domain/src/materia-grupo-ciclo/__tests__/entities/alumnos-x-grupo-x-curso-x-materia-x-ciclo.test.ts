/**
 * AlumnosXGrupoXCursoXMateriaXCiclo — Domain entity tests (Fase 3b)
 * Specs: MGC-R4, MGC-R5, MGC-S9, MGC-S10, MGC-S11, MGC-S12
 * Tasks: F3-D4, F3-T3 (containment), F3-T6 (co-docencia)
 */
import { describe, it, expect } from 'vitest';
import { AlumnosXGrupoXCursoXMateriaXCiclo } from '../../entities/alumnos-x-grupo-x-curso-x-materia-x-ciclo';

describe('AlumnosXGrupoXCursoXMateriaXCiclo entity', () => {
  const validInput = {
    grupoId: 'grupo-1',
    alumnosXMateriaXCursoXCicloId: 'axmxcc-1',
  };

  it('create generates an id', () => {
    const a = AlumnosXGrupoXCursoXMateriaXCiclo.create(validInput);
    expect(a.id).toBeTruthy();
    expect(typeof a.id).toBe('string');
  });

  it('two create() calls produce different ids', () => {
    const a = AlumnosXGrupoXCursoXMateriaXCiclo.create(validInput);
    const b = AlumnosXGrupoXCursoXMateriaXCiclo.create(validInput);
    expect(a.id).not.toBe(b.id);
  });

  it('exposes grupoId and alumnosXMateriaXCursoXCicloId', () => {
    const a = AlumnosXGrupoXCursoXMateriaXCiclo.create(validInput);
    expect(a.grupoId).toBe('grupo-1');
    expect(a.alumnosXMateriaXCursoXCicloId).toBe('axmxcc-1');
  });

  it('reconstruct preserves all fields', () => {
    const now = new Date('2026-01-01');
    const a = AlumnosXGrupoXCursoXMateriaXCiclo.reconstruct({
      id: 'fixed-id',
      grupoId: 'grupo-1',
      alumnosXMateriaXCursoXCicloId: 'axmxcc-99',
      createdAt: now,
      updatedAt: now,
    });
    expect(a.id).toBe('fixed-id');
    expect(a.alumnosXMateriaXCursoXCicloId).toBe('axmxcc-99');
    expect(a.createdAt).toBe(now);
  });

  /**
   * MGC-R4 — Hard containment: grupo ⊆ materia
   * The DB FK enforces grupo ⊆ materia (alumnosXMateriaXCursoXCicloId → MateriasXAlumnoXCursoXCiclo).
   * At the domain entity level: we only guarantee the reference is non-empty.
   * The actual cross-course check (MGC-S10) and universe check (MGC-S11)
   * are enforced by the use-case layer (F3-A4), not the entity.
   * The entity models the FK — no studentId directly.
   */
  it('does not have a studentId field — containment enforced via FK ref (MGC-R4)', () => {
    const a = AlumnosXGrupoXCursoXMateriaXCiclo.create(validInput);
    expect((a as unknown as Record<string, unknown>)['studentId']).toBeUndefined();
  });

  /**
   * MGC-R5 / MGC-S12 — Co-docencia: same alumnosXMateriaXCursoXCicloId in two groups
   * Both records are valid at the entity level — the uniqueness is per (grupoId, alumnosXMateria)
   */
  it('same alumnosXMateriaId in two different grupos is valid (co-docencia MGC-S12)', () => {
    const a1 = AlumnosXGrupoXCursoXMateriaXCiclo.create({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: 'axm-student-1' });
    const a2 = AlumnosXGrupoXCursoXMateriaXCiclo.create({ grupoId: 'grupo-2', alumnosXMateriaXCursoXCicloId: 'axm-student-1' });
    expect(a1.grupoId).toBe('grupo-1');
    expect(a2.grupoId).toBe('grupo-2');
    expect(a1.alumnosXMateriaXCursoXCicloId).toBe(a2.alumnosXMateriaXCursoXCicloId);
    expect(a1.id).not.toBe(a2.id);
  });

  // invariant guards
  it('create throws if grupoId is empty', () => {
    expect(() =>
      AlumnosXGrupoXCursoXMateriaXCiclo.create({ grupoId: '', alumnosXMateriaXCursoXCicloId: 'axm-1' })
    ).toThrow();
  });

  it('create throws if alumnosXMateriaXCursoXCicloId is empty (MGC-R4: FK ref required)', () => {
    expect(() =>
      AlumnosXGrupoXCursoXMateriaXCiclo.create({ grupoId: 'grupo-1', alumnosXMateriaXCursoXCicloId: '' })
    ).toThrow();
  });
});
