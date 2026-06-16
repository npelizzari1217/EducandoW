# Decisiones resueltas (post-review specs/design)

Estas decisiones del usuario REFINAN y, donde contradicen, **prevalecen** sobre supuestos previos de las specs/design.

## D1 — Regeneración de un CursoXCiclo (aditiva + re-sync de definiciones)
Al volver a "Generar" un `CursoXCiclo` que ya fue generado:
- **Aditivo**: crea las `MateriaXCursoXCiclo` del plan que falten.
- **Re-sincroniza datos definitorios**: PUEDE actualizar/pisar las **descripciones de la materia y de las competencias** desde el plan (para corregir errores ya cargados).
- **Nunca** toca: **calificaciones** ni nada **asignado después de la generación** (grupos, alumnos en grupos, docentes asignados).
- (Corrige el supuesto previo de "rechazar la regeneración si ya hay datos".)

## D2 — Varios docentes por CursoXCiclo (asignación nivel curso)
- Se permite **más de un `DocenteXCiclo`** asignado a un mismo `CursoXCiclo`.
- **Sin restricción de turno**: `turno` es un atributo opcional/informativo, NO una constraint de unicidad. No importa si son preceptores u otros docentes.

## D3 — Carga de notas sin asignación a grupo (roles de gestión)
- **SECRETARIO / DIRECTOR / ADMIN** (y ROOT) pueden **cargar/editar notas y asistencia sin estar asignados a un grupo** — es su alcance de gestión (modelo de 3 puertas).
- El **docente común** SÍ necesita estar asignado al grupo/materia. La validación de escritura aplica solo a quienes no son rol de gestión.

## D4 — Docentes viejos sin usuario → se BORRAN
- En la migración `Teacher → User + DocenteXCiclo`, los `Teacher` con `userId` nulo (huérfanos, sin usuario vinculado) **se eliminan**. No se migran ni se crean usuarios automáticos.
- (Corrige el supuesto previo de "reportar y resolver a mano".)

## D5 — Retiro de tablas viejas → SDD aparte
- `Teacher` y `SubjectAssignment` **no se eliminan** en este cambio (otras tablas dependen de ellas: mesas/actas de examen, etc.).
- El retiro real es un **SDD posterior, separado**. Anotado como follow-up.
