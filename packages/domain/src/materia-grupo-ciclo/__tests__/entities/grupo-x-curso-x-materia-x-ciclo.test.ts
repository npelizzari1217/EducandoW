/**
 * GrupoXCursoXMateriaXCiclo — Domain entity tests (Fase 3b)
 * Specs: MGC-R3, MGC-S7, MGC-S8
 * Tasks: F3-D3, F3-T2 (independence)
 */
import { describe, it, expect } from 'vitest';
import { GrupoXCursoXMateriaXCiclo } from '../../entities/grupo-x-curso-x-materia-x-ciclo';

describe('GrupoXCursoXMateriaXCiclo entity', () => {
  const validInput = {
    materiaXCursoXCicloId: 'mxcc-1',
    docenteXCicloId: 'dxc-1',
  };

  it('create generates an id', () => {
    const g = GrupoXCursoXMateriaXCiclo.create(validInput);
    expect(g.id).toBeTruthy();
    expect(typeof g.id).toBe('string');
  });

  it('two create() calls produce different ids', () => {
    const a = GrupoXCursoXMateriaXCiclo.create(validInput);
    const b = GrupoXCursoXMateriaXCiclo.create(validInput);
    expect(a.id).not.toBe(b.id);
  });

  // MGC-R3: a group has EXACTLY ONE DocenteXCiclo
  it('exposes exactly one docenteXCicloId (MGC-R3)', () => {
    const g = GrupoXCursoXMateriaXCiclo.create(validInput);
    expect(g.docenteXCicloId).toBe('dxc-1');
  });

  it('exposes materiaXCursoXCicloId', () => {
    const g = GrupoXCursoXMateriaXCiclo.create(validInput);
    expect(g.materiaXCursoXCicloId).toBe('mxcc-1');
  });

  // MGC-S7: non-split subject — one group per materia (entity doesn't enforce count; that's a repo concern)
  // Entity validates it belongs to one materia + one docente
  it('name is optional — defaults to undefined (MGC-S7)', () => {
    const g = GrupoXCursoXMateriaXCiclo.create(validInput);
    expect(g.name).toBeUndefined();
  });

  it('name can be set on create', () => {
    const g = GrupoXCursoXMateriaXCiclo.create({ ...validInput, name: 'Grupo A' });
    expect(g.name).toBe('Grupo A');
  });

  // MGC-S8: split subject — two groups with different DocenteXCiclo (both entities valid)
  it('two groups for same materia with different docentes are valid (MGC-S8)', () => {
    const g1 = GrupoXCursoXMateriaXCiclo.create({ materiaXCursoXCicloId: 'mxcc-1', docenteXCicloId: 'dxc-D1' });
    const g2 = GrupoXCursoXMateriaXCiclo.create({ materiaXCursoXCicloId: 'mxcc-1', docenteXCicloId: 'dxc-D2' });
    expect(g1.docenteXCicloId).toBe('dxc-D1');
    expect(g2.docenteXCicloId).toBe('dxc-D2');
    expect(g1.id).not.toBe(g2.id);
  });

  it('reconstruct preserves all fields', () => {
    const now = new Date('2026-01-01');
    const g = GrupoXCursoXMateriaXCiclo.reconstruct({
      id: 'fixed-id',
      materiaXCursoXCicloId: 'mxcc-1',
      docenteXCicloId: 'dxc-1',
      name: 'Grupo B',
      createdAt: now,
      updatedAt: now,
    });
    expect(g.id).toBe('fixed-id');
    expect(g.name).toBe('Grupo B');
    expect(g.createdAt).toBe(now);
  });

  // invariant guards
  it('create throws if materiaXCursoXCicloId is empty', () => {
    expect(() =>
      GrupoXCursoXMateriaXCiclo.create({ materiaXCursoXCicloId: '', docenteXCicloId: 'dxc-1' })
    ).toThrow();
  });

  it('create throws if docenteXCicloId is empty (MGC-R3: must have exactly one docente)', () => {
    expect(() =>
      GrupoXCursoXMateriaXCiclo.create({ materiaXCursoXCicloId: 'mxcc-1', docenteXCicloId: '' })
    ).toThrow();
  });
});
