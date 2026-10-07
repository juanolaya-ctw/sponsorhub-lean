-- ============================================================
-- 0015_beneficio_formularios.sql
--
-- Links de formulario (Tally, etc.) a nivel de EVENTO + nombre
-- de beneficio. Así Speaking Slot / Moderación Policy Lab se
-- configuran una sola vez y aplican a todos los sponsors con
-- ese beneficio.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsorhub.beneficio_formularios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id          uuid NOT NULL REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE,
  beneficio_nombre   text NOT NULL,
  url                text NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, beneficio_nombre)
);

ALTER TABLE sponsorhub.beneficio_formularios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticado lee formularios beneficio" ON sponsorhub.beneficio_formularios;
CREATE POLICY "autenticado lee formularios beneficio"
  ON sponsorhub.beneficio_formularios FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admin_ct gestiona formularios beneficio" ON sponsorhub.beneficio_formularios;
CREATE POLICY "admin_ct gestiona formularios beneficio"
  ON sponsorhub.beneficio_formularios FOR ALL
  USING (sponsorhub.auth_es_admin_ct())
  WITH CHECK (sponsorhub.auth_es_admin_ct());

GRANT ALL ON TABLE sponsorhub.beneficio_formularios TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.beneficio_formularios TO anon, authenticated;
