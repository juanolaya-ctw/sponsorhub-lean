-- =============================================================================
-- 0010_admin_sube_por_sponsor.sql
--
-- CS puede subir (o reemplazar) un archivo en nombre del sponsor desde el
-- panel admin. El portal trata esos archivos igual que un insumo del sponsor.
--
-- direccion es ENUM sponsorhub.archivo_direccion (0001), no un CHECK.
-- auth_es_admin_ct() ya existe en 0003 — no se recrea aquí.
--
-- Idempotente: se puede re-ejecutar en el SQL Editor de Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nuevo valor del ENUM
-- ---------------------------------------------------------------------------
-- PG 12+: ADD VALUE puede ir en transacción, pero el valor nuevo no se puede
-- usar como literal del ENUM hasta el COMMIT. Las policies de abajo comparan
-- direccion::text para que este archivo se pueda pegar de una sola vez.
ALTER TYPE sponsorhub.archivo_direccion
  ADD VALUE IF NOT EXISTS 'admin_sube_por_sponsor';

-- ---------------------------------------------------------------------------
-- 2. RLS INSERT: admin_ct también puede insertar admin_sube_por_sponsor
--    0003 solo permitía ctw_entrega. UPDATE de admin no filtra direccion
--    (admin_ct gestiona todos los archivos) — el reemplazo no necesita cambio.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_ct inserta entregables de CT" ON sponsorhub.archivos;
CREATE POLICY "admin_ct inserta entregables de CT" ON sponsorhub.archivos
  FOR INSERT WITH CHECK (
    sponsorhub.auth_es_admin_ct()
    AND direccion::text IN ('ctw_entrega', 'admin_sube_por_sponsor')
  );

-- ---------------------------------------------------------------------------
-- 3. Storage: CS sube/borra con su sesión (bucket sponsorhub-archivos).
--    0006 solo deja al sponsor operar sobre {sponsor_id}/...; admin_ct no
--    tiene sponsor_id, así que necesita esta policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_ct gestiona objetos del bucket" ON storage.objects;
CREATE POLICY "admin_ct gestiona objetos del bucket"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'sponsorhub-archivos'
    AND sponsorhub.auth_es_admin_ct()
  )
  WITH CHECK (
    bucket_id = 'sponsorhub-archivos'
    AND sponsorhub.auth_es_admin_ct()
  );
