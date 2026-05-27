-- =============================================================================
-- Fix: Asegurar niveles educativos para instituciones activas
-- =============================================================================
-- Contexto: Si institution_levels está vacío para una institución activa,
-- todos los ítems del menú con requiresLevel=true se ocultan.
-- Este fix asigna Primario Común (level=2, modality=0) como default.
-- Es idempotente — solo inserta si no hay ningún nivel configurado.
-- =============================================================================
INSERT INTO institution_levels (id, institution_id, level, modality, created_at, updated_at)
SELECT
  gen_random_uuid(),
  i.id,
  2,  -- Primario
  0,  -- Común
  NOW(),
  NOW()
FROM institutions i
LEFT JOIN institution_levels il ON il.institution_id = i.id
WHERE i.active = true AND il.id IS NULL;
