-- =============================================================================
-- 0012_ct_media.sql
-- CT Media: créditos mensuales por sponsor.
-- Idempotente – puede re-ejecutarse en el SQL Editor de Supabase.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sponsorhub.media_assets_catalogo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  descripcion    text,
  costo_creditos integer NOT NULL CHECK (costo_creditos > 0),
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsorhub.media_planes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  creditos_mensuales integer NOT NULL CHECK (creditos_mensuales > 0),
  precio_usd         numeric(10,2) NOT NULL,
  activo             boolean NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsorhub.media_billing_cycles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id          uuid NOT NULL REFERENCES sponsorhub.sponsors(id) ON DELETE CASCADE,
  plan_id             uuid NOT NULL REFERENCES sponsorhub.media_planes(id),
  periodo             date NOT NULL,
  creditos_asignados  integer NOT NULL,
  creditos_rollover   integer NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (sponsor_id, periodo)
);

CREATE TABLE IF NOT EXISTS sponsorhub.media_assets_ejecutados (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_cycle_id uuid NOT NULL REFERENCES sponsorhub.media_billing_cycles(id) ON DELETE CASCADE,
  sponsor_id       uuid NOT NULL REFERENCES sponsorhub.sponsors(id),
  asset_id         uuid NOT NULL REFERENCES sponsorhub.media_assets_catalogo(id),
  costo_creditos   integer NOT NULL,
  estado           text NOT NULL DEFAULT 'pendiente_insumos'
                   CHECK (estado IN ('pendiente_insumos','insumos_recibidos','en_ejecucion','entregado','aprobado')),
  insumos_notas    text,
  notas_cs         text,
  evidencias_url   text,
  metricas         jsonb,
  entregado_at     timestamptz,
  aprobado_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE sponsorhub.media_billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.media_assets_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.media_assets_ejecutados ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.media_planes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsor lee sus ciclos" ON sponsorhub.media_billing_cycles;
CREATE POLICY "sponsor lee sus ciclos" ON sponsorhub.media_billing_cycles
  FOR SELECT USING (
    sponsor_id IN (
      SELECT sponsor_id FROM sponsorhub.sponsor_usuarios
      WHERE id = auth.uid() AND rol = 'sponsor'
    )
  );

DROP POLICY IF EXISTS "sponsor lee sus assets" ON sponsorhub.media_assets_ejecutados;
CREATE POLICY "sponsor lee sus assets" ON sponsorhub.media_assets_ejecutados
  FOR SELECT USING (
    sponsor_id IN (
      SELECT sponsor_id FROM sponsorhub.sponsor_usuarios
      WHERE id = auth.uid() AND rol = 'sponsor'
    )
  );

DROP POLICY IF EXISTS "autenticado lee catalogo" ON sponsorhub.media_assets_catalogo;
CREATE POLICY "autenticado lee catalogo" ON sponsorhub.media_assets_catalogo
  FOR SELECT TO authenticated USING (activo = true);

DROP POLICY IF EXISTS "autenticado lee planes" ON sponsorhub.media_planes;
CREATE POLICY "autenticado lee planes" ON sponsorhub.media_planes
  FOR SELECT TO authenticated USING (activo = true);

INSERT INTO sponsorhub.media_planes (nombre, creditos_mensuales, precio_usd) VALUES
  ('One Time 2500', 2500, 2500.00),
  ('Always On Build', 2500, 2500.00),
  ('Always On Score', 5000, 5000.00),
  ('Always On Pro', 7500, 7500.00),
  ('Always On Max', 10000, 10000.00)
ON CONFLICT DO NOTHING;

INSERT INTO sponsorhub.media_assets_catalogo (nombre, descripcion, costo_creditos) VALUES
  ('Reel 30s', 'Video corto para Instagram/TikTok, 30 segundos', 800),
  ('Carrusel Instagram', 'Carrusel de 5-8 slides con copy', 400),
  ('Story pack (5)', 'Pack de 5 stories estáticas o animadas', 300),
  ('LinkedIn Post', 'Post con copy + imagen para LinkedIn', 250),
  ('Contenido LinkedIn + Instagram', 'Pieza de dato impactante para ambas redes', 500),
  ('Newsletter feature', 'Mención destacada en newsletter de CT', 350)
ON CONFLICT DO NOTHING;

-- Explicit grants (ALTER DEFAULT PRIVILEGES doesn't cover tables created by a different role)
GRANT ALL ON TABLE sponsorhub.media_assets_catalogo TO postgres, service_role;
GRANT ALL ON TABLE sponsorhub.media_planes TO postgres, service_role;
GRANT ALL ON TABLE sponsorhub.media_billing_cycles TO postgres, service_role;
GRANT ALL ON TABLE sponsorhub.media_assets_ejecutados TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_assets_catalogo TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_planes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_billing_cycles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_assets_ejecutados TO anon, authenticated;
