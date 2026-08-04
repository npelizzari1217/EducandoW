import { describe, it, expect } from 'vitest';
import { DomainError } from '../../shared/errors/domain-error';
import {
  AxccNotFoundError,
  ReporteStudentNotFoundError,
  ReporteCourseCycleNotFoundError,
  MateriaXCursoXCicloNotFoundError,
  StudentNotPrintableError,
  StudentNotEligibleError,
  BoletinLevelUnknownError,
  BatchAllFailedError,
} from './index';

describe('AxccNotFoundError', () => {
  it('is a DomainError with code AXCC_NOT_FOUND and preserves the message', () => {
    const err = new AxccNotFoundError('Alumno×Curso×Ciclo no encontrado');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('AXCC_NOT_FOUND');
    expect(err.message).toBe('Alumno×Curso×Ciclo no encontrado');
  });
});

describe('ReporteStudentNotFoundError', () => {
  it('is a DomainError with code STUDENT_NOT_FOUND and preserves the message', () => {
    const err = new ReporteStudentNotFoundError('Alumno no encontrado');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('STUDENT_NOT_FOUND');
    expect(err.message).toBe('Alumno no encontrado');
  });
});

describe('ReporteCourseCycleNotFoundError', () => {
  it('is a DomainError with code COURSE_CYCLE_NOT_FOUND and preserves the message', () => {
    const err = new ReporteCourseCycleNotFoundError('CourseCycle no encontrado');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('COURSE_CYCLE_NOT_FOUND');
    expect(err.message).toBe('CourseCycle no encontrado');
  });
});

describe('MateriaXCursoXCicloNotFoundError', () => {
  it('is a DomainError with code MATERIA_X_CURSO_X_CICLO_NOT_FOUND and preserves the message', () => {
    const err = new MateriaXCursoXCicloNotFoundError('MateriaXCursoXCiclo no encontrada');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('MATERIA_X_CURSO_X_CICLO_NOT_FOUND');
    expect(err.message).toBe('MateriaXCursoXCiclo no encontrada');
  });
});

describe('StudentNotPrintableError', () => {
  it('is a DomainError with code STUDENT_NOT_PRINTABLE and preserves the message', () => {
    const err = new StudentNotPrintableError('El alumno está marcado como no imprimible');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('STUDENT_NOT_PRINTABLE');
    expect(err.message).toBe('El alumno está marcado como no imprimible');
  });
});

describe('StudentNotEligibleError', () => {
  it('is a DomainError with code STUDENT_NOT_ELIGIBLE and preserves the message', () => {
    const err = new StudentNotEligibleError('El alumno tiene fecha de pase inválida para constancia regular');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('STUDENT_NOT_ELIGIBLE');
    expect(err.message).toBe('El alumno tiene fecha de pase inválida para constancia regular');
  });
});

describe('BoletinLevelUnknownError', () => {
  it('is a DomainError with code BOLETIN_LEVEL_UNKNOWN and preserves the message', () => {
    const err = new BoletinLevelUnknownError('Nivel pedagógico no soportado para boletín: X');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('BOLETIN_LEVEL_UNKNOWN');
    expect(err.message).toBe('Nivel pedagógico no soportado para boletín: X');
  });
});

describe('BatchAllFailedError', () => {
  it('is a DomainError with code BATCH_ALL_FAILED and preserves the message', () => {
    const err = new BatchAllFailedError('No se pudo generar ningún boletín del lote — todos fallaron');
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('BATCH_ALL_FAILED');
    expect(err.message).toBe('No se pudo generar ningún boletín del lote — todos fallaron');
  });
});
