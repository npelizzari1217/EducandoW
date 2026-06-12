-- ============================================================
-- EducandoW — Full system sync to production
-- Generado: 2026-06-04T15:43:50.966Z
-- Tablas: module_actions, modules, roles, role_modules,
--         profiles, profile_module_permissions
-- Uso: psql -U postgres -d educandow_master -f sync-system.sql
-- ============================================================

BEGIN;

-- 📦 module_actions (5)
INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")
VALUES ('a-create', 'CREATE', 'Agregar', true, '2026-05-25T13:59:06.174Z', '2026-06-03T17:51:32.105Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")
VALUES ('a-delete', 'DELETE', 'Borrar', true, '2026-05-25T13:59:06.180Z', '2026-06-03T17:51:32.112Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")
VALUES ('a-print', 'PRINT', 'Imprimir', true, '2026-05-25T13:59:06.182Z', '2026-06-03T17:51:32.115Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")
VALUES ('a-read', 'READ', 'Leer', true, '2026-05-25T13:59:06.169Z', '2026-06-03T17:51:32.101Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")
VALUES ('a-update', 'UPDATE', 'Modificar', true, '2026-05-25T13:59:06.177Z', '2026-06-03T17:51:32.108Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

-- 📦 modules (13)
INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-attendance', 'ATTENDANCE', 'Asistencia', true, '2026-05-25T13:59:06.159Z', '2026-06-03T17:51:32.087Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-classrooms', 'CLASSROOMS', 'Salas y aulas', true, '2026-06-01T12:46:00.580Z', '2026-06-03T17:51:32.096Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-courses', 'COURSES', 'Cursos', true, '2026-05-25T13:59:06.149Z', '2026-06-03T17:51:32.075Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-course-cycles', 'COURSE_CYCLES', 'Cursos por Ciclo', true, '2026-06-02T12:18:57.333Z', '2026-06-03T17:51:32.077Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-enrollments', 'ENROLLMENTS', 'Matrículas', true, '2026-05-25T13:59:06.153Z', '2026-06-03T17:51:32.080Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-grades', 'GRADES', 'Calificaciones', true, '2026-05-25T13:59:06.156Z', '2026-06-03T17:51:32.084Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-inst', 'INSTITUTIONS', 'Instituciones', true, '2026-05-25T13:59:06.131Z', '2026-06-03T17:51:32.054Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-reports', 'REPORTS', 'Reportes', true, '2026-05-25T13:59:06.162Z', '2026-06-03T17:51:32.090Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-students', 'STUDENTS', 'Alumnos', true, '2026-05-25T13:59:06.141Z', '2026-06-03T17:51:32.062Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-study-plans', 'STUDY_PLANS', 'Planes de estudio', true, '2026-06-01T12:46:00.576Z', '2026-06-03T17:51:32.093Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-subjects', 'SUBJECTS', 'Materias', true, '2026-05-25T13:59:06.147Z', '2026-06-03T17:51:32.071Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-teachers', 'TEACHERS', 'Docentes', true, '2026-05-25T13:59:06.144Z', '2026-06-03T17:51:32.066Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")
VALUES ('m-users', 'USERS', 'Usuarios', true, '2026-05-25T13:59:06.137Z', '2026-06-03T17:51:32.058Z')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

-- 📦 roles (9)
INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-admin', 'ADMIN', 'Administrador de institución', true, '2026-05-25T13:05:27.065Z', '2026-06-03T17:51:32.023Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-director', 'DIRECTOR', 'Directivo', true, '2026-05-31T19:31:35.762Z', '2026-06-03T17:51:32.026Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-mgr', 'MANAGER', 'Gestor académico', true, '2026-05-25T13:05:27.065Z', '2026-06-03T17:51:32.039Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-preceptor', 'PRECEPTOR', 'Preceptor', true, '2026-05-31T19:31:35.770Z', '2026-06-03T17:51:32.034Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-root', 'ROOT', 'Super administrador — acceso total', true, '2026-05-25T13:05:14.903Z', '2026-06-03T17:51:32.012Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-secretario', 'SECRETARIO', 'Secretario', true, '2026-05-31T19:31:35.766Z', '2026-06-03T17:51:32.030Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-student', 'STUDENT', 'Alumno', true, '2026-05-25T13:05:27.065Z', '2026-06-03T17:51:32.050Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-teach', 'TEACHER', 'Docente', true, '2026-05-25T13:05:27.065Z', '2026-06-03T17:51:32.042Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")
VALUES ('r-tutor', 'TUTOR', 'Padre/Madre/Tutor legal', true, '2026-05-25T13:05:27.065Z', '2026-06-03T17:51:32.045Z')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

-- 📦 role_modules (57)
INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-classrooms', 'r-admin', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-inst', 'r-admin', 'm-inst', ARRAY['READ','UPDATE']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-reports', 'r-admin', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-students', 'r-admin', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-study-plans', 'r-admin', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-teachers', 'r-admin', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-admin-m-users', 'r-admin', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-attendance', 'r-director', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-classrooms', 'r-director', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-courses', 'r-director', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-enrollments', 'r-director', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-grades', 'r-director', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-reports', 'r-director', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-students', 'r-director', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-study-plans', 'r-director', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-subjects', 'r-director', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-teachers', 'r-director', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-director-m-users', 'r-director', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-attendance', 'r-mgr', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-classrooms', 'r-mgr', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-courses', 'r-mgr', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-enrollments', 'r-mgr', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-grades', 'r-mgr', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-students', 'r-mgr', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-study-plans', 'r-mgr', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-mgr-m-subjects', 'r-mgr', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-preceptor-m-attendance', 'r-preceptor', 'm-attendance', ARRAY['CREATE','READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-preceptor-m-students', 'r-preceptor', 'm-students', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-attendance', 'r-root', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-classrooms', 'r-root', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-course-cycles', 'r-root', 'm-course-cycles', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-courses', 'r-root', 'm-courses', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-enrollments', 'r-root', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-grades', 'r-root', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-inst', 'r-root', 'm-inst', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-reports', 'r-root', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-students', 'r-root', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-study-plans', 'r-root', 'm-study-plans', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-subjects', 'r-root', 'm-subjects', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-teachers', 'r-root', 'm-teachers', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-root-m-users', 'r-root', 'm-users', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-attendance', 'r-secretario', 'm-attendance', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-classrooms', 'r-secretario', 'm-classrooms', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-enrollments', 'r-secretario', 'm-enrollments', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-grades', 'r-secretario', 'm-grades', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-reports', 'r-secretario', 'm-reports', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-secretario-m-students', 'r-secretario', 'm-students', ARRAY['READ','CREATE','UPDATE','DELETE','PRINT']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-student-m-grades', 'r-student', 'm-grades', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-student-m-students', 'r-student', 'm-students', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-teach-m-attendance', 'r-teach', 'm-attendance', ARRAY['CREATE','READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-teach-m-classrooms', 'r-teach', 'm-classrooms', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-teach-m-grades', 'r-teach', 'm-grades', ARRAY['CREATE','READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-teach-m-students', 'r-teach', 'm-students', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-tutor-m-attendance', 'r-tutor', 'm-attendance', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-tutor-m-grades', 'r-tutor', 'm-grades', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

INSERT INTO role_modules (id, "roleId", "moduleId", actions)
VALUES ('rm-r-tutor-m-students', 'r-tutor', 'm-students', ARRAY['READ']::text[])
ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;

-- 📦 profiles (5 activos, 3 test excluidos)
INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")
VALUES ('1c2980a2-8275-4347-8811-d26cf01a370c', 'Directivos', true, '2026-06-01T09:04:11.894Z', '2026-06-01T09:16:04.235Z')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")
VALUES ('523af9c7-12b8-458e-adeb-db482f879b3a', 'Secretarios', true, '2026-06-01T09:08:40.858Z', '2026-06-02T13:59:28.726Z')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")
VALUES ('ab6bd2ed-d8f3-44e9-83a8-989888ee294f', 'Docentes', true, '2026-06-01T09:08:43.636Z', '2026-06-01T09:15:37.035Z')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")
VALUES ('p-admin', 'Admin Completo', true, '2026-06-01T12:46:00.603Z', '2026-06-03T17:51:32.118Z')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")
VALUES ('p-teacher', 'Docente Básico', true, '2026-06-01T12:46:00.609Z', '2026-06-03T17:51:32.122Z')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";

-- 📦 profile_module_permissions (28 de perfiles activos)
INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('5bf60811-fe42-49e6-93af-c1d5ed6d0b8c', '1c2980a2-8275-4347-8811-d26cf01a370c', 'm-attendance', true, false, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('24f32087-78cc-4a5b-bd92-b9e334527189', '1c2980a2-8275-4347-8811-d26cf01a370c', 'm-courses', true, false, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('7f05ab59-4075-4213-9cd6-17ecc753331b', '1c2980a2-8275-4347-8811-d26cf01a370c', 'm-enrollments', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('507a2e13-17a3-47eb-9853-f3f6f85ecc77', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-attendance', false, false, false, true, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('e794fe11-522c-4441-b369-62f1e7999899', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-courses', false, false, false, true, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('e2365fca-8d18-464b-8418-541116dc33ee', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-enrollments', false, false, false, true, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('457194fe-df32-4cb3-bcd8-447ad7c26107', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-inst', false, true, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('bce71a7e-af4e-45d6-9952-568776fe5e33', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-reports', false, false, true, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('0c8fa8b3-8cf9-4bdc-8820-7a82d62f77e0', '523af9c7-12b8-458e-adeb-db482f879b3a', 'm-students', false, false, true, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('42c13e8a-6012-4e9d-b6cd-9c32618409a5', 'ab6bd2ed-d8f3-44e9-83a8-989888ee294f', 'm-attendance', false, true, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('f7c7ec82-b3bb-47af-a3ff-06eec444ad3d', 'ab6bd2ed-d8f3-44e9-83a8-989888ee294f', 'm-courses', false, true, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('0b172d18-80aa-4534-9f6c-766baa807e17', 'ab6bd2ed-d8f3-44e9-83a8-989888ee294f', 'm-enrollments', false, true, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('047188ee-a8cc-4086-872f-1d471ee2f151', 'p-admin', 'm-attendance', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-classrooms', 'p-admin', 'm-classrooms', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-course-cycles', 'p-admin', 'm-course-cycles', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('1259af3c-d895-451b-8140-5a013120929f', 'p-admin', 'm-courses', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-enrollments', 'p-admin', 'm-enrollments', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-grades', 'p-admin', 'm-grades', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-inst', 'p-admin', 'm-inst', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-reports', 'p-admin', 'm-reports', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-students', 'p-admin', 'm-students', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-study-plans', 'p-admin', 'm-study-plans', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-subjects', 'p-admin', 'm-subjects', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-teachers', 'p-admin', 'm-teachers', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-admin-m-users', 'p-admin', 'm-users', true, true, true, true, true)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-teacher-m-attendance', 'p-teacher', 'm-attendance', true, true, true, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-teacher-m-grades', 'p-teacher', 'm-grades', true, true, true, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")
VALUES ('pp-teacher-m-students', 'p-teacher', 'm-students', true, false, false, false, false)
ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";

COMMIT;
-- ✅ Verify:
-- SELECT code, name FROM modules ORDER BY code;
-- SELECT id, name FROM roles ORDER BY id;
-- SELECT id, name FROM profiles ORDER BY id;
