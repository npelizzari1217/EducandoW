-- A docente can have MORE THAN ONE group in the same materia (e.g. group A / group B,
-- distinguished by name). Drop the (materia, docente) unique constraint.
DROP INDEX IF EXISTS "grupos_x_curso_x_materia_x_ciclo_materia_docente_key";
