-- ============================================================
-- 0022_soy_sponsor_pieza.sql
--
-- Pieza gráfica "Soy Sponsor" generada en el browser (Canvas) con el
-- logo del sponsor. Se guarda en un bucket privado propio y la
-- referencia queda en sponsorhub.sponsors.
--
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

ALTER TABLE sponsorhub.sponsors
  ADD COLUMN IF NOT EXISTS pieza_path text,
  ADD COLUMN IF NOT EXISTS pieza_generada_at timestamptz;

COMMENT ON COLUMN sponsorhub.sponsors.pieza_path IS
  'Path dentro del bucket sponsor-piezas: {sponsor_id}/soy-sponsor.png. Se firma al leer.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsor-piezas', 'sponsor-piezas', false)
ON CONFLICT (id) DO NOTHING;

-- upsert desde el browser necesita SELECT + INSERT + UPDATE.
DROP POLICY IF EXISTS "sponsor lee piezas propias" ON storage.objects;
CREATE POLICY "sponsor lee piezas propias"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sponsor-piezas'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

DROP POLICY IF EXISTS "sponsor sube piezas propias" ON storage.objects;
CREATE POLICY "sponsor sube piezas propias"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sponsor-piezas'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

DROP POLICY IF EXISTS "sponsor actualiza piezas propias" ON storage.objects;
CREATE POLICY "sponsor actualiza piezas propias"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sponsor-piezas'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  )
  WITH CHECK (
    bucket_id = 'sponsor-piezas'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

DROP POLICY IF EXISTS "admin_ct gestiona piezas" ON storage.objects;
CREATE POLICY "admin_ct gestiona piezas"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'sponsor-piezas'
    AND sponsorhub.auth_es_admin_ct()
  )
  WITH CHECK (
    bucket_id = 'sponsor-piezas'
    AND sponsorhub.auth_es_admin_ct()
  );
