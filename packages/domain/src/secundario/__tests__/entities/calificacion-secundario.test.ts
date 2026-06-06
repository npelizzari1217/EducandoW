import { describe, it, expect } from 'vitest';
import { CalificacionSecundario } from '../../entities/calificacion-secundario';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAprobado(overrides: Partial<{
  studentId: string;
  cursoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  condicion: string;
}> = {}) {
  const result = CalificacionSecundario.create({
    studentId: 'student-1',
    cursoId: 'curso-1',
    subjectId: 'subject-1',
    trimestre: '1T',
    nota: 8,
    condicion: 'APROBADO',
    ...overrides,
  });
  if (result.isErr()) throw new Error(`Unexpected error: ${result.unwrapErr().message}`);
  return result.unwrap();
}

function makePrevia(nota = 4) {
  return makeAprobado({ condicion: 'PREVIA', nota });
}

function makeLibre(nota = 3) {
  return makeAprobado({ condicion: 'LIBRE', nota });
}

// ── CalificacionSecundario ─────────────────────────────────────────────────

describe('CalificacionSecundario', () => {
  // ── create() validation ────────────────────────────────────────────────

  describe('create()', () => {
    it('creates with valid APROBADO data', () => {
      const c = makeAprobado();
      expect(c.studentId).toBe('student-1');
      expect(c.condicion.get()).toBe('APROBADO');
      expect(c.nota).toBe(8);
      expect(c.notaDiciembre).toBeNull();
      expect(c.notaFebrero).toBeNull();
    });

    it('creates with PREVIA condition', () => {
      const c = makePrevia();
      expect(c.condicion.get()).toBe('PREVIA');
    });

    it('creates with LIBRE condition', () => {
      const c = makeLibre();
      expect(c.condicion.get()).toBe('LIBRE');
    });

    it('rejects invalid condicion', () => {
      const result = CalificacionSecundario.create({
        studentId: 's1', cursoId: 'c1', subjectId: 'sub1',
        trimestre: '1T', nota: 5, condicion: 'INVALIDO',
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Condición inválida');
    });

    it('rejects nota below minimum', () => {
      const result = CalificacionSecundario.create({
        studentId: 's1', cursoId: 'c1', subjectId: 'sub1',
        trimestre: '1T', nota: 0, condicion: 'PREVIA',
      });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('nota debe estar entre');
    });

    it('rejects nota above maximum', () => {
      const result = CalificacionSecundario.create({
        studentId: 's1', cursoId: 'c1', subjectId: 'sub1',
        trimestre: '1T', nota: 11, condicion: 'PREVIA',
      });
      expect(result.isErr()).toBe(true);
    });

    it('rejects empty studentId', () => {
      const result = CalificacionSecundario.create({
        studentId: '', cursoId: 'c1', subjectId: 'sub1',
        trimestre: '1T', nota: 5, condicion: 'PREVIA',
      });
      expect(result.isErr()).toBe(true);
    });
  });

  // ── calcularDefinitiva() ───────────────────────────────────────────────

  describe('calcularDefinitiva()', () => {
    it('returns nota trimestral when no suplementarias recorded', () => {
      const c = makePrevia(4);
      expect(c.calcularDefinitiva()).toBe(4);
    });

    it('returns notaDiciembre when higher than nota trimestral', () => {
      const c = makePrevia(4);
      c.registrarNotaSuplementaria('DICIEMBRE', 7);
      expect(c.calcularDefinitiva()).toBe(7);
    });

    it('returns nota trimestral when notaDiciembre is lower', () => {
      const c = makePrevia(6);
      c.registrarNotaSuplementaria('DICIEMBRE', 4);
      // calcularDefinitiva returns MAX; nota=6, diciembre=4 → max=6
      expect(c.calcularDefinitiva()).toBe(6);
    });

    it('returns notaFebrero when it is the highest', () => {
      const c = makePrevia(4);
      c.registrarNotaSuplementaria('DICIEMBRE', 5);
      c.registrarNotaSuplementaria('FEBRERO', 9);
      expect(c.calcularDefinitiva()).toBe(9);
    });

    it('returns notaFebrero over notaDiciembre when tied (priority rule)', () => {
      // nota=5, diciembre=5, febrero=5 — tie → notaFebrero wins
      const c = makePrevia(5);
      c.registrarNotaSuplementaria('DICIEMBRE', 5);
      c.registrarNotaSuplementaria('FEBRERO', 5);
      expect(c.calcularDefinitiva()).toBe(5); // all same, febrero priority
    });

    it('returns notaDiciembre over nota when tied (diciembre priority)', () => {
      // nota=7, diciembre=7, no febrero
      const c = makePrevia(7);
      c.registrarNotaSuplementaria('DICIEMBRE', 7);
      expect(c.calcularDefinitiva()).toBe(7); // same value, either is fine
    });

    it('only has notaDiciembre recorded', () => {
      const c = makePrevia(3);
      c.registrarNotaSuplementaria('DICIEMBRE', 8);
      expect(c.calcularDefinitiva()).toBe(8);
    });
  });

  // ── puedeRendirSuplementario() ─────────────────────────────────────────

  describe('puedeRendirSuplementario()', () => {
    it('returns true for PREVIA', () => {
      expect(makePrevia().puedeRendirSuplementario()).toBe(true);
    });

    it('returns true for LIBRE', () => {
      expect(makeLibre().puedeRendirSuplementario()).toBe(true);
    });

    it('returns false for APROBADO', () => {
      expect(makeAprobado().puedeRendirSuplementario()).toBe(false);
    });
  });

  // ── registrarNotaSuplementaria() ──────────────────────────────────────

  describe('registrarNotaSuplementaria()', () => {
    it('records DICIEMBRE nota for PREVIA student', () => {
      const c = makePrevia(4);
      const result = c.registrarNotaSuplementaria('DICIEMBRE', 6);
      expect(result.isOk()).toBe(true);
      expect(c.notaDiciembre).toBe(6);
    });

    it('records FEBRERO nota after DICIEMBRE for PREVIA student', () => {
      const c = makePrevia(4);
      c.registrarNotaSuplementaria('DICIEMBRE', 5);
      const result = c.registrarNotaSuplementaria('FEBRERO', 7);
      expect(result.isOk()).toBe(true);
      expect(c.notaFebrero).toBe(7);
    });

    it('records DICIEMBRE nota for LIBRE student', () => {
      const c = makeLibre(3);
      const result = c.registrarNotaSuplementaria('DICIEMBRE', 6);
      expect(result.isOk()).toBe(true);
      expect(c.notaDiciembre).toBe(6);
    });

    it('rejects FEBRERO when notaDiciembre is null (W1: undocumented rule)', () => {
      // W1: The domain enforces this rule but spec does NOT document it.
      // Flagged as pending decision: valid business rule or blocking bug?
      const c = makePrevia(4);
      const result = c.registrarNotaSuplementaria('FEBRERO', 7);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Diciembre');
    });

    it('rejects suplementaria for APROBADO student', () => {
      const c = makeAprobado();
      const result = c.registrarNotaSuplementaria('DICIEMBRE', 6);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toContain('Condición no habilita');
    });

    it('rejects nota below minimum', () => {
      const c = makePrevia(4);
      const result = c.registrarNotaSuplementaria('DICIEMBRE', 0);
      expect(result.isErr()).toBe(true);
    });

    it('rejects nota above maximum', () => {
      const c = makePrevia(4);
      const result = c.registrarNotaSuplementaria('DICIEMBRE', 11);
      expect(result.isErr()).toBe(true);
    });
  });
});
