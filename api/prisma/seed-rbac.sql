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
  ('r-student', 'STUDENT', 'Alumno');

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
  ('m-reports', 'REPORTS', 'Reportes', NOW());

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
  ('rm-r-root-m-reports', 'r-root', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- ADMIN: institutions, users, students, teachers, reports (full)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-admin-m-inst', 'r-admin', 'm-inst', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-users', 'r-admin', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-students', 'r-admin', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-teachers', 'r-admin', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-admin-m-reports', 'r-admin', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- MANAGER: students, subjects, courses, enrollments, grades, attendance (full)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-mgr-m-students', 'r-mgr', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-subjects', 'r-mgr', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-courses', 'r-mgr', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-enrollments', 'r-mgr', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-grades', 'r-mgr', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']),
  ('rm-r-mgr-m-attendance', 'r-mgr', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']);

-- TEACHER: students(READ), grades(CREATE,READ), attendance(CREATE,READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-teach-m-students', 'r-teach', 'm-students', ARRAY['READ']),
  ('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ']),
  ('rm-r-teach-m-attendance', 'r-teach', 'm-attendance', ARRAY['CREATE','READ']);

-- TUTOR: grades(READ), attendance(READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-tutor-m-grades', 'r-tutor', 'm-grades', ARRAY['READ']),
  ('rm-r-tutor-m-attendance', 'r-tutor', 'm-attendance', ARRAY['READ']);

-- STUDENT: grades(READ)
INSERT INTO role_modules (id, role_id, module_id, actions) VALUES
  ('rm-r-student-m-grades', 'r-student', 'm-grades', ARRAY['READ']);
