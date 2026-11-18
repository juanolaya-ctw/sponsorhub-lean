-- =============================================================================
-- 0026_media_catalogo_insumos_checklist.sql
-- Checklist de insumos por defecto para cada tipo de asset del catálogo
-- (fuente: Notion "Assets — Media Táctica"). Un ítem por línea.
-- La pieza (media_assets_ejecutados.insumos_notas) puede sobrescribirlo; si
-- la pieza no tiene instrucciones, el portal muestra este checklist.
-- Aditiva e idempotente. Sin cambios de policies ni datos.
-- =============================================================================

BEGIN;

ALTER TABLE sponsorhub.media_assets_catalogo
  ADD COLUMN IF NOT EXISTS insumos_checklist text;

COMMENT ON COLUMN sponsorhub.media_assets_catalogo.insumos_checklist IS
  'Checklist por defecto de insumos que el cliente debe entregar (un ítem por línea). Editable por admin.';

COMMIT;
