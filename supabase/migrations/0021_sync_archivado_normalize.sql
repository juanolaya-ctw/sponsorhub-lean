-- =============================================================================
-- 0021_sync_archivado_normalize.sql
-- Soft-delete para sync Notion + normalización de notion_page_id + dedupe.
-- Idempotente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Soft-delete columns
-- ---------------------------------------------------------------------------
ALTER TABLE sponsorhub.compromisos
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz;

ALTER TABLE sponsorhub.sponsors
  ADD COLUMN IF NOT EXISTS archivado_at timestamptz;

COMMENT ON COLUMN sponsorhub.compromisos.archivado_at IS
  'Soft-delete del sync LAB: página archivada/eliminada en Notion o pair huérfano.';
COMMENT ON COLUMN sponsorhub.sponsors.archivado_at IS
  'Soft-delete de sponsors duplicados o fuera del CRM activo.';

CREATE INDEX IF NOT EXISTS idx_compromisos_archivado
  ON sponsorhub.compromisos (sponsor_id)
  WHERE archivado_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sponsors_archivado
  ON sponsorhub.sponsors (evento_id)
  WHERE archivado_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Helper: normalizar UUID Notion a formato con guiones (lowercase)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sponsorhub.normalize_notion_uuid(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hex text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN NULL;
  END IF;
  hex := lower(regexp_replace(btrim(raw), '[^0-9a-fA-F]', '', 'g'));
  IF length(hex) <> 32 THEN
    RETURN lower(btrim(raw));
  END IF;
  RETURN substr(hex, 1, 8) || '-' ||
         substr(hex, 9, 4) || '-' ||
         substr(hex, 13, 4) || '-' ||
         substr(hex, 17, 4) || '-' ||
         substr(hex, 21, 12);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Normalizar notion_page_id en compromisos y sponsors
-- ---------------------------------------------------------------------------
UPDATE sponsorhub.compromisos
SET notion_page_id = sponsorhub.normalize_notion_uuid(notion_page_id)
WHERE notion_page_id IS NOT NULL
  AND notion_page_id IS DISTINCT FROM sponsorhub.normalize_notion_uuid(notion_page_id);

UPDATE sponsorhub.sponsors
SET notion_page_id = sponsorhub.normalize_notion_uuid(notion_page_id)
WHERE notion_page_id IS NOT NULL
  AND notion_page_id IS DISTINCT FROM sponsorhub.normalize_notion_uuid(notion_page_id);

-- ---------------------------------------------------------------------------
-- 4. Colapsar compromisos duplicados por (sponsor_id, page normalizado)
--    Conserva el con más archivos/accesos; empate → created_at más antiguo.
--    Reasigna FKs y soft-archiva el resto.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  keeper_id uuid;
  loser_id uuid;
BEGIN
  FOR r IN
    SELECT
      c.sponsor_id,
      sponsorhub.normalize_notion_uuid(c.notion_page_id) AS page_norm,
      array_agg(c.id ORDER BY
        (SELECT count(*) FROM sponsorhub.archivos a WHERE a.compromiso_id = c.id) DESC,
        (SELECT count(*) FROM sponsorhub.accesos_personas ap WHERE ap.compromiso_id = c.id) DESC,
        c.created_at ASC
      ) AS ids
    FROM sponsorhub.compromisos c
    WHERE c.notion_page_id IS NOT NULL
      AND c.archivado_at IS NULL
    GROUP BY c.sponsor_id, sponsorhub.normalize_notion_uuid(c.notion_page_id)
    HAVING count(*) > 1
  LOOP
    keeper_id := r.ids[1];
    FOREACH loser_id IN ARRAY r.ids[2:array_length(r.ids, 1)]
    LOOP
      UPDATE sponsorhub.archivos
      SET compromiso_id = keeper_id
      WHERE compromiso_id = loser_id;

      UPDATE sponsorhub.accesos_personas
      SET compromiso_id = keeper_id
      WHERE compromiso_id = loser_id;

      -- Evitar choque con unique antigua antes de migrar a índice parcial
      UPDATE sponsorhub.compromisos
      SET
        archivado_at = coalesce(archivado_at, now()),
        notion_page_id = r.page_norm || '#archived-' || left(loser_id::text, 8)
      WHERE id = loser_id;
    END LOOP;

    UPDATE sponsorhub.compromisos
    SET notion_page_id = r.page_norm
    WHERE id = keeper_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Unique parcial: solo filas activas con notion_page_id
-- ---------------------------------------------------------------------------
ALTER TABLE sponsorhub.compromisos
  DROP CONSTRAINT IF EXISTS compromisos_sponsor_notion_page_unique;

DROP INDEX IF EXISTS sponsorhub.compromisos_sponsor_notion_page_active_uidx;
CREATE UNIQUE INDEX compromisos_sponsor_notion_page_active_uidx
  ON sponsorhub.compromisos (sponsor_id, notion_page_id)
  WHERE archivado_at IS NULL AND notion_page_id IS NOT NULL;
