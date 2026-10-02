-- =============================================================================
-- 0013_ct_media_v2.sql
-- CT Media v2: clientes transversales, top-ups y evento por asset.
-- Idempotente – puede re-ejecutarse en el SQL Editor de Supabase.
-- =============================================================================

-- ── media_clientes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsorhub.media_clientes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  empresa        text,
  email_contacto text,
  telefono       text,
  notas          text,
  sponsor_id     uuid REFERENCES sponsorhub.sponsors(id) ON DELETE SET NULL,
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- ── Agregar cliente_id a media_billing_cycles ─────────────────────────────────
ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES sponsorhub.media_clientes(id) ON DELETE SET NULL;

-- ── Agregar creditos_extra a media_billing_cycles ─────────────────────────────
ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS creditos_extra integer NOT NULL DEFAULT 0;

-- ── media_ciclo_topups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsorhub.media_ciclo_topups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id    uuid NOT NULL REFERENCES sponsorhub.media_billing_cycles(id) ON DELETE CASCADE,
  creditos    integer NOT NULL CHECK (creditos > 0),
  motivo      text,
  creado_por  text,
  created_at  timestamptz DEFAULT now()
);

-- ── Agregar evento_id a media_assets_ejecutados ───────────────────────────────
ALTER TABLE sponsorhub.media_assets_ejecutados
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES sponsorhub.eventos(id) ON DELETE SET NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE sponsorhub.media_clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.media_ciclo_topups   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsor lee su cliente media" ON sponsorhub.media_clientes;
CREATE POLICY "sponsor lee su cliente media" ON sponsorhub.media_clientes
  FOR SELECT USING (
    sponsor_id IN (
      SELECT sponsor_id FROM sponsorhub.sponsor_usuarios
      WHERE id = auth.uid() AND rol = 'sponsor'
    )
  );

DROP POLICY IF EXISTS "admin lee clientes media" ON sponsorhub.media_clientes;
CREATE POLICY "admin lee clientes media" ON sponsorhub.media_clientes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sponsorhub.sponsor_usuarios
      WHERE id = auth.uid() AND rol = 'admin_ct'
    )
  );

-- ── GRANTs explícitos (ALTER DEFAULT PRIVILEGES no siempre cubre tablas nuevas) ─
GRANT ALL ON TABLE sponsorhub.media_clientes     TO postgres, service_role;
GRANT ALL ON TABLE sponsorhub.media_ciclo_topups TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_clientes     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_ciclo_topups TO anon, authenticated;
