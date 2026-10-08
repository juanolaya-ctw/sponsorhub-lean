-- ============================================================
-- 0017_articulos.sql
--
-- Artículos HITL (dato impactante + plantilla 4:5 + draft/publish).
-- Un artículo por sponsor por evento. Solo admin_ct lee/escribe.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

CREATE TYPE sponsorhub.articulo_status AS ENUM ('draft', 'published');

CREATE TABLE IF NOT EXISTS sponsorhub.articulos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id          uuid NOT NULL REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE,
  sponsor_id         uuid NOT NULL REFERENCES sponsorhub.sponsors(id) ON DELETE CASCADE,
  dato_impactante    text NOT NULL,
  articulo_corto     text,
  categoria          text,
  status             sponsorhub.articulo_status NOT NULL DEFAULT 'draft',
  slug               text,
  published_at       timestamptz,
  image_source_path  text,
  imagen_path        text,
  image_crop         jsonb,
  -- Denormalizados para lectura pública futura / contrato landing
  company_name       text,
  logo_url           text,
  tier               text,
  categoria_text     text,
  articulo_texto     text,
  imagen_url         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, sponsor_id),
  UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS articulos_evento_idx
  ON sponsorhub.articulos (evento_id);

CREATE INDEX IF NOT EXISTS articulos_status_idx
  ON sponsorhub.articulos (evento_id, status);

CREATE OR REPLACE FUNCTION sponsorhub.articulos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS articulos_updated_at ON sponsorhub.articulos;
CREATE TRIGGER articulos_updated_at
  BEFORE UPDATE ON sponsorhub.articulos
  FOR EACH ROW
  EXECUTE FUNCTION sponsorhub.articulos_set_updated_at();

ALTER TABLE sponsorhub.articulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_ct gestiona articulos" ON sponsorhub.articulos;
CREATE POLICY "admin_ct gestiona articulos"
  ON sponsorhub.articulos
  FOR ALL
  USING (sponsorhub.auth_es_admin_ct())
  WITH CHECK (sponsorhub.auth_es_admin_ct());

GRANT ALL ON TABLE sponsorhub.articulos TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.articulos TO anon, authenticated;
