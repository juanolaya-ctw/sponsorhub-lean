-- ============================================================
-- 0016_stand_revisiones.sql
--
-- Aprobación de renders de stand por el patrocinador.
-- CS sube imágenes (archivos.tipo = stand_render); el sponsor
-- aprueba o solicita cambios con comentario.
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsorhub.stand_revisiones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compromiso_id    uuid NOT NULL REFERENCES sponsorhub.compromisos(id) ON DELETE CASCADE,
  decision         text NOT NULL CHECK (decision IN ('aprobado', 'cambios_solicitados')),
  comentario       text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stand_revisiones_compromiso_idx
  ON sponsorhub.stand_revisiones (compromiso_id, created_at DESC);

ALTER TABLE sponsorhub.stand_revisiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura revisiones stand segun rol" ON sponsorhub.stand_revisiones;
CREATE POLICY "lectura revisiones stand segun rol"
  ON sponsorhub.stand_revisiones FOR SELECT
  USING (
    sponsorhub.auth_es_admin_ct()
    OR EXISTS (
      SELECT 1
      FROM sponsorhub.compromisos c
      WHERE c.id = compromiso_id
        AND c.sponsor_id = sponsorhub.auth_sponsor_id()
    )
  );

DROP POLICY IF EXISTS "sponsor inserta revisiones stand" ON sponsorhub.stand_revisiones;
CREATE POLICY "sponsor inserta revisiones stand"
  ON sponsorhub.stand_revisiones FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM sponsorhub.compromisos c
      WHERE c.id = compromiso_id
        AND c.sponsor_id = sponsorhub.auth_sponsor_id()
    )
  );

DROP POLICY IF EXISTS "admin_ct gestiona revisiones stand" ON sponsorhub.stand_revisiones;
CREATE POLICY "admin_ct gestiona revisiones stand"
  ON sponsorhub.stand_revisiones FOR ALL
  USING (sponsorhub.auth_es_admin_ct())
  WITH CHECK (sponsorhub.auth_es_admin_ct());

GRANT ALL ON TABLE sponsorhub.stand_revisiones TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.stand_revisiones TO anon, authenticated;

-- CS puede eliminar renders/archivos desde el panel (antes solo UPDATE).
DROP POLICY IF EXISTS "admin_ct borra archivos" ON sponsorhub.archivos;
CREATE POLICY "admin_ct borra archivos" ON sponsorhub.archivos
  FOR DELETE USING (sponsorhub.auth_es_admin_ct());
