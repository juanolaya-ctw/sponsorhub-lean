-- ============================================================
-- 0014_sponsor_ct_media.sql
--
-- CT Media solo debe verse en el portal de sponsors marcados
-- explícitamente como Media (no basta con tener un ciclo de
-- créditos, que pudo activarse por error).
--
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

ALTER TABLE sponsorhub.sponsors
  ADD COLUMN IF NOT EXISTS ct_media boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sponsorhub.sponsors.ct_media IS
  'Si true, el sponsor ve CT Media en el portal. Se activa al asignar Media desde admin.';

-- Por ahora el único sponsor Media conocido es Colfondos.
UPDATE sponsorhub.sponsors
SET ct_media = true
WHERE nombre ILIKE '%colfondos%';

-- El resto queda en false aunque tengan ciclos residuales.
UPDATE sponsorhub.sponsors
SET ct_media = false
WHERE nombre NOT ILIKE '%colfondos%'
  AND ct_media = true;
