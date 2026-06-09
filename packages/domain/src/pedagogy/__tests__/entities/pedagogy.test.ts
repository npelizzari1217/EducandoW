import { describe, it, expect } from 'vitest';
import { Id } from '../../../shared/value-objects/id';
import { EducationalLevelCode } from '../../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../../shared/value-objects/educational-modality';
import { Level, LevelType } from '../../../institution/value-objects/level';

// Test entities from pedagogy context
import { StudyPlan } from '../../../pedagogy/entities/study-plan';
import { Subject } from '../../../pedagogy/entities/subject';
import { CourseSection } from '../../../pedagogy/entities/course-section';
import { SubjectAssignment } from '../../../pedagogy/entities/subject-assignment';
import { Evaluacion } from '../../../pedagogy/entities/evaluacion';
import { Nota } from '../../../pedagogy/entities/nota';
import { PeriodoEvaluacion } from '../../../pedagogy/entities/periodo-evaluacion';
import { NotaTrimestral } from '../../../pedagogy/entities/nota-trimestral';
import { Attendance } from '../../../pedagogy/entities/attendance';
// GradeScale and GradeScaleValue moved to grading/__tests__/entities/ — grading-foundations

describe('StudyPlan', () => {
  it('creates with name, level, modality and optional cycleUuid', () => {
    const p = StudyPlan.create({
      name: 'Plan Primario',
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
      cycleUuid: 'cycle-uuid-1',
    });
    expect(p.name).toBe('Plan Primario');
    expect(p.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(p.modality).toBe(EducationalModalityCode.COMUN);
    expect(p.cycleUuid).toBe('cycle-uuid-1');
    expect(p.active).toBe(true);
    expect(p.id.get()).toBeDefined();
  });

  it('creates without cycleUuid (nullable)', () => {
    const p = StudyPlan.create({
      name: 'Plan Sin Ciclo',
      level: EducationalLevelCode.PRIMARIO,
      modality: EducationalModalityCode.COMUN,
    });
    expect(p.cycleUuid).toBeUndefined();
    expect(p.active).toBe(true);
  });

  it('reconstruct preserves all fields', () => {
    const id = Id.reconstruct('plan-1');
    const now = new Date('2026-01-01');
    const p = StudyPlan.reconstruct({
      id,
      name: 'Plan Secundario',
      level: EducationalLevelCode.SECUNDARIO,
      modality: EducationalModalityCode.TALLERES,
      cycleUuid: 'cycle-abc',
      active: false,
      createdAt: now,
      updatedAt: now,
    });
    expect(p.id.get()).toBe('plan-1');
    expect(p.level).toBe(EducationalLevelCode.SECUNDARIO);
    expect(p.modality).toBe(EducationalModalityCode.TALLERES);
    expect(p.cycleUuid).toBe('cycle-abc');
    expect(p.active).toBe(false);
  });

  it('changeLevel updates level and modality', () => {
    const p = StudyPlan.create({
      name: 'Plan Inicial',
      level: EducationalLevelCode.INICIAL,
      modality: EducationalModalityCode.COMUN,
    });
    const prevUpdatedAt = p.updatedAt;

    p.changeLevel(EducationalLevelCode.PRIMARIO, EducationalModalityCode.TALLERES);

    expect(p.level).toBe(EducationalLevelCode.PRIMARIO);
    expect(p.modality).toBe(EducationalModalityCode.TALLERES);
    expect(p.updatedAt.getTime()).toBeGreaterThanOrEqual(prevUpdatedAt.getTime());
  });
});

describe('Subject', () => {
  it('creates with name, level, institutionId', () => {
    const s = Subject.create({
      name: 'Matemática',
      level: Level.reconstruct(LevelType.SECUNDARIO),
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(s.name).toBe('Matemática');
    expect(s.level.get()).toBe(LevelType.SECUNDARIO);
    expect(s.institutionId.get()).toBe('inst-1');
  });
});

describe('CourseSection', () => {
  it('creates with academic year and optional grade/division', () => {
    const c = CourseSection.create({
      name: '3° A',
      grade: '3°',
      division: 'A',
      level: Level.reconstruct(LevelType.PRIMARIO),
      academicYear: '2025',
      institutionId: Id.reconstruct('inst-1'),
    });
    expect(c.name).toBe('3° A');
    expect(c.academicYear).toBe('2025');
    expect(c.grade).toBe('3°');
    expect(c.division).toBe('A');
  });
});

describe('SubjectAssignment', () => {
  it('links subject, teacher and course section', () => {
    const a = SubjectAssignment.create({ subjectId: 'subj-1', teacherId: 't-1', courseSectionId: 'cs-1' });
    expect(a.subjectId).toBe('subj-1');
    expect(a.teacherId).toBe('t-1');
    expect(a.courseSectionId).toBe('cs-1');
  });
});

describe('Evaluacion', () => {
  it('creates with assignment, title, date and weight', () => {
    const date = new Date('2026-06-15');
    const e = Evaluacion.create({ assignmentId: 'sa-1', title: 'Examen Parcial 1', description: 'Temas 1-4', evaluationDate: date, weight: 2 });
    expect(e.title).toBe('Examen Parcial 1');
    expect(e.weight).toBe(2);
    expect(e.evaluationDate).toEqual(date);
    expect(e.description).toBe('Temas 1-4');
  });

  it('defaults weight to 1 if not provided', () => {
    const e = Evaluacion.create({ assignmentId: 'sa-1', title: 'TP Integrador', evaluationDate: new Date() });
    expect(e.weight).toBe(1);
  });

  it('softDelete marks as inactive', () => {
    const e = Evaluacion.create({ assignmentId: 'sa-1', title: 'Test', evaluationDate: new Date() });
    expect(e.active).toBe(true);
    e.softDelete();
    expect(e.active).toBe(false);
    expect(e.deletedAt).toBeInstanceOf(Date);
  });
});

describe('Nota', () => {
  it('creates with evaluation, student, and numeric value', () => {
    const n = Nota.create({ evaluationId: 'ev-1', studentId: 's-1', numericValue: 8.5, qualitativeValue: 'Muy Bueno', comments: 'Buen trabajo' });
    expect(n.numericValue).toBe(8.5);
    expect(n.qualitativeValue).toBe('Muy Bueno');
    expect(n.comments).toBe('Buen trabajo');
    expect(n.studentId).toBe('s-1');
  });

  it('registeredAt is set automatically', () => {
    const n = Nota.create({ evaluationId: 'ev-1', studentId: 's-1' });
    expect(n.registeredAt).toBeInstanceOf(Date);
  });

  it('optional fields default to undefined', () => {
    const n = Nota.create({ evaluationId: 'ev-1', studentId: 's-1' });
    expect(n.numericValue).toBeUndefined();
    expect(n.qualitativeValue).toBeUndefined();
    expect(n.comments).toBeUndefined();
  });

  it('stores grade scale snapshot fields', () => {
    const n = Nota.reconstruct({
      id: Id.create(),
      evaluationId: 'ev-1',
      studentId: 's-1',
      registeredAt: new Date('2025-03-15'),
      gradeScaleValueId: 'gsv-10',
      gradeCode: '10',
      gradeLabel: 'Excelente (10)',
      isApproved: true,
    });
    expect(n.gradeScaleValueId).toBe('gsv-10');
    expect(n.gradeCode).toBe('10');
    expect(n.gradeLabel).toBe('Excelente (10)');
    expect(n.isApproved).toBe(true);
  });
});

describe('PeriodoEvaluacion', () => {
  it('creates with academic year and dates', () => {
    const start = new Date('2026-03-01');
    const end = new Date('2026-06-30');
    const p = PeriodoEvaluacion.create({ academicYear: '2026', name: 'Primer Trimestre', startDate: start, endDate: end });
    expect(p.name).toBe('Primer Trimestre');
    expect(p.academicYear).toBe('2026');
    expect(p.startDate).toEqual(start);
    expect(p.endDate).toEqual(end);
  });
});

describe('NotaTrimestral', () => {
  it('creates with student, assignment, period, and final grade', () => {
    const n = NotaTrimestral.create({ studentId: 's-1', assignmentId: 'sa-1', periodId: 'p-1', finalGrade: 7.5, attendancePct: 85 });
    expect(n.finalGrade).toBe(7.5);
    expect(n.attendancePct).toBe(85);
    expect(n.studentId).toBe('s-1');
    expect(n.assignmentId).toBe('sa-1');
    expect(n.periodId).toBe('p-1');
  });
});

describe('Attendance', () => {
  it('creates with status and optional note', () => {
    const now = new Date();
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: now, statusId: 'PRE' });
    expect(a.status).toBe('PRE');
    expect(a.date).toEqual(now);
    expect(a.note).toBeUndefined();
  });

  it('creates with note for justified', () => {
    const a = Attendance.create({ studentId: 's-1', courseSectionId: 'cs-1', date: new Date(), statusId: 'JUS', note: 'Certificado médico' });
    expect(a.note).toBe('Certificado médico');
  });

  it('reconstruct preserves all fields', () => {
    const id = Id.create();
    const date = new Date('2025-06-15');
    const a = Attendance.reconstruct({ id, studentId: 's-1', courseSectionId: 'cs-1', date, statusId: 'AUS', note: 'Sin aviso' });
    expect(a.status).toBe('AUS');
    expect(a.id.get()).toBe(id.get());
  });

  it('stores attendance snapshot fields', () => {
    const a = Attendance.reconstruct({
      id: Id.create(),
      studentId: 's-1',
      courseSectionId: 'cs-1',
      date: new Date('2025-06-15'),
      statusId: 'AUS',
      statusCode: 'AUS',
      statusDescription: 'Ausente',
      absenceValue: 1,
      isPresent: false,
    });
    expect(a.statusCode).toBe('AUS');
    expect(a.statusDescription).toBe('Ausente');
    expect(a.absenceValue).toBe(1);
    expect(a.isPresent).toBe(false);
  });
});

// GradeScale tests moved to grading/__tests__/entities/grade-scale.test.ts — grading-foundations
// GradeScaleValue tests moved to grading/__tests__/entities/grade-scale-value.test.ts — grading-foundations
