/**
 * AsignacionCursoXCiclo domain entity tests (Fase 4)
 * Specs: ACC-R1/R2/R3/R4/R5
 */
import { describe, it, expect } from 'vitest';
import {
  AsignacionCursoXCiclo,
  RolCurso,
  TurnoCurso,
} from '../../entities/asignacion-curso-x-ciclo';

describe('AsignacionCursoXCiclo entity', () => {
  it('creates a PRECEPTOR assignment with turno (ACC-S1)', () => {
    const a = AsignacionCursoXCiclo.create({
      courseCycleId: 'cc-1',
      docenteXCicloId: 'dxc-1',
      rol: RolCurso.PRECEPTOR,
      turno: TurnoCurso.MANANA,
    });
    expect(a.courseCycleId).toBe('cc-1');
    expect(a.docenteXCicloId).toBe('dxc-1');
    expect(a.rol).toBe(RolCurso.PRECEPTOR);
    expect(a.turno).toBe(TurnoCurso.MANANA);
    expect(a.id).toBeDefined();
  });

  it('creates a TITULAR assignment without turno (ACC-S4)', () => {
    const a = AsignacionCursoXCiclo.create({
      courseCycleId: 'cc-1',
      docenteXCicloId: 'dxc-2',
      rol: RolCurso.TITULAR,
    });
    expect(a.rol).toBe(RolCurso.TITULAR);
    expect(a.turno).toBeUndefined();
  });

  it('creates a PRECEPTOR assignment without turno (turno is optional)', () => {
    const a = AsignacionCursoXCiclo.create({
      courseCycleId: 'cc-1',
      docenteXCicloId: 'dxc-3',
      rol: RolCurso.PRECEPTOR,
    });
    expect(a.rol).toBe(RolCurso.PRECEPTOR);
    expect(a.turno).toBeUndefined();
  });

  it('reconstruct preserves all fields', () => {
    const now = new Date();
    const a = AsignacionCursoXCiclo.reconstruct({
      id: 'asg-1',
      courseCycleId: 'cc-1',
      docenteXCicloId: 'dxc-1',
      rol: RolCurso.PRECEPTOR,
      turno: TurnoCurso.TARDE,
      createdAt: now,
      updatedAt: now,
    });
    expect(a.id).toBe('asg-1');
    expect(a.turno).toBe(TurnoCurso.TARDE);
    expect(a.createdAt).toBe(now);
  });

  it('all TurnoCurso values are valid', () => {
    const turnos = [TurnoCurso.MANANA, TurnoCurso.TARDE, TurnoCurso.VESPERTINO, TurnoCurso.NOCHE];
    turnos.forEach((turno) => {
      const a = AsignacionCursoXCiclo.create({
        courseCycleId: 'cc-1',
        docenteXCicloId: 'dxc-1',
        rol: RolCurso.PRECEPTOR,
        turno,
      });
      expect(a.turno).toBe(turno);
    });
  });
});
