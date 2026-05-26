import { PrismaClient } from '@prisma/tenant-client';

const p = new PrismaClient();

async function main() {
  // Attendance statuses
  await p.attendanceStatus.createMany({
    data: [
      { code: 'PRE', description: 'Presente', absenceValue: 0, isPresent: true },
      { code: 'AUS', description: 'Ausente', absenceValue: 1, isPresent: false },
      { code: 'TAR', description: 'Llegada Tarde', absenceValue: 0.5, isPresent: false },
      { code: 'JUS', description: 'Justificado', absenceValue: 0, isPresent: true },
      { code: 'RET', description: 'Retiro Anticipado', absenceValue: 0.5, isPresent: false },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Statuses');

  // Grade scale
  const gs = await p.gradeScale.create({
    data: { name: 'Primaria Numérica', level: 2, modality: 0, minValue: 1, maxValue: 10, isConceptual: false },
  });
  await p.gradeScaleValue.createMany({
    data: [
      { scaleId: gs.id, code: '10', label: 'Excelente (10)', numericValue: 10, isApproved: true, sortOrder: 10 },
      { scaleId: gs.id, code: '8', label: 'Muy Bueno (8)', numericValue: 8, isApproved: true, sortOrder: 8 },
      { scaleId: gs.id, code: '6', label: 'Bueno (6)', numericValue: 6, isApproved: true, sortOrder: 6 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Grade scale');

  // Student
  const stu = await p.student.create({
    data: {
      firstName: 'Juan', lastName: 'Pérez', dni: '40123456',
      email: 'juan@test.com', birthDate: new Date('2015-03-15'),
      guardianName: 'María Pérez', guardianPhone: '3511234567',
    },
  });
  console.log('✅ Student:', stu.id);

  // Academic cycle
  const cycle = await p.academicCycle.create({
    data: { name: 'Ciclo Lectivo 2026', level: 2, modality: 0, startDate: new Date('2026-03-01'), endDate: new Date('2026-12-15') },
  });
  console.log('✅ Cycle');

  // Enrollment
  await p.enrollment.create({
    data: {
      studentId: stu.id, cycleId: cycle.id,
      level: 2, modality: 0, academicYear: '2026',
      grade: '5to', division: 'A', status: 'ACTIVE',
    },
  });
  console.log('✅ Enrollment');

  // Subject
  const subj = await p.subject.create({ data: { name: 'Matemática', level: 2, modality: 0 } });
  console.log('✅ Subject');

  // Course section
  const cs = await p.courseSection.create({
    data: { name: '5to A', grade: '5to', division: 'A', level: 2, modality: 0, academicYear: '2026' },
  });
  console.log('✅ Course section');

  // Teacher
  const teacher = await p.teacher.create({
    data: { firstName: 'Carlos', lastName: 'García', dni: '20123456', email: 'carlos@test.com' },
  });
  console.log('✅ Teacher');

  // Subject assignment
  const assign = await p.subjectAssignment.create({
    data: { subjectId: subj.id, teacherId: teacher.id, courseSectionId: cs.id },
  });
  console.log('✅ Assignment');

  // Evaluacion + Nota
  const eval1 = await p.evaluacion.create({
    data: { assignmentId: assign.id, title: 'Examen Primer Trimestre', evaluationDate: new Date('2026-04-15'), weight: 1 },
  });
  const gsv = await p.gradeScaleValue.findFirst({ where: { scaleId: gs.id, code: '8' } });
  await p.nota.create({
    data: {
      evaluationId: eval1.id, studentId: stu.id,
      numericValue: 8, gradeCode: '8', gradeLabel: 'Muy Bueno (8)', isApproved: true,
      gradeScaleValueId: gsv?.id,
    },
  });
  console.log('✅ Nota');

  // Attendance
  const status = await p.attendanceStatus.findFirst({ where: { code: 'PRE' } });
  if (status) {
    await p.attendance.create({
      data: {
        studentId: stu.id, courseSectionId: cs.id, subjectId: subj.id, cycleId: cycle.id,
        date: new Date('2026-04-10'), statusId: status.id,
        statusCode: 'PRE', statusDescription: 'Presente', isPresent: true, absenceValue: 0,
      },
    });
    console.log('✅ Attendance');
  }

  console.log('🎉 TODO LISTO');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
