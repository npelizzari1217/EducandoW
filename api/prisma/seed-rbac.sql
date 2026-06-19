-- ============================================================================
-- RBAC Seed: Roles, Modules, Actions y Role→Module assignments
-- ============================================================================

-- Roles
INSERT INTO roles (id, name, description) VALUES
  ('r-root', 'ROOT', 'Super administrador — acceso total'),
  ('r-admin', 'ADMIN', 'Administrador de institución'),
  ('r-mgr', 'MANAGER', 'Gestor académico'),
  ('r-teach', 'TEACHER', 'Docente'),
  ('r-tutor', 'TUTOR', 'Padre/Madre/Tutor legal'),
  ('r-student', 'STUDENT', 'Alumno'),
  ('r-director', 'DIRECTOR', 'Directivo'),
  ('r-secretario', 'SECRETARIO', 'Secretario'),
  ('r-preceptor', 'PRECEPTOR', 'Preceptor');

-- Modules
INSERT INTO modules (id, code, name, "updatedAt") VALUES
  ('m-inst', 'INSTITUTIONS', 'Instituciones', NOW()),
  ('m-users', 'USERS', 'Usuarios', NOW()),
  ('m-students', 'STUDENTS', 'Alumnos', NOW()),
  ('m-teachers', 'TEACHERS', 'Docentes', NOW()),
  ('m-subjects', 'SUBJECTS', 'Materias', NOW()),
  ('m-courses', 'COURSES', 'Cursos', NOW()),
  ('m-enrollments', 'ENROLLMENTS', 'Matrículas', NOW()),
  ('m-grades', 'GRADES', 'Calificaciones', NOW()),
  ('m-attendance', 'ATTENDANCE', 'Asistencia', NOW()),
  ('m-reports', 'REPORTS', 'Reportes', NOW()),
  ('m-study-plans', 'STUDY_PLANS', 'Planes de estudio', NOW()),
  ('m-classrooms', 'CLASSROOMS', 'Salas y aulas', NOW());

-- Actions
INSERT INTO module_actions (id, code, name, "updatedAt") VALUES
  ('a-read', 'READ', 'Leer', NOW()),
  ('a-create', 'CREATE', 'Agregar', NOW()),
  ('a-update', 'UPDATE', 'Modificar', NOW()),
  ('a-delete', 'DELETE', 'Borrar', NOW()),
  ('a-print', 'PRINT', 'Imprimir', NOW());

-- ROOT: all modules, all actions
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-root-m-inst', 'r-root', 'm-inst', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-users', 'r-root', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-students', 'r-root', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-teachers', 'r-root', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-subjects', 'r-root', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-courses', 'r-root', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-enrollments', 'r-root', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-grades', 'r-root', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-attendance', 'r-root', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-reports', 'r-root', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-study-plans', 'r-root', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-root-m-classrooms', 'r-root', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- ADMIN: institutions, users, students, teachers, reports, study_plans, classrooms (full)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-admin-m-inst', 'r-admin', 'm-inst', ARRAY['READ','UPDATE']),
  ('rm-r-admin-m-users', 'r-admin', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-students', 'r-admin', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-teachers', 'r-admin', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-reports', 'r-admin', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-study-plans', 'r-admin', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-classrooms', 'r-admin', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- MANAGER: students, subjects, courses, enrollments, grades, attendance, study_plans, classrooms (full)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-mgr-m-students', 'r-mgr', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-subjects', 'r-mgr', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-courses', 'r-mgr', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-enrollments', 'r-mgr', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-grades', 'r-mgr', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-attendance', 'r-mgr', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-study-plans', 'r-mgr', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-classrooms', 'r-mgr', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- TEACHER: students(READ), grades(CREATE,READ), attendance(CREATE,READ), classrooms(READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-teach-m-students', 'r-teach', 'm-students', ARRAY['READ']),
  ('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ','UPDATE']),
  ('rm-r-teach-m-attendance', 'r-teach', 'm-attendance', ARRAY['CREATE','READ']),
  ('rm-r-teach-m-classrooms', 'r-teach', 'm-classrooms', ARRAY['READ']);

-- TUTOR: grades(READ), attendance(READ), students(READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-tutor-m-grades', 'r-tutor', 'm-grades', ARRAY['READ']),
  ('rm-r-tutor-m-attendance', 'r-tutor', 'm-attendance', ARRAY['READ']),
  ('rm-r-tutor-m-students', 'r-tutor', 'm-students', ARRAY['READ']);

-- STUDENT: grades(READ), students(READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-student-m-grades', 'r-student', 'm-grades', ARRAY['READ']),
  ('rm-r-student-m-students', 'r-student', 'm-students', ARRAY['READ']);

-- DIRECTOR: all 12 modules, all actions
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-director-m-inst', 'r-director', 'm-inst', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-users', 'r-director', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-students', 'r-director', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-teachers', 'r-director', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-subjects', 'r-director', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-courses', 'r-director', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-enrollments', 'r-director', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-grades', 'r-director', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-attendance', 'r-director', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-reports', 'r-director', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-study-plans', 'r-director', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-director-m-classrooms', 'r-director', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- SECRETARIO: students, enrollments, attendance, grades, reports, classrooms (all actions)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-secretario-m-students', 'r-secretario', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-secretario-m-enrollments', 'r-secretario', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-secretario-m-attendance', 'r-secretario', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-secretario-m-grades', 'r-secretario', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-secretario-m-reports', 'r-secretario', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-secretario-m-classrooms', 'r-secretario', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- PRECEPTOR: students(READ), attendance(CREATE,READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-preceptor-m-students', 'r-preceptor', 'm-students', ARRAY['READ']),
  ('rm-r-preceptor-m-attendance', 'r-preceptor', 'm-attendance', ARRAY['CREATE','READ']);

-- ============================================================================
-- Profiles: Permission Templates
-- ============================================================================

-- Profiles
INSERT INTO profiles (id, name) VALUES
  ('p-admin', 'Administrador'),
  ('p-teacher', 'Docente'),
  ('p-preceptor', 'Preceptor');

-- Administrador: todos los módulos, todos los permisos
INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint") VALUES
  ('pp-admin-inst', 'p-admin', 'm-inst', true, true, true, true, true),
  ('pp-admin-users', 'p-admin', 'm-users', true, true, true, true, true),
  ('pp-admin-students', 'p-admin', 'm-students', true, true, true, true, true),
  ('pp-admin-teachers', 'p-admin', 'm-teachers', true, true, true, true, true),
  ('pp-admin-subjects', 'p-admin', 'm-subjects', true, true, true, true, true),
  ('pp-admin-courses', 'p-admin', 'm-courses', true, true, true, true, true),
  ('pp-admin-enrollments', 'p-admin', 'm-enrollments', true, true, true, true, true),
  ('pp-admin-grades', 'p-admin', 'm-grades', true, true, true, true, true),
  ('pp-admin-attendance', 'p-admin', 'm-attendance', true, true, true, true, true),
  ('pp-admin-reports', 'p-admin', 'm-reports', true, true, true, true, true),
  ('pp-admin-study-plans', 'p-admin', 'm-study-plans', true, true, true, true, true),
  ('pp-admin-classrooms', 'p-admin', 'm-classrooms', true, true, true, true, true);

-- Docente: STUDENTS(READ), TEACHERS(READ), GRADES(READ,CREATE,UPDATE), ATTENDANCE(READ,CREATE,UPDATE), REPORTS(READ), COURSES(READ), SUBJECTS(READ), CLASSROOMS(READ)
INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint") VALUES
  ('pp-teacher-students', 'p-teacher', 'm-students', true, false, false, false, false),
  ('pp-teacher-teachers', 'p-teacher', 'm-teachers', true, false, false, false, false),
  ('pp-teacher-grades', 'p-teacher', 'm-grades', true, true, true, false, false),
  ('pp-teacher-attendance', 'p-teacher', 'm-attendance', true, true, true, false, false),
  ('pp-teacher-reports', 'p-teacher', 'm-reports', true, false, false, false, false),
  ('pp-teacher-courses', 'p-teacher', 'm-courses', true, false, false, false, false),
  ('pp-teacher-subjects', 'p-teacher', 'm-subjects', true, false, false, false, false),
  ('pp-teacher-classrooms', 'p-teacher', 'm-classrooms', true, false, false, false, false);

-- Preceptor: STUDENTS(READ), ATTENDANCE(READ,CREATE,UPDATE), COURSES(READ)
INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint") VALUES
  ('pp-preceptor-students', 'p-preceptor', 'm-students', true, false, false, false, false),
  ('pp-preceptor-attendance', 'p-preceptor', 'm-attendance', true, true, true, false, false),
  ('pp-preceptor-courses', 'p-preceptor', 'm-courses', true, false, false, false, false);
