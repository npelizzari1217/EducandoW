import { PrismaClient } from '@prisma/client';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { EducationalLevelCode, EducationalModalityCode } from '@educandow/domain';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Seed all roles ────────────────────────────────────────
  const roles = [
    { id: 'r-root', name: 'ROOT', description: 'Super administrador — acceso total' },
    { id: 'r-admin', name: 'ADMIN', description: 'Administrador de institución' },
    { id: 'r-director', name: 'DIRECTOR', description: 'Directivo' },
    { id: 'r-secretario', name: 'SECRETARIO', description: 'Secretario' },
    { id: 'r-preceptor', name: 'PRECEPTOR', description: 'Preceptor' },
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
    { id: 'm-course-cycles', code: 'COURSE_CYCLES', name: 'Cursos por Ciclo' },
    { id: 'm-enrollments', code: 'ENROLLMENTS', name: 'Matrículas' },
    { id: 'm-grades', code: 'GRADES', name: 'Calificaciones' },
    { id: 'm-attendance', code: 'ATTENDANCE', name: 'Asistencia' },
    { id: 'm-reports', code: 'REPORTS', name: 'Reportes' },
    { id: 'm-study-plans', code: 'STUDY_PLANS', name: 'Planes de estudio' },
    { id: 'm-classrooms', code: 'CLASSROOMS', name: 'Salas y aulas' },
    { id: 'm-attendance-types', code: 'ATTENDANCE_TYPES', name: 'Tipos de Asistencia' },
    { id: 'm-grading-config', code: 'GRADING_CONFIG', name: 'Configuración de Calificación' },
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
  // DIRECTOR and SECRETARIO have all modules except INSTITUTIONS (managed by ADMIN only)
  const DIRECTOR_MODULE_IDS = ALL_MODULE_IDS.filter((id) => id !== 'm-inst');

  // ── Seed profiles ───────────────────────────────────────
  const profiles = [
    { id: 'p-admin', name: 'Admin Completo' },
    { id: 'p-teacher', name: 'Docente Básico' },

  ];

  for (const p of profiles) {
    await prisma.profile.upsert({
      where: { id: p.id },
      create: p,
      update: { name: p.name },
    });
  }
  console.log('✅ Profiles seeded');

  // ── Seed profile permissions ────────────────────────────
  const profilePermissions: { id: string; profileId: string; moduleId: string; canRead: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canPrint: boolean }[] = [];

  // Admin Completo: all modules, all booleans true
  for (const mid of ALL_MODULE_IDS) {
    profilePermissions.push({
      id: `pp-admin-${mid}`,
      profileId: 'p-admin',
      moduleId: mid,
      canRead: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPrint: true,
    });
  }

  // Docente Básico: STUDENTS(READ), GRADES(READ,CREATE,UPDATE), ATTENDANCE(READ,CREATE,UPDATE)
  const teacherProfilePerms: Record<string, Partial<typeof profilePermissions[0]>> = {
    'm-students': { canRead: true },
    'm-grades': { canRead: true, canCreate: true, canEdit: true },
    'm-attendance': { canRead: true, canCreate: true, canEdit: true },
  };

  for (const [mid, perms] of Object.entries(teacherProfilePerms)) {
    profilePermissions.push({
      id: `pp-teacher-${mid}`,
      profileId: 'p-teacher',
      moduleId: mid,
      canRead: perms.canRead ?? false,
      canCreate: perms.canCreate ?? false,
      canEdit: perms.canEdit ?? false,
      canDelete: perms.canDelete ?? false,
      canPrint: perms.canPrint ?? false,
    });
  }

  for (const pp of profilePermissions) {
    await prisma.profileModulePermission.upsert({
      where: { profileId_moduleId: { profileId: pp.profileId, moduleId: pp.moduleId } },
      create: {
        id: pp.id,
        profileId: pp.profileId,
        moduleId: pp.moduleId,
        canRead: pp.canRead,
        canCreate: pp.canCreate,
        canEdit: pp.canEdit,
        canDelete: pp.canDelete,
        canPrint: pp.canPrint,
      },
      update: {
        canRead: pp.canRead,
        canCreate: pp.canCreate,
        canEdit: pp.canEdit,
        canDelete: pp.canDelete,
        canPrint: pp.canPrint,
      },
    });
  }
  console.log('✅ Profile permissions seeded');

  const roleModules: Record<string, { moduleIds: string[]; actions: string[] }> = {
    'r-root': {
      moduleIds: ALL_MODULE_IDS,
      actions: ALL_ACTIONS,
    },
    // ADMIN: todos los módulos, todas las acciones (gestiona la institución)
    'r-admin': {
      moduleIds: ALL_MODULE_IDS,
      actions: ALL_ACTIONS,
    },
    // DIRECTOR: todos los módulos EXCEPTO Instituciones, todas las acciones
    'r-director': {
      moduleIds: DIRECTOR_MODULE_IDS,
      actions: ALL_ACTIONS,
    },
    // SECRETARIO: idéntico a DIRECTOR (mismo alcance de módulos, scope de datos diferente)
    'r-secretario': {
      moduleIds: DIRECTOR_MODULE_IDS,
      actions: ALL_ACTIONS,
    },
    'r-preceptor': {
      moduleIds: ['m-students', 'm-attendance'],
      actions: [],
    },
    'r-teach': {
      moduleIds: ['m-students', 'm-grades', 'm-attendance', 'm-classrooms'],
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

  // TEACHER: students(READ), grades(CREATE,READ), attendance(CREATE,READ), classrooms(READ)
  const teacherActions: Record<string, string[]> = {
    'm-students': ['READ'],
    'm-grades': ['CREATE', 'READ'],
    'm-attendance': ['CREATE', 'READ'],
    'm-classrooms': ['READ'],
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

  // PRECEPTOR: students(READ), attendance(CREATE, READ)
  const preceptorActions: Record<string, string[]> = {
    'm-students': ['READ'],
    'm-attendance': ['CREATE', 'READ'],
  };

  // ADMIN: tiene todos los módulos con ALL_ACTIONS, EXCEPTO Instituciones,
  // que se capa a READ/UPDATE/PRINT — crear/borrar instituciones es exclusivo de ROOT.
  const adminActions: Record<string, string[]> = {
    'm-inst': ['READ', 'UPDATE', 'PRINT'],
  };

  const customActions: Record<string, Record<string, string[]>> = {
    'r-admin': adminActions,
    'r-preceptor': preceptorActions,
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
  // Las credenciales ROOT deben estar definidas en el entorno.
  // Si faltan, el proceso falla de forma explícita (fail-fast).
  const email = process.env.ROOT_EMAIL;
  const password = process.env.ROOT_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Faltan variables de entorno requeridas: ROOT_EMAIL y/o ROOT_PASSWORD. ' +
        'Definilas en tu archivo .env antes de correr el seed.',
    );
  }

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

  console.log(`✅ ROOT user ready: ${email}`);
  console.log('   Roles: ROOT — acceso total al sistema');
  console.log('   Solo ROOT puede crear/eliminar instituciones');

  // ── Garantizar niveles para instituciones activas ────────
  await ensureInstitutionLevels(prisma);
}

/**
 * @deprecated attendance_statuses replaced by attendance_types (Batch 1 migration).
 * System types are now seeded per-level via seedSystemAttendanceTypes (Batch 3).
 */
export async function seedAttendanceStatuses(_prisma: TenantPrismaClient) {
  // No-op: attendance_statuses table no longer exists.
  // System attendance types (P, SAB, DOM, X) are created per educational level
  // by seedSystemAttendanceTypes() (implemented in Batch 3).
  console.log('ℹ️  seedAttendanceStatuses: skipped — replaced by seedSystemAttendanceTypes (Batch 3)');
}

/** System attendance types per educational level (P, SAB, DOM, X). */
const SYSTEM_ATTENDANCE_TYPES = [
  { code: 'P',   description: 'Presente',       isPresent: true,  absenceValue: 0, assignable: true  },
  { code: 'SAB', description: 'Sábado',          isPresent: false, absenceValue: 0, assignable: false },
  { code: 'DOM', description: 'Domingo',         isPresent: false, absenceValue: 0, assignable: false },
  { code: 'X',   description: 'Día no utilizado', isPresent: false, absenceValue: 0, assignable: false },
] as const;

/** Valid pedagogical levels (excludes ADMINISTRACION=9). */
const PEDAGOGICAL_LEVELS_CODES = [
  EducationalLevelCode.INICIAL,
  EducationalLevelCode.PRIMARIO,
  EducationalLevelCode.SECUNDARIO,
  EducationalLevelCode.TERCIARIO,
] as const;

/**
 * Upserts system attendance types (P, SAB, DOM, X) for each provided pedagogical level.
 * Idempotent: update:{} means it won't overwrite admin customizations.
 */
export async function seedSystemAttendanceTypes(
  prisma: TenantPrismaClient,
  levels?: readonly EducationalLevelCode[],
) {
  const targetLevels = (levels ?? PEDAGOGICAL_LEVELS_CODES).filter(
    (l) => l !== EducationalLevelCode.ADMINISTRACION,
  );

  for (const level of targetLevels) {
    for (const sysType of SYSTEM_ATTENDANCE_TYPES) {
      await prisma.attendanceType.upsert({
        where: { level_code: { level, code: sysType.code } },
        create: {
          level,
          code: sysType.code,
          description: sysType.description,
          absenceValue: sysType.absenceValue,
          isPresent: sysType.isPresent,
          assignable: sysType.assignable,
          isSystem: true,
          active: true,
        },
        update: {}, // no-op: never overwrite admin customizations
      });
    }
  }

  console.log(`✅ System attendance types seeded for levels: ${targetLevels.join(', ')}`);
}

// ── Ensure every active institution has at least one level ──────
export async function ensureInstitutionLevels(prisma: PrismaClient) {
  const institutionsWithoutLevels = await prisma.institution.findMany({
    where: {
      active: true,
      levels: { none: {} },
    },
    select: { id: true },
  });

  if (institutionsWithoutLevels.length === 0) {
    console.log('✅ All active institutions already have levels');
    return;
  }

  for (const row of institutionsWithoutLevels) {
    await prisma.institutionLevel.upsert({
      where: {
        institutionId_level_modality: {
          institutionId: row.id,
          level: EducationalLevelCode.PRIMARIO,
          modality: EducationalModalityCode.COMUN,
        },
      },
      create: {
        institutionId: row.id,
        level: EducationalLevelCode.PRIMARIO,
        modality: EducationalModalityCode.COMUN,
      },
      update: {}, // no-op — ya existe, no hacer nada
    });
  }

  console.log(`✅ Assigned Primario Común to ${institutionsWithoutLevels.length} institution(s)`);
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
    },
    update: {},
  });

  const primariaValues = [
    { scaleId: 'gs-primaria', code: '10', label: 'Excelente (10)', internalStatus: 'APROBADO' as const, sortOrder: 10 },
    { scaleId: 'gs-primaria', code: '9',  label: 'Muy Bueno (9)',  internalStatus: 'APROBADO' as const, sortOrder: 9  },
    { scaleId: 'gs-primaria', code: '8',  label: 'Muy Bueno (8)',  internalStatus: 'APROBADO' as const, sortOrder: 8  },
    { scaleId: 'gs-primaria', code: '7',  label: 'Bueno (7)',      internalStatus: 'APROBADO' as const, sortOrder: 7  },
    { scaleId: 'gs-primaria', code: '6',  label: 'Bueno (6)',      internalStatus: 'APROBADO' as const, sortOrder: 6  },
    { scaleId: 'gs-primaria', code: '5',  label: 'Regular (5)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 5 },
    { scaleId: 'gs-primaria', code: '4',  label: 'Regular (4)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 4 },
    { scaleId: 'gs-primaria', code: '3',  label: 'Insuficiente (3)', internalStatus: 'NO_APROBADO' as const, sortOrder: 3 },
    { scaleId: 'gs-primaria', code: '2',  label: 'Insuficiente (2)', internalStatus: 'NO_APROBADO' as const, sortOrder: 2 },
    { scaleId: 'gs-primaria', code: '1',  label: 'Insuficiente (1)', internalStatus: 'NO_APROBADO' as const, sortOrder: 1 },
  ];

  for (const v of primariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: { label: v.label, internalStatus: v.internalStatus, sortOrder: v.sortOrder },
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
    },
    update: {},
  });

  const inicialValues = [
    { scaleId: 'gs-inicial', code: 'DESTACADO',  label: 'Destacado',  internalStatus: 'APROBADO' as const,   sortOrder: 3 },
    { scaleId: 'gs-inicial', code: 'LOGRADO',    label: 'Logrado',    internalStatus: 'APROBADO' as const,   sortOrder: 2 },
    { scaleId: 'gs-inicial', code: 'EN_PROCESO', label: 'En Proceso', internalStatus: 'EN_PROCESO' as const, sortOrder: 1 },
  ];

  for (const v of inicialValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: { label: v.label, internalStatus: v.internalStatus, sortOrder: v.sortOrder },
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
    },
    update: {},
  });

  const secundariaValues = [
    { scaleId: 'gs-secundaria', code: '10', label: 'Excelente (10)', internalStatus: 'APROBADO' as const, sortOrder: 10 },
    { scaleId: 'gs-secundaria', code: '9',  label: 'Muy Bueno (9)',  internalStatus: 'APROBADO' as const, sortOrder: 9  },
    { scaleId: 'gs-secundaria', code: '8',  label: 'Muy Bueno (8)',  internalStatus: 'APROBADO' as const, sortOrder: 8  },
    { scaleId: 'gs-secundaria', code: '7',  label: 'Bueno (7)',      internalStatus: 'APROBADO' as const, sortOrder: 7  },
    { scaleId: 'gs-secundaria', code: '6',  label: 'Bueno (6)',      internalStatus: 'APROBADO' as const, sortOrder: 6  },
    { scaleId: 'gs-secundaria', code: '5',  label: 'Regular (5)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 5 },
    { scaleId: 'gs-secundaria', code: '4',  label: 'Regular (4)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 4 },
    { scaleId: 'gs-secundaria', code: '3',  label: 'Insuficiente (3)', internalStatus: 'NO_APROBADO' as const, sortOrder: 3 },
    { scaleId: 'gs-secundaria', code: '2',  label: 'Insuficiente (2)', internalStatus: 'NO_APROBADO' as const, sortOrder: 2 },
    { scaleId: 'gs-secundaria', code: '1',  label: 'Insuficiente (1)', internalStatus: 'NO_APROBADO' as const, sortOrder: 1 },
  ];

  for (const v of secundariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: { label: v.label, internalStatus: v.internalStatus, sortOrder: v.sortOrder },
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
    },
    update: {},
  });

  const terciariaValues = [
    { scaleId: 'gs-terciaria', code: '10', label: 'Excelente (10)', internalStatus: 'APROBADO' as const, sortOrder: 10 },
    { scaleId: 'gs-terciaria', code: '9',  label: 'Muy Bueno (9)',  internalStatus: 'APROBADO' as const, sortOrder: 9  },
    { scaleId: 'gs-terciaria', code: '8',  label: 'Muy Bueno (8)',  internalStatus: 'APROBADO' as const, sortOrder: 8  },
    { scaleId: 'gs-terciaria', code: '7',  label: 'Bueno (7)',      internalStatus: 'APROBADO' as const, sortOrder: 7  },
    { scaleId: 'gs-terciaria', code: '6',  label: 'Bueno (6)',      internalStatus: 'APROBADO' as const, sortOrder: 6  },
    { scaleId: 'gs-terciaria', code: '5',  label: 'Regular (5)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 5 },
    { scaleId: 'gs-terciaria', code: '4',  label: 'Regular (4)',    internalStatus: 'NO_APROBADO' as const, sortOrder: 4 },
    { scaleId: 'gs-terciaria', code: '3',  label: 'Insuficiente (3)', internalStatus: 'NO_APROBADO' as const, sortOrder: 3 },
    { scaleId: 'gs-terciaria', code: '2',  label: 'Insuficiente (2)', internalStatus: 'NO_APROBADO' as const, sortOrder: 2 },
    { scaleId: 'gs-terciaria', code: '1',  label: 'Insuficiente (1)', internalStatus: 'NO_APROBADO' as const, sortOrder: 1 },
  ];

  for (const v of terciariaValues) {
    await prisma.gradeScaleValue.upsert({
      where: { scaleId_code: { scaleId: v.scaleId, code: v.code } },
      create: { id: `${v.scaleId}-${v.code}`, ...v },
      update: { label: v.label, internalStatus: v.internalStatus, sortOrder: v.sortOrder },
    });
  }
  console.log('✅ Terciaria grade scale seeded');
}

export async function seedGradingPeriods(prisma: TenantPrismaClient) {
  const templates = [
    {
      id: 'gpt-primaria-bimestral',
      name: 'Bimestral',
      level: 2,
      modality: 0,
      items: [
        { id: 'gpti-primaria-b1', name: '1er Bimestre', sortOrder: 1 },
        { id: 'gpti-primaria-b2', name: '2do Bimestre', sortOrder: 2 },
        { id: 'gpti-primaria-b3', name: '3er Bimestre', sortOrder: 3 },
        { id: 'gpti-primaria-b4', name: '4to Bimestre', sortOrder: 4 },
      ],
    },
    {
      id: 'gpt-secundaria-trimestral',
      name: 'Trimestral',
      level: 3,
      modality: 0,
      items: [
        { id: 'gpti-secundaria-t1', name: '1° Trimestre', sortOrder: 1 },
        { id: 'gpti-secundaria-t2', name: '2° Trimestre', sortOrder: 2 },
        { id: 'gpti-secundaria-t3', name: '3° Trimestre', sortOrder: 3 },
      ],
    },
    {
      id: 'gpt-terciaria-cuatrimestral',
      name: 'Cuatrimestral',
      level: 4,
      modality: 0,
      items: [
        { id: 'gpti-terciaria-c1', name: '1° Cuatrimestre', sortOrder: 1 },
        { id: 'gpti-terciaria-c2', name: '2° Cuatrimestre', sortOrder: 2 },
      ],
    },
  ];

  for (const t of templates) {
    await prisma.gradingPeriodTemplate.upsert({
      where: { level_modality_name: { level: t.level, modality: t.modality, name: t.name } },
      create: { id: t.id, name: t.name, level: t.level, modality: t.modality },
      update: {},
    });

    for (const item of t.items) {
      await prisma.gradingPeriodTemplateItem.upsert({
        where: { templateId_sortOrder: { templateId: t.id, sortOrder: item.sortOrder } },
        create: { id: item.id, templateId: t.id, name: item.name, sortOrder: item.sortOrder },
        update: { name: item.name },
      });
    }

    console.log(`✅ Grading period template seeded: ${t.name} (level=${t.level})`);
  }
}

// Only run main() when executed directly (not imported)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
