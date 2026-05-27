import { PrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Seed all roles ────────────────────────────────────────
  const roles = [
    { id: 'r-root', name: 'ROOT', description: 'Super administrador — acceso total' },
    { id: 'r-admin', name: 'ADMIN', description: 'Administrador de institución' },
    { id: 'r-mgr', name: 'MANAGER', description: 'Gestor académico' },
    { id: 'r-teach', name: 'TEACHER', description: 'Docente' },
    { id: 'r-tutor', name: 'TUTOR', description: 'Padre/Madre/Tutor legal' },
    { id: 'r-student', name: 'STUDENT', description: 'Alumno' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: r,
      update: { description: r.description },
    });
  }
  console.log('✅ Roles seeded');

  // ── Seed modules ──────────────────────────────────────────
  const modules = [
    { id: 'm-inst', code: 'INSTITUTIONS', name: 'Instituciones' },
    { id: 'm-users', code: 'USERS', name: 'Usuarios' },
    { id: 'm-students', code: 'STUDENTS', name: 'Alumnos' },
    { id: 'm-teachers', code: 'TEACHERS', name: 'Docentes' },
    { id: 'm-subjects', code: 'SUBJECTS', name: 'Materias' },
    { id: 'm-courses', code: 'COURSES', name: 'Cursos' },
    { id: 'm-enrollments', code: 'ENROLLMENTS', name: 'Matrículas' },
    { id: 'm-grades', code: 'GRADES', name: 'Calificaciones' },
    { id: 'm-attendance', code: 'ATTENDANCE', name: 'Asistencia' },
    { id: 'm-reports', code: 'REPORTS', name: 'Reportes' },
  ];

  for (const m of modules) {
    await prisma.module.upsert({
      where: { code: m.code },
      create: m,
      update: { name: m.name },
    });
  }
  console.log('✅ Modules seeded');

  // ── Seed module actions ───────────────────────────────────
  const actions = [
    { id: 'a-read', code: 'READ', name: 'Leer' },
    { id: 'a-create', code: 'CREATE', name: 'Agregar' },
    { id: 'a-update', code: 'UPDATE', name: 'Modificar' },
    { id: 'a-delete', code: 'DELETE', name: 'Borrar' },
    { id: 'a-print', code: 'PRINT', name: 'Imprimir' },
  ];

  for (const a of actions) {
    await prisma.moduleAction.upsert({
      where: { code: a.code },
      create: a,
      update: { name: a.name },
    });
  }
  console.log('✅ Module actions seeded');

  // ── Seed role ↔ module assignments ────────────────────────
  const ALL_ACTIONS = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'];
  const ALL_MODULE_IDS = modules.map((m) => m.id);

  const roleModules: Record<string, { moduleIds: string[]; actions: string[] }> = {
    'r-root': {
      moduleIds: ALL_MODULE_IDS,
      actions: ALL_ACTIONS,
    },
    'r-admin': {
      moduleIds: ['m-inst', 'm-users', 'm-students', 'm-teachers', 'm-reports'],
      actions: ALL_ACTIONS,
    },
    'r-mgr': {
      moduleIds: ['m-students', 'm-subjects', 'm-courses', 'm-enrollments', 'm-grades', 'm-attendance'],
      actions: ALL_ACTIONS,
    },
    'r-teach': {
      moduleIds: ['m-students', 'm-grades', 'm-attendance'],
      actions: [],
    },
    'r-tutor': {
      moduleIds: ['m-students', 'm-grades', 'm-attendance'],
      actions: [],
    },
    'r-student': {
      moduleIds: ['m-students', 'm-grades'],
      actions: [],
    },
  };

  // TEACHER: students(READ), grades(CREATE,READ), attendance(CREATE,READ)
  const teacherActions: Record<string, string[]> = {
    'm-students': ['READ'],
    'm-grades': ['CREATE', 'READ'],
    'm-attendance': ['CREATE', 'READ'],
  };

  // TUTOR: students(READ), grades(READ), attendance(READ)
  const tutorActions: Record<string, string[]> = {
    'm-students': ['READ'],
    'm-grades': ['READ'],
    'm-attendance': ['READ'],
  };

  // STUDENT: students(READ), grades(READ)
  const studentActions: Record<string, string[]> = {
    'm-students': ['READ'],
    'm-grades': ['READ'],
  };

  // ADMIN: institutions(READ,UPDATE), users/students/teachers/reports keep ALL_ACTIONS
  const adminActions: Record<string, string[]> = {
    'm-inst': ['READ', 'UPDATE'],
  };

  const customActions: Record<string, Record<string, string[]>> = {
    'r-admin': adminActions,
    'r-teach': teacherActions,
    'r-tutor': tutorActions,
    'r-student': studentActions,
  };

  for (const [roleId, { moduleIds, actions: defaultActions }] of Object.entries(roleModules)) {
    const overwrite = customActions[roleId] ?? {};
    for (const moduleId of moduleIds) {
      const actions = overwrite[moduleId] ?? defaultActions;
      if (actions.length === 0) continue; // skip modules with no actions
      const id = `rm-${roleId}-${moduleId}`;
      await prisma.roleModule.upsert({
        where: { roleId_moduleId: { roleId, moduleId } },
        create: { id, roleId, moduleId, actions },
        update: { actions },
      });
    }
  }
  console.log('✅ Role ↔ Module assignments seeded');

  // ── Create ROOT user ──────────────────────────────────────
  const email = 'npelizzari@gmail.com';
  const password = '***REMOVED***';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('⚠️  ROOT user already exists. Updating password...');
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash: hashed, name: 'ROOT' },
    });
    // Ensure the user has the ROOT role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: 'r-root' } },
      create: { userId: existing.id, roleId: 'r-root' },
      update: {},
    });
  } else {
    console.log('🔐 Creating ROOT user...');
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        name: 'ROOT',
        userRoles: {
          create: { roleId: 'r-root' },
        },
      },
    });
  }

  console.log('✅ ROOT user ready: npelizzari@gmail.com');
  console.log('   Roles: ROOT — acceso total al sistema');
  console.log('   Solo ROOT puede crear/eliminar instituciones');

  // ── Garantizar niveles para instituciones activas ────────
  await ensureInstitutionLevels(prisma);
}

export async function seedAttendanceStatuses(prisma: TenantPrismaClient) {
  const statuses = [
    { code: 'PRE', description: 'Presente', absenceValue: 0, isPresent: true },
    { code: 'AUS', description: 'Ausente', absenceValue: 1, isPresent: false },
    { code: 'TAR', description: 'Llegada Tarde', absenceValue: 0.5, isPresent: false },
    { code: 'JUS', description: 'Justificado', absenceValue: 0, isPresent: true },
    { code: 'RET', description: 'Retiro Anticipado', absenceValue: 0.5, isPresent: false },
  ];

  for (const s of statuses) {
    await prisma.attendanceStatus.upsert({
      where: { code: s.code },
      create: s,
      update: { description: s.description, absenceValue: s.absenceValue, isPresent: s.isPresent },
    });
  }

  console.log('✅ Attendance statuses seeded');
}

// ── Ensure every active institution has at least one level ──────
export async function ensureInstitutionLevels(prisma: PrismaClient) {
  const missing: { id: string }[] = await prisma.$queryRawUnsafe(`
    SELECT i.id
    FROM institutions i
    LEFT JOIN institution_levels il ON il.institution_id = i.id
    WHERE i.active = true AND il.id IS NULL
  `);

  if (missing.length === 0) {
    console.log('✅ All active institutions already have levels');
    return;
  }

  for (const row of missing) {
    await prisma.institutionLevel.upsert({
      where: {
        institutionId_level_modality: {
          institutionId: row.id,
          level: 2,   // Primario
          modality: 0, // Común
        },
      },
      create: {
        institutionId: row.id,
        level: 2,
        modality: 0,
      },
      update: {}, // no-op — ya existe, no hacer nada
    });
  }

  console.log(`✅ Assigned Primario Común (level=2) to ${missing.length} institution(s)`);
}

export async function seedGradeScales(prisma: TenantPrismaClient) {
  // ── Primario (level=2, modality=0) — Numérica 1-10 ────
  await prisma.gradeScale.upsert({
    where: { level_modality_name: { level: 2, modality: 0, name: 'Primaria Numérica' } },
    create: {
      id: 'gs-primaria',
      name: 'Primaria Numérica',
      level: 2,
      modality: 0,
      minValue: 1,
      maxValue: 10,
      isConceptual: false,
    },
    update: { minValue: 1, maxValue: 10 },
  });

  const primariaValues = [
    { scaleId: 'gs-primaria', code: '10', label: 'Excelente (10)', numericValue: 10, isApproved: true, sortOrder: 10 },
    { scaleId: 'gs-primaria', code: '9', label: 'Muy Bueno (9)', numericValue: 9, isApproved: true, sortOrder: 9 },
    { scaleId: 'gs-primaria', code: '8', label: 'Muy Bueno (8)', numericValue: 8, isApproved: true, sortOrder: 8 },
    { scaleId: 'gs-primaria', code: '7', label: 'Bueno (7)', numericValue: 7, isApproved: true, sortOrder: 7 },
    { scaleId: 'gs-primaria', code: '6', label: 'Bueno (6)', numericValue: 6, isApproved: true, sortOrder: 6 },
    { scaleId: 'gs-primaria', code: '5', label: 'Regular (5)', numericValue: 5, isApproved: false, sortOrder: 5 },
    { scaleId: 'gs-primaria', code: '4', label: 'Regular (4)', numericValue: 4, isApproved: false, sortOrder: 4 },
    { scaleId: 'gs-primaria', code: '3', label: 'Insuficiente (3)', numericValue: 3, isApproved: false, sortOrder: 3 },
    { scaleId: 'gs-primaria', code: '2', label: 'Insuficiente (2)', numericValue: 2, isApproved: false, sortOrder: 2 },
    { scaleId: 'gs-primaria', code: '1', label: 'Insuficiente (1)', numericValue: 1, isApproved: false, sortOrder: 1 },
  ];

  for (const v of primariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: v,
    });
  }
  console.log('✅ Primaria grade scale seeded');

  // ── Inicial (level=1, modality=0) — Cualitativa ────────
  await prisma.gradeScale.upsert({
    where: { level_modality_name: { level: 1, modality: 0, name: 'Inicial Cualitativa' } },
    create: {
      id: 'gs-inicial',
      name: 'Inicial Cualitativa',
      level: 1,
      modality: 0,
      isConceptual: true,
    },
    update: { isConceptual: true },
  });

  const inicialValues = [
    { scaleId: 'gs-inicial', code: 'DESTACADO', label: 'Destacado', isApproved: true, sortOrder: 3 },
    { scaleId: 'gs-inicial', code: 'LOGRADO', label: 'Logrado', isApproved: true, sortOrder: 2 },
    { scaleId: 'gs-inicial', code: 'EN_PROCESO', label: 'En Proceso', isApproved: false, sortOrder: 1 },
  ];

  for (const v of inicialValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: v,
    });
  }
  console.log('✅ Inicial grade scale seeded');

  // ── Secundario (level=3, modality=0) — Numérica 1-10 ───
  await prisma.gradeScale.upsert({
    where: { level_modality_name: { level: 3, modality: 0, name: 'Secundaria Numérica' } },
    create: {
      id: 'gs-secundaria',
      name: 'Secundaria Numérica',
      level: 3,
      modality: 0,
      minValue: 1,
      maxValue: 10,
      isConceptual: false,
    },
    update: { minValue: 1, maxValue: 10 },
  });

  const secundariaValues = [
    { scaleId: 'gs-secundaria', code: '10', label: 'Excelente (10)', numericValue: 10, isApproved: true, sortOrder: 10 },
    { scaleId: 'gs-secundaria', code: '9', label: 'Muy Bueno (9)', numericValue: 9, isApproved: true, sortOrder: 9 },
    { scaleId: 'gs-secundaria', code: '8', label: 'Muy Bueno (8)', numericValue: 8, isApproved: true, sortOrder: 8 },
    { scaleId: 'gs-secundaria', code: '7', label: 'Bueno (7)', numericValue: 7, isApproved: true, sortOrder: 7 },
    { scaleId: 'gs-secundaria', code: '6', label: 'Bueno (6)', numericValue: 6, isApproved: true, sortOrder: 6 },
    { scaleId: 'gs-secundaria', code: '5', label: 'Regular (5)', numericValue: 5, isApproved: false, sortOrder: 5 },
    { scaleId: 'gs-secundaria', code: '4', label: 'Regular (4)', numericValue: 4, isApproved: false, sortOrder: 4 },
    { scaleId: 'gs-secundaria', code: '3', label: 'Insuficiente (3)', numericValue: 3, isApproved: false, sortOrder: 3 },
    { scaleId: 'gs-secundaria', code: '2', label: 'Insuficiente (2)', numericValue: 2, isApproved: false, sortOrder: 2 },
    { scaleId: 'gs-secundaria', code: '1', label: 'Insuficiente (1)', numericValue: 1, isApproved: false, sortOrder: 1 },
  ];

  for (const v of secundariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: v,
    });
  }
  console.log('✅ Secundaria grade scale seeded');

  // ── Terciario (level=4, modality=0) — Numérica 1-10 ────
  await prisma.gradeScale.upsert({
    where: { level_modality_name: { level: 4, modality: 0, name: 'Terciaria Numérica' } },
    create: {
      id: 'gs-terciaria',
      name: 'Terciaria Numérica',
      level: 4,
      modality: 0,
      minValue: 1,
      maxValue: 10,
      isConceptual: false,
    },
    update: { minValue: 1, maxValue: 10 },
  });

  const terciariaValues = [
    { scaleId: 'gs-terciaria', code: '10', label: 'Excelente (10)', numericValue: 10, isApproved: true, sortOrder: 10 },
    { scaleId: 'gs-terciaria', code: '9', label: 'Muy Bueno (9)', numericValue: 9, isApproved: true, sortOrder: 9 },
    { scaleId: 'gs-terciaria', code: '8', label: 'Muy Bueno (8)', numericValue: 8, isApproved: true, sortOrder: 8 },
    { scaleId: 'gs-terciaria', code: '7', label: 'Bueno (7)', numericValue: 7, isApproved: true, sortOrder: 7 },
    { scaleId: 'gs-terciaria', code: '6', label: 'Bueno (6)', numericValue: 6, isApproved: true, sortOrder: 6 },
    { scaleId: 'gs-terciaria', code: '5', label: 'Regular (5)', numericValue: 5, isApproved: false, sortOrder: 5 },
    { scaleId: 'gs-terciaria', code: '4', label: 'Regular (4)', numericValue: 4, isApproved: false, sortOrder: 4 },
    { scaleId: 'gs-terciaria', code: '3', label: 'Insuficiente (3)', numericValue: 3, isApproved: false, sortOrder: 3 },
    { scaleId: 'gs-terciaria', code: '2', label: 'Insuficiente (2)', numericValue: 2, isApproved: false, sortOrder: 2 },
    { scaleId: 'gs-terciaria', code: '1', label: 'Insuficiente (1)', numericValue: 1, isApproved: false, sortOrder: 1 },
  ];

  for (const v of terciariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: v,
    });
  }
  console.log('✅ Terciaria grade scale seeded');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
