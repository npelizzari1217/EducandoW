# Explore: evaluacion-terciario

> Fase: sdd-explore · Store: hybrid · 2026-06-17 · Feature nueva (no es slice del retiro de Teacher)

## Modelo Terciario actual
`packages/domain/src/terciario/`: `Carrera`, `MateriaCarrera` (carreraId, subjectId, anio, cuatrimestre ANUAL/1C/2C [deprecado], regimen PROMOCIONAL/REGULAR/LIBRE), `InscripcionMateria` (estado, **notaCursada?/notaFinal? como floats crudos, sin estructura interna**), `ActaExamen` (final formal: presidenteId=User.id tras S3b-3, vocales, libro/folio) + `ActaExamenNota` (studentId, nota, condicion APROBADO/DESAPROBADO/AUSENTE — **sin contador de intentos**), `Correlatividad`, `Titulo`.

Authz hoy: solo `@Roles({module:'GRADES'})` + `@Levels(TERCIARIO)`. Sin DocenteXCiclo.

## Dominio Terciario (del product owner)
Por materia (bimestral/cuatrimestral): **2 parciales + 1 TP obligatorio para aprobar + recuperatorios de parciales + final con hasta 3 intentos** (si lo da mal). MesaExamen es de Secundario (no Terciario) — el final de Terciario es `ActaExamen` (ya existe).

## Gaps vs el flujo real
- Parciales / TP / recuperatorios: **no modelados** (solo el float notaCursada). → nueva entidad.
- Final con 3 intentos: ActaExamen/ActaExamenNota existen pero **sin contador `intento` ni enforcement del límite de 3**, ni guard de "REGULAR para rendir final", ni auto-transición a LIBRE.
- Boletín Terciario: cae al path legacy NotaTrimestral (tabla equivocada para Terciario → **boletín hoy vacío/roto**).
- El modelo nuevo (SubjectPeriodGrade/SubjectFinalGrade) excluye decada 4 y no encaja (Terciario es Carrera→MateriaCarrera, no CourseCycle).

## Modelo propuesto
1. **`NotaCursadaTerciario`** { inscripcionMateriaId, slot (PARCIAL_1/PARCIAL_2/RECUPERATORIO_PARCIAL_1/RECUPERATORIO_PARCIAL_2/TP), nota, condicion, fecha } — sub-notas de la cursada. notaCursada se computa o se confirma.
2. **`intento` en ActaExamenNota** (1|2|3) + enforcement: máx 3 DESAPROBADO/AUSENTE, guard REGULAR, auto-LIBRE al 3er fallo. Backfill intento=1 a filas existentes.
3. **`buildMateriasTerciario`** en el boletín (lee InscripcionMateria + NotaCursadaTerciario + ActaExamenNota por intento).

## Tamaño: XL → dividir en cambios
- **Fase A (evaluacion-terciario-cursada):** NotaCursadaTerciario + slots + entrada admin + tests. M.
- **Fase B (final-attempts):** intento en ActaExamenNota + enforcement 3 intentos + guards. S.
- **Fase C (boletin-terciario):** buildMateriasTerciario + rediseño template. M.
- **Fase D (docente-grade-entry):** authz de docente Terciario (bridge DocenteXCiclo o modelo paralelo). L. Diferible.
Recomendado: A+B juntas como primer cambio; C como segundo; D diferido.

## 10 decisiones de producto (antes de proponer)
PROMOCIONAL bypass del final; período bimestral vs cuatrimestral (hoy solo ANUAL/1C/2C); TP obligatorio bloquea final?; elegibilidad de recuperatorio (DESAPROBADO/AUSENTE?); cómputo de notaCursada (auto vs manual); condiciones de LIBRE; entrada por docente vs secretario; intento en Acta vs ActaNota (→ ActaNota); adoptar GradingPeriodDate?; tipo de documento del boletín (Analítico Cursada vs Final).

## Riesgos
- Boletín Terciario hoy roto/vacío (lee NotaTrimestral) — Fase C lo arregla; comunicar al PO.
- 10 decisiones abiertas — proponer sin resolverlas da un spec desalineado.
- Backfill intento=1 a ActaExamenNota existentes.
- Authz docente (Fase D) requiere decisión arquitectural (extender DocenteXCiclo a Terciario o modelo paralelo).

## Relación con retiro de Teacher
Cuando Terciario tenga su grading propio + boletín, deja de depender del legacy NotaTrimestral → habilita (junto con Inicial) dropear el legacy + tabla Teacher.

## Siguiente: resolver las 10 decisiones (al menos las de MVP) → sdd-propose por fase. Empezar por Fase A+B.
