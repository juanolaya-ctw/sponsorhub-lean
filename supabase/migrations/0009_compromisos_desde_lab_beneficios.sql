-- =============================================================================
-- 0009_compromisos_desde_lab_beneficios.sql
--
-- GovTech 2026: LAB Beneficios (Notion) pasa a ser la fuente de verdad de
-- compromisos. El catálogo por tier queda como referencia visual.
-- CTW/CTF siguen generando compromisos con el trigger del catálogo.
--
-- Idempotente: se puede re-ejecutar en el SQL Editor de Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas en compromisos
-- ---------------------------------------------------------------------------
ALTER TABLE sponsorhub.compromisos
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS tipo_beneficio text,
  ADD COLUMN IF NOT EXISTS categoria_beneficio text;

-- Unique compuesto: una fila LAB (notion_page_id) puede aplicar a N sponsors.
-- Varios NULL en notion_page_id son permitidos (beneficios creados en el panel).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'compromisos_sponsor_notion_page_unique'
      AND conrelid = 'sponsorhub.compromisos'::regclass
  ) THEN
    ALTER TABLE sponsorhub.compromisos
      ADD CONSTRAINT compromisos_sponsor_notion_page_unique
      UNIQUE (sponsor_id, notion_page_id);
  END IF;
END $$;

-- CHECKs: valores permitidos o NULL
ALTER TABLE sponsorhub.compromisos
  DROP CONSTRAINT IF EXISTS compromisos_tipo_beneficio_check;
ALTER TABLE sponsorhub.compromisos
  ADD CONSTRAINT compromisos_tipo_beneficio_check
  CHECK (
    tipo_beneficio IS NULL
    OR tipo_beneficio IN ('Contrato', 'Upgrade', 'Tailor made', 'Adicional')
  );

ALTER TABLE sponsorhub.compromisos
  DROP CONSTRAINT IF EXISTS compromisos_categoria_beneficio_check;
ALTER TABLE sponsorhub.compromisos
  ADD CONSTRAINT compromisos_categoria_beneficio_check
  CHECK (
    categoria_beneficio IS NULL
    OR categoria_beneficio IN ('Pre evento', 'Durante evento', 'Post evento')
  );

-- ---------------------------------------------------------------------------
-- 2. RLS: admin_ct puede borrar compromisos (botón eliminar del panel)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "solo admin_ct borra compromisos" ON sponsorhub.compromisos;
CREATE POLICY "solo admin_ct borra compromisos" ON sponsorhub.compromisos
  FOR DELETE USING (sponsorhub.auth_es_admin_ct());

-- ---------------------------------------------------------------------------
-- 3. Trigger: skip generación desde catálogo SOLO para govtech-2026
--    El trigger trg_generar_compromisos NO se borra — CTW/CTF siguen igual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sponsorhub.generar_compromisos_desde_catalogo()
RETURNS TRIGGER AS $$
DECLARE
  v_tiene_catalogo boolean;
  v_filas_insertadas integer;
BEGIN
  -- GovTech: los compromisos los trae el sync de LAB Beneficios.
  IF (SELECT slug FROM sponsorhub.eventos WHERE id = NEW.evento_id) = 'govtech-2026' THEN
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT') OR (NEW.paquete IS DISTINCT FROM OLD.paquete) THEN

    SELECT EXISTS (
      SELECT 1 FROM sponsorhub.catalogo_beneficios WHERE evento_id = NEW.evento_id
    ) INTO v_tiene_catalogo;

    INSERT INTO sponsorhub.compromisos (sponsor_id, tipo, catalogo_beneficio_id, estado_id)
    SELECT
      NEW.id,
      cb.beneficio,
      cb.id,
      (SELECT id FROM sponsorhub.estados_compromiso
       WHERE nombre = 'Pendiente' AND (evento_id = NEW.evento_id OR evento_id IS NULL)
       ORDER BY evento_id NULLS LAST LIMIT 1)
    FROM sponsorhub.catalogo_beneficios cb
    WHERE cb.evento_id = NEW.evento_id
      AND cb.tier = NEW.paquete
      AND NOT EXISTS (
        SELECT 1 FROM sponsorhub.compromisos c
        WHERE c.sponsor_id = NEW.id AND c.catalogo_beneficio_id = cb.id
      );

    GET DIAGNOSTICS v_filas_insertadas = ROW_COUNT;

    IF v_tiene_catalogo AND v_filas_insertadas = 0 THEN
      INSERT INTO sponsorhub.alertas_sync (tipo, sponsor_id, evento_id, detalle)
      VALUES (
        'tier_sin_match',
        NEW.id,
        NEW.evento_id,
        format(
          'El sponsor "%s" tiene paquete/tier "%s", que no coincide con ningún tier del catálogo de beneficios de este evento.',
          NEW.nombre, NEW.paquete
        )
      );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Limpieza one-shot: borrar compromisos de govtech generados por el trigger
--    (notion_page_id IS NULL). NO repetir después del go-live: los del panel
--    también tienen notion_page_id NULL.
-- ---------------------------------------------------------------------------
DELETE FROM sponsorhub.compromisos c
USING sponsorhub.sponsors s
WHERE c.sponsor_id = s.id
  AND s.evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026')
  AND c.notion_page_id IS NULL;
