-- =============================================================================
-- 0027_media_cliente_insumos_marca.sql
-- Insumos de marca reutilizables a nivel empresa (logo original, logo B/N,
-- manual de marca). Se suben una vez y cuentan como "Cargado" en todas las
-- piezas que los piden (mismo patrón que sponsorhub.archivos.tipo = 'logo_ai'
-- en eventos). La foto del vocero sigue siendo por pieza.
--
-- Además: media_assets_ejecutados.fecha_planeada (date, nullable).
--
-- Aditiva: solo CREATE TABLE/INDEX/POLICY IF NOT EXISTS y ADD COLUMN IF NOT
-- EXISTS. No modifica columnas existentes ni datos. Escrituras de la app: server actions con service role
-- tras asserts (requireAdmin / requireMediaContacto + vínculo empresa).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS sponsorhub.media_cliente_insumos_marca (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES sponsorhub.media_clientes(id) ON DELETE CASCADE,
  tipo           text NOT NULL
                 CHECK (tipo IN ('logo_original','logo_bn','manual_marca')),
  contacto_id    uuid REFERENCES sponsorhub.media_cliente_contactos(id) ON DELETE SET NULL,
  nombre_archivo text NOT NULL,
  storage_path   text NOT NULL
                 CHECK (storage_path LIKE 'media-cliente/' || cliente_id::text || '/marca/' || tipo || '/%'),
  subido_por     uuid REFERENCES sponsorhub.sponsor_usuarios(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sponsorhub.media_cliente_insumos_marca IS
  'Insumos de marca por empresa Media, reutilizados en todas sus piezas. El más reciente por tipo es el vigente.';

CREATE INDEX IF NOT EXISTS media_cliente_insumos_marca_cliente_tipo_idx
  ON sponsorhub.media_cliente_insumos_marca (cliente_id, tipo, created_at DESC);

ALTER TABLE sponsorhub.media_cliente_insumos_marca ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'sponsorhub.media_cliente_insumos_marca'::regclass
      AND polname = 'admin_ct gestiona insumos marca media'
  ) THEN
    CREATE POLICY "admin_ct gestiona insumos marca media"
      ON sponsorhub.media_cliente_insumos_marca
      FOR ALL
      USING (sponsorhub.auth_es_admin_ct())
      WITH CHECK (sponsorhub.auth_es_admin_ct());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'sponsorhub.media_cliente_insumos_marca'::regclass
      AND polname = 'media_contacto lee insumos marca de sus empresas'
  ) THEN
    CREATE POLICY "media_contacto lee insumos marca de sus empresas"
      ON sponsorhub.media_cliente_insumos_marca
      FOR SELECT
      USING (
        sponsorhub.auth_es_media_contacto()
        AND cliente_id IN (
          SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() ids(cliente_id)
        )
      );
  END IF;
END $$;

-- Fecha planeada (publicación) de la pieza, editable por admin.
-- created_at sigue siendo la fecha de creación (histórico, no se edita).
ALTER TABLE sponsorhub.media_assets_ejecutados
  ADD COLUMN IF NOT EXISTS fecha_planeada date;

COMMENT ON COLUMN sponsorhub.media_assets_ejecutados.fecha_planeada IS
  'Fecha planeada de publicación/ejecución de la pieza. NULL = sin fecha. Editable por admin.';

GRANT SELECT ON sponsorhub.media_cliente_insumos_marca TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sponsorhub.media_cliente_insumos_marca TO service_role;

COMMIT;
