-- =============================================================================
-- 0025_media_insumos_instrucciones.sql
-- Instrucciones de insumos por pieza (editables por CT desde admin, visibles
-- para el cliente en /portal/media).
-- Aditiva e idempotente: solo ADD COLUMN IF NOT EXISTS + COMMENT.
-- Reutiliza la columna existente insumos_notas (0012, sin uso previo) como
-- texto de instrucciones. No cambia policies, grants ni datos existentes.
-- =============================================================================

BEGIN;

ALTER TABLE sponsorhub.media_assets_ejecutados
  ADD COLUMN IF NOT EXISTS insumos_formato text;

ALTER TABLE sponsorhub.media_assets_ejecutados
  ADD COLUMN IF NOT EXISTS insumos_fecha_limite date;

COMMENT ON COLUMN sponsorhub.media_assets_ejecutados.insumos_notas IS
  'Instrucciones para el cliente: qué archivos necesita CT para esta pieza. Editable por admin.';
COMMENT ON COLUMN sponsorhub.media_assets_ejecutados.insumos_formato IS
  'Formato(s) aceptado(s) de los insumos, texto libre (ej. "PDF o PNG, mín. 1080 px"). Editable por admin.';
COMMENT ON COLUMN sponsorhub.media_assets_ejecutados.insumos_fecha_limite IS
  'Fecha límite para que el cliente entregue los insumos. NULL = sin fecha.';

COMMIT;
