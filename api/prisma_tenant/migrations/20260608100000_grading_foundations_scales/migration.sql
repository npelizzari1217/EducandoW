-- Migration: grading_foundations_scales
-- Purpose: Redesign GradeScale and GradeScaleValue — introduce GradeInternalStatus enum,
--          drop obsolete columns (minValue, maxValue, isConceptual, isApproved, numericValue).
-- Strategy: reemplazo limpio (truncate + alter). Notas snapshot se preserva.

-- 1. Create the new enum type
CREATE TYPE "GradeInternalStatus" AS ENUM ('APROBADO', 'NO_APROBADO', 'EN_PROCESO', 'LIBRE');

-- 2. Desvincular notas de los valores antes de TRUNCATE (FK opcional, snapshot histórico se preserva)
UPDATE "notas" SET "gradeScaleValueId" = NULL;

-- 3. Reemplazo limpio de valores y escalas (volumen despreciable en dev/staging)
TRUNCATE "grade_scale_values" CASCADE;
TRUNCATE "grade_scales" CASCADE;

-- 4. Drop columnas obsoletas de grade_scale_values
ALTER TABLE "grade_scale_values" DROP COLUMN IF EXISTS "isApproved";
ALTER TABLE "grade_scale_values" DROP COLUMN IF EXISTS "numericValue";

-- 5. Agregar nueva columna internalStatus (NOT NULL; tabla ya vacía por TRUNCATE)
ALTER TABLE "grade_scale_values" ADD COLUMN "internalStatus" "GradeInternalStatus" NOT NULL;

-- 6. Drop columnas obsoletas de grade_scales
ALTER TABLE "grade_scales" DROP COLUMN IF EXISTS "minValue";
ALTER TABLE "grade_scales" DROP COLUMN IF EXISTS "maxValue";
ALTER TABLE "grade_scales" DROP COLUMN IF EXISTS "isConceptual";
