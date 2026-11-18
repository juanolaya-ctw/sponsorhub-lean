-- =============================================================================
-- DRAFT 0024_media_empresa_contactos_portal.sql
-- NO APLICAR hasta OK de ejecución explícito.
-- Una sola transacción. Sin backfill histórico. Sin invitaciones automáticas.
-- =============================================================================

BEGIN;

-- ── 0) Helpers de verificación (se eliminan al final) ────────────────────────
CREATE OR REPLACE FUNCTION sponsorhub._0024_assert_column(
  p_table text,
  p_column text,
  p_data_type text,
  p_is_nullable text,
  p_column_default text,
  p_must_exist boolean
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  SELECT data_type, is_nullable, column_default
  INTO r
  FROM information_schema.columns
  WHERE table_schema = 'sponsorhub'
    AND table_name = p_table
    AND column_name = p_column;

  IF NOT FOUND THEN
    IF p_must_exist THEN
      RAISE EXCEPTION
        '0024 aborted: required column %.% is missing after CREATE',
        p_table, p_column;
    END IF;
    RETURN;
  END IF;

  IF r.data_type IS DISTINCT FROM p_data_type THEN
    RAISE EXCEPTION
      '0024 aborted: %.% data_type=% expected=% (no drop/replace)',
      p_table, p_column, r.data_type, p_data_type;
  END IF;

  IF p_is_nullable IS NOT NULL AND r.is_nullable IS DISTINCT FROM p_is_nullable THEN
    RAISE EXCEPTION
      '0024 aborted: %.% is_nullable=% expected=% (no drop/replace)',
      p_table, p_column, r.is_nullable, p_is_nullable;
  END IF;

  IF p_column_default IS NOT NULL THEN
    IF r.column_default IS NULL
       OR position(p_column_default in r.column_default) = 0 THEN
      RAISE EXCEPTION
        '0024 aborted: %.% column_default=% expected to contain %',
        p_table, p_column, r.column_default, p_column_default;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_norm(p text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(replace(coalesce(p, ''), ' ', ''))
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_assert_pk(p_table text, p_cols text[])
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  cols text[];
BEGIN
  SELECT array_agg(a.attname::text ORDER BY u.ord)
  INTO cols
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum
  WHERE n.nspname = 'sponsorhub'
    AND c.relname = p_table
    AND i.indisprimary;

  IF cols IS NULL OR cols IS DISTINCT FROM p_cols THEN
    RAISE EXCEPTION
      '0024 aborted: %. PK cols=% expected=%',
      p_table, cols, p_cols;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_assert_fk(
  p_table text,
  p_column text,
  p_ref_table text,
  p_ref_column text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'sponsorhub'
      AND tc.table_name = p_table
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = p_column
      AND ccu.table_name = p_ref_table
      AND ccu.column_name = p_ref_column
  ) INTO ok;

  IF NOT ok THEN
    RAISE EXCEPTION
      '0024 aborted: missing FK %.% -> %.%',
      p_table, p_column, p_ref_table, p_ref_column;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_assert_index(
  p_index text,
  p_must_contain text[],
  p_unique boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  def text;
  is_unique boolean;
  marker text;
BEGIN
  SELECT pg_get_indexdef(i.indexrelid), i.indisunique
  INTO def, is_unique
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sponsorhub'
    AND c.relname = p_index;

  IF def IS NULL THEN
    RAISE EXCEPTION '0024 aborted: required index % missing', p_index;
  END IF;

  IF p_unique IS NOT NULL AND is_unique IS DISTINCT FROM p_unique THEN
    RAISE EXCEPTION
      '0024 aborted: index % unique=% expected=% def=%',
      p_index, is_unique, p_unique, def;
  END IF;

  FOREACH marker IN ARRAY p_must_contain LOOP
    IF position(lower(marker) in lower(def)) = 0 THEN
      RAISE EXCEPTION
        '0024 aborted: index % def missing % : %',
        p_index, marker, def;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sponsorhub'
      AND c.relname = p_index
      AND i.indisvalid
  ) THEN
    RAISE EXCEPTION '0024 aborted: index % exists but is NOT VALID', p_index;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_policy_qual(
  p_schema text,
  p_table text,
  p_policy text
) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT qual
  FROM pg_policies
  WHERE schemaname = p_schema
    AND tablename = p_table
    AND policyname = p_policy
$$;

CREATE OR REPLACE FUNCTION sponsorhub._0024_ensure_policy(
  p_schema text,
  p_table text,
  p_policy text,
  p_cmd text,
  p_roles text,
  p_qual text,
  p_with_check text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  existing_qual text;
  existing_check text;
  existing_cmd text;
  existing_roles text;
BEGIN
  SELECT qual, with_check, cmd, roles
  INTO existing_qual, existing_check, existing_cmd, existing_roles
  FROM pg_policies
  WHERE schemaname = p_schema
    AND tablename = p_table
    AND policyname = p_policy;

  IF FOUND THEN
    IF sponsorhub._0024_norm(existing_qual) IS DISTINCT FROM sponsorhub._0024_norm(coalesce(p_qual, ''))
       OR sponsorhub._0024_norm(coalesce(existing_check, ''))
          IS DISTINCT FROM sponsorhub._0024_norm(coalesce(p_with_check, ''))
       OR lower(existing_cmd) IS DISTINCT FROM lower(p_cmd) THEN
      RAISE EXCEPTION
        '0024 aborted: policy %.%.% exists with unexpected definition (cmd=% qual=% with_check=%). No blind overwrite.',
        p_schema, p_table, p_policy, existing_cmd, existing_qual, existing_check;
    END IF;
    RETURN;
  END IF;

  IF upper(p_cmd) = 'INSERT' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR INSERT TO %s WITH CHECK (%s)',
      p_policy, p_schema, p_table, p_roles, p_with_check
    );
  ELSIF upper(p_cmd) = 'ALL' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR ALL TO %s USING (%s) WITH CHECK (%s)',
      p_policy, p_schema, p_table, p_roles, p_qual, coalesce(p_with_check, p_qual)
    );
  ELSE
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s USING (%s)%s',
      p_policy,
      p_schema,
      p_table,
      p_cmd,
      p_roles,
      p_qual,
      CASE
        WHEN p_with_check IS NULL THEN ''
        ELSE format(' WITH CHECK (%s)', p_with_check)
      END
    );
  END IF;
END;
$$;

-- Abortar si draft previo dejó es_principal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sponsorhub'
      AND table_name = 'media_cliente_contactos'
      AND column_name = 'es_principal'
  ) THEN
    RAISE EXCEPTION
      '0024 aborted: media_cliente_contactos.es_principal exists (fuera de alcance). Ajustar a mano; no se elimina automáticamente.';
  END IF;
END $$;

-- Pre-check columnas (si existen deben coincidir; ausentes OK antes de CREATE)
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'id', 'uuid', 'NO', 'gen_random_uuid', false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'cliente_id', 'uuid', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'nombre', 'text', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'email', 'text', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'telefono', 'text', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'cargo', 'text', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'notas', 'text', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'activo', 'boolean', 'NO', 'true', false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'auth_user_id', 'uuid', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'created_at', 'timestamp with time zone', NULL, 'now', false);

SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'id', 'uuid', 'NO', 'gen_random_uuid', false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'asset_ejecutado_id', 'uuid', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'cliente_id', 'uuid', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'contacto_id', 'uuid', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'nombre_archivo', 'text', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'storage_path', 'text', 'NO', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'subido_por', 'uuid', 'YES', NULL, false);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'created_at', 'timestamp with time zone', NULL, 'now', false);

-- ── 1) Bucket privado + policies Storage existentes (solo lectura) ───────────
DO $$
DECLARE
  is_pub boolean;
  pol record;
  unexpected text := '';
BEGIN
  SELECT b.public INTO is_pub
  FROM storage.buckets b
  WHERE b.id = 'sponsorhub-archivos';

  IF NOT FOUND THEN
    RAISE EXCEPTION '0024 aborted: storage bucket sponsorhub-archivos missing';
  END IF;
  IF is_pub IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      '0024 aborted: bucket sponsorhub-archivos must be private (public=%). No se cambia automáticamente.',
      is_pub;
  END IF;

  -- Policies ajenas al alcance: no modificar. Abortar solo si alguna
  -- media_contacto ya existe con definición distinta a la prevista (se crea después).
  FOR pol IN
    SELECT policyname, qual, with_check, cmd
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'media_contacto%'
  LOOP
    unexpected := unexpected || pol.policyname || ';';
  END LOOP;

  IF unexpected <> '' THEN
    -- Se validan de nuevo al ensure_policy; aquí solo informamos si hubo drafts previos
    NULL;
  END IF;
END $$;

-- ── 2) Rol media_contacto: verificación exacta de CHECKs existentes ─────────
DO $$
DECLARE
  r record;
  consist_def text;
  rol_def text;
  -- Exactas según pg_get_constraintdef en preflight 2026-11-18 (kqbgvvjrraliulmqiqtx).
  legacy_consist text :=
    'CHECK ((((rol = ''admin_ct''::text) AND (sponsor_id IS NULL)) OR ((rol = ''sponsor''::text) AND (sponsor_id IS NOT NULL))))';
  expected_consist text :=
    'CHECK ((((rol = ''admin_ct''::text) AND (sponsor_id IS NULL)) OR ((rol = ''sponsor''::text) AND (sponsor_id IS NOT NULL)) OR ((rol = ''media_contacto''::text) AND (sponsor_id IS NULL))))';
  legacy_rol_a text := 'CHECK ((rol = ANY (ARRAY[''admin_ct''::text, ''sponsor''::text])))';
  legacy_rol_b text := 'CHECK ((rol IN (''admin_ct'', ''sponsor'')))';
  expected_rol text := 'CHECK ((rol = ANY (ARRAY[''admin_ct''::text, ''sponsor''::text, ''media_contacto''::text])))';
  expected_rol_alt text := 'CHECK ((rol IN (''admin_ct'', ''sponsor'', ''media_contacto'')))';
  found_rol_con text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO consist_def
  FROM pg_constraint c
  WHERE c.conname = 'chk_rol_sponsor_consistente'
    AND c.conrelid = 'sponsorhub.sponsor_usuarios'::regclass;

  IF consist_def IS NULL THEN
    ALTER TABLE sponsorhub.sponsor_usuarios
      ADD CONSTRAINT chk_rol_sponsor_consistente CHECK (
        (rol = 'admin_ct' AND sponsor_id IS NULL)
        OR (rol = 'sponsor' AND sponsor_id IS NOT NULL)
        OR (rol = 'media_contacto' AND sponsor_id IS NULL)
      );
  ELSIF sponsorhub._0024_norm(consist_def) = sponsorhub._0024_norm(expected_consist) THEN
    NULL; -- ya correcto
  ELSIF sponsorhub._0024_norm(consist_def) = sponsorhub._0024_norm(legacy_consist) THEN
    ALTER TABLE sponsorhub.sponsor_usuarios
      DROP CONSTRAINT chk_rol_sponsor_consistente;
    ALTER TABLE sponsorhub.sponsor_usuarios
      ADD CONSTRAINT chk_rol_sponsor_consistente CHECK (
        (rol = 'admin_ct' AND sponsor_id IS NULL)
        OR (rol = 'sponsor' AND sponsor_id IS NOT NULL)
        OR (rol = 'media_contacto' AND sponsor_id IS NULL)
      );
  ELSE
    RAISE EXCEPTION
      '0024 aborted: chk_rol_sponsor_consistente unexpected def: %. Expected legacy or extended media_contacto.',
      consist_def;
  END IF;

  -- CHECK de valores de rol: solo coincidencia exacta (normalizada). Sin parciales.
  found_rol_con := NULL;
  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid = 'sponsorhub.sponsor_usuarios'::regclass
      AND c.contype = 'c'
      AND c.conname IS DISTINCT FROM 'chk_rol_sponsor_consistente'
  LOOP
    IF sponsorhub._0024_norm(r.def) IN (
         sponsorhub._0024_norm(legacy_rol_a),
         sponsorhub._0024_norm(legacy_rol_b),
         sponsorhub._0024_norm(expected_rol),
         sponsorhub._0024_norm(expected_rol_alt),
         sponsorhub._0024_norm('CHECK (rol IN (''admin_ct'', ''sponsor'', ''media_contacto''))'),
         sponsorhub._0024_norm('CHECK ((rol IN (''admin_ct'', ''sponsor'')))')
       )
    THEN
      IF found_rol_con IS NOT NULL THEN
        RAISE EXCEPTION
          '0024 aborted: multiple rol value CHECKs on sponsor_usuarios (% and %)',
          found_rol_con, r.conname;
      END IF;
      found_rol_con := r.conname;
      rol_def := r.def;
    ELSIF position('rol' in lower(r.def)) > 0
          AND (
            position('admin_ct' in lower(r.def)) > 0
            OR position('media_contacto' in lower(r.def)) > 0
          ) THEN
      RAISE EXCEPTION
        '0024 aborted: unexpected rol CHECK % def=% (exact match only; no partial replace)',
        r.conname, r.def;
    END IF;
  END LOOP;

  IF found_rol_con IS NULL THEN
    ALTER TABLE sponsorhub.sponsor_usuarios
      ADD CONSTRAINT sponsor_usuarios_rol_chk
      CHECK (rol IN ('admin_ct', 'sponsor', 'media_contacto'));
  ELSIF sponsorhub._0024_norm(rol_def) IN (
         sponsorhub._0024_norm(expected_rol),
         sponsorhub._0024_norm(expected_rol_alt),
         sponsorhub._0024_norm('CHECK (rol IN (''admin_ct'', ''sponsor'', ''media_contacto''))')
       ) THEN
    NULL; -- ya extendido exactamente
  ELSIF sponsorhub._0024_norm(rol_def) IN (
          sponsorhub._0024_norm(legacy_rol_a),
          sponsorhub._0024_norm(legacy_rol_b),
          sponsorhub._0024_norm('CHECK ((rol IN (''admin_ct'', ''sponsor'')))')
        ) THEN
    EXECUTE format(
      'ALTER TABLE sponsorhub.sponsor_usuarios DROP CONSTRAINT %I',
      found_rol_con
    );
    ALTER TABLE sponsorhub.sponsor_usuarios
      ADD CONSTRAINT sponsor_usuarios_rol_chk
      CHECK (rol IN ('admin_ct', 'sponsor', 'media_contacto'));
  ELSE
    RAISE EXCEPTION
      '0024 aborted: cannot extend rol CHECK % def=% (exact match only)',
      found_rol_con, rol_def;
  END IF;
END $$;

-- ── 3) Tablas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsorhub.media_cliente_contactos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   uuid NOT NULL REFERENCES sponsorhub.media_clientes(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  email        text,
  telefono     text,
  cargo        text,
  notas        text,
  activo       boolean NOT NULL DEFAULT true,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsorhub.media_asset_insumos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_ejecutado_id uuid NOT NULL
    REFERENCES sponsorhub.media_assets_ejecutados(id) ON DELETE CASCADE,
  cliente_id         uuid NOT NULL
    REFERENCES sponsorhub.media_clientes(id) ON DELETE CASCADE,
  contacto_id        uuid
    REFERENCES sponsorhub.media_cliente_contactos(id) ON DELETE SET NULL,
  nombre_archivo     text NOT NULL,
  storage_path       text NOT NULL,
  subido_por         uuid REFERENCES sponsorhub.sponsor_usuarios(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);

-- Post-CREATE: columnas ausentes abortan
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'id', 'uuid', 'NO', 'gen_random_uuid', true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'cliente_id', 'uuid', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'nombre', 'text', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'email', 'text', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'telefono', 'text', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'cargo', 'text', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'notas', 'text', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'activo', 'boolean', 'NO', 'true', true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'auth_user_id', 'uuid', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_cliente_contactos', 'created_at', 'timestamp with time zone', NULL, 'now', true);

SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'id', 'uuid', 'NO', 'gen_random_uuid', true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'asset_ejecutado_id', 'uuid', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'cliente_id', 'uuid', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'contacto_id', 'uuid', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'nombre_archivo', 'text', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'storage_path', 'text', 'NO', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'subido_por', 'uuid', 'YES', NULL, true);
SELECT sponsorhub._0024_assert_column('media_asset_insumos', 'created_at', 'timestamp with time zone', NULL, 'now', true);

SELECT sponsorhub._0024_assert_pk('media_cliente_contactos', ARRAY['id']);
SELECT sponsorhub._0024_assert_pk('media_asset_insumos', ARRAY['id']);
SELECT sponsorhub._0024_assert_fk('media_cliente_contactos', 'cliente_id', 'media_clientes', 'id');
SELECT sponsorhub._0024_assert_fk('media_asset_insumos', 'asset_ejecutado_id', 'media_assets_ejecutados', 'id');
SELECT sponsorhub._0024_assert_fk('media_asset_insumos', 'cliente_id', 'media_clientes', 'id');
SELECT sponsorhub._0024_assert_fk('media_asset_insumos', 'contacto_id', 'media_cliente_contactos', 'id');

CREATE INDEX IF NOT EXISTS media_cliente_contactos_cliente_id_idx
  ON sponsorhub.media_cliente_contactos (cliente_id);

CREATE INDEX IF NOT EXISTS media_cliente_contactos_auth_user_id_idx
  ON sponsorhub.media_cliente_contactos (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

DO $$
DECLARE
  existing_def text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sponsorhub'
      AND c.relname = 'media_cliente_contactos_auth_user_activo_uidx'
  ) THEN
    RAISE EXCEPTION
      '0024 aborted: obsolete index media_cliente_contactos_auth_user_activo_uidx present. Remove manually.';
  END IF;

  SELECT pg_get_indexdef(i.indexrelid)
  INTO existing_def
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sponsorhub'
    AND c.relname = 'media_cliente_contactos_user_cliente_activo_uidx';

  IF existing_def IS NULL THEN
    CREATE UNIQUE INDEX media_cliente_contactos_user_cliente_activo_uidx
      ON sponsorhub.media_cliente_contactos (auth_user_id, cliente_id)
      WHERE auth_user_id IS NOT NULL AND activo = true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS media_asset_insumos_asset_idx
  ON sponsorhub.media_asset_insumos (asset_ejecutado_id);

CREATE INDEX IF NOT EXISTS media_asset_insumos_cliente_idx
  ON sponsorhub.media_asset_insumos (cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS media_asset_insumos_storage_path_uidx
  ON sponsorhub.media_asset_insumos (storage_path);

SELECT sponsorhub._0024_assert_index(
  'media_cliente_contactos_cliente_id_idx',
  ARRAY['cliente_id'],
  false
);
SELECT sponsorhub._0024_assert_index(
  'media_cliente_contactos_user_cliente_activo_uidx',
  ARRAY['auth_user_id', 'cliente_id', 'activo'],
  true
);
SELECT sponsorhub._0024_assert_index(
  'media_asset_insumos_asset_idx',
  ARRAY['asset_ejecutado_id'],
  false
);
SELECT sponsorhub._0024_assert_index(
  'media_asset_insumos_cliente_idx',
  ARRAY['cliente_id'],
  false
);
SELECT sponsorhub._0024_assert_index(
  'media_asset_insumos_storage_path_uidx',
  ARRAY['storage_path'],
  true
);

COMMENT ON TABLE sponsorhub.media_cliente_contactos IS
  'Personas de contacto CRM por empresa Media. Acceso portal vía auth_user_id (admin). Sin es_principal.';
COMMENT ON COLUMN sponsorhub.media_cliente_contactos.auth_user_id IS
  'Usuario auth vinculado por admin. NULL = acceso aún no preparado.';
COMMENT ON TABLE sponsorhub.media_asset_insumos IS
  'Insumos por pieza Media. Insert-only para contacto; no cambia estado del asset.';

-- ── 4) Funciones auth (TABLE con columna explícita; sin sonda ajenas) ─────────
-- Si una función homónima existe con cuerpo distinto → abortar (no REPLACE ciego)

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef('sponsorhub.auth_es_media_contacto()'::regprocedure)
  INTO def;
  IF def IS NOT NULL
     AND position('media_contacto' in def) = 0 THEN
    RAISE EXCEPTION
      '0024 aborted: auth_es_media_contacto exists with unexpected body';
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
END $$;

CREATE OR REPLACE FUNCTION sponsorhub.auth_es_media_contacto()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sponsorhub, public
AS $$
  SELECT COALESCE(
    (SELECT rol = 'media_contacto'
       FROM sponsorhub.sponsor_usuarios
      WHERE id = auth.uid() AND activo = true),
    false
  )
$$;

-- RETURNS TABLE(cliente_id uuid) → columna explícita (no SETOF anónimo)
CREATE OR REPLACE FUNCTION sponsorhub.auth_media_cliente_ids()
RETURNS TABLE (cliente_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sponsorhub, public
AS $$
  SELECT c.cliente_id
  FROM sponsorhub.media_cliente_contactos c
  JOIN sponsorhub.sponsor_usuarios u ON u.id = c.auth_user_id
  WHERE c.auth_user_id = auth.uid()
    AND c.activo = true
    AND u.activo = true
    AND u.rol = 'media_contacto'
$$;

CREATE OR REPLACE FUNCTION sponsorhub.auth_media_contacto_id_for_cliente(p_cliente_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sponsorhub, public
AS $$
  SELECT c.id
  FROM sponsorhub.media_cliente_contactos c
  WHERE c.auth_user_id = auth.uid()
    AND c.cliente_id = p_cliente_id
    AND c.activo = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION sponsorhub.auth_tiene_acceso_media_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sponsorhub, public
AS $$
  SELECT sponsorhub.auth_es_admin_ct()
    OR EXISTS (
      SELECT 1
      FROM sponsorhub.auth_media_cliente_ids() AS ids
      WHERE ids.cliente_id = p_cliente_id
    )
$$;

-- No revela pertenencia de piezas de empresas ajenas: exige acceso al cliente primero
CREATE OR REPLACE FUNCTION sponsorhub.auth_media_asset_ok_for_caller(
  p_asset_ejecutado_id uuid,
  p_cliente_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = sponsorhub, public
AS $$
  SELECT CASE
    WHEN NOT sponsorhub.auth_tiene_acceso_media_cliente(p_cliente_id) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM sponsorhub.media_assets_ejecutados a
      JOIN sponsorhub.media_billing_cycles bc ON bc.id = a.billing_cycle_id
      WHERE a.id = p_asset_ejecutado_id
        AND bc.cliente_id = p_cliente_id
    )
  END
$$;

-- Revocar PUBLIC/anon; conceder solo authenticated donde las policies lo requieren
REVOKE ALL ON FUNCTION sponsorhub.auth_es_media_contacto() FROM PUBLIC;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_cliente_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_contacto_id_for_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sponsorhub.auth_tiene_acceso_media_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_asset_ok_for_caller(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION sponsorhub.auth_es_media_contacto() FROM anon;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_cliente_ids() FROM anon;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_contacto_id_for_cliente(uuid) FROM anon;
REVOKE ALL ON FUNCTION sponsorhub.auth_tiene_acceso_media_cliente(uuid) FROM anon;
REVOKE ALL ON FUNCTION sponsorhub.auth_media_asset_ok_for_caller(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION sponsorhub.auth_es_media_contacto() TO authenticated;
GRANT EXECUTE ON FUNCTION sponsorhub.auth_media_cliente_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION sponsorhub.auth_media_contacto_id_for_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sponsorhub.auth_tiene_acceso_media_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION sponsorhub.auth_media_asset_ok_for_caller(uuid, uuid) TO authenticated;

-- ── 5) RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE sponsorhub.media_cliente_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.media_asset_insumos ENABLE ROW LEVEL SECURITY;

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_cliente_contactos',
  'admin_ct gestiona contactos media',
  'ALL', 'public',
  'sponsorhub.auth_es_admin_ct()',
  'sponsorhub.auth_es_admin_ct()'
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_cliente_contactos',
  'media_contacto lee su contacto',
  'SELECT', 'public',
  $q$auth_user_id = auth.uid() AND activo = true AND sponsorhub.auth_es_media_contacto()$q$,
  NULL
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_asset_insumos',
  'admin_ct gestiona insumos media',
  'ALL', 'public',
  'sponsorhub.auth_es_admin_ct()',
  'sponsorhub.auth_es_admin_ct()'
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_asset_insumos',
  'media_contacto lee insumos de sus empresas',
  'SELECT', 'public',
  $q$sponsorhub.auth_es_media_contacto() AND cliente_id IN (SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids)$q$,
  NULL
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_asset_insumos',
  'media_contacto inserta insumos de sus empresas',
  'INSERT', 'public',
  NULL,
  $q$sponsorhub.auth_es_media_contacto()
    AND cliente_id IN (SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids)
    AND contacto_id = sponsorhub.auth_media_contacto_id_for_cliente(cliente_id)
    AND subido_por = auth.uid()
    AND sponsorhub.auth_media_asset_ok_for_caller(asset_ejecutado_id, cliente_id)
    AND storage_path LIKE ('media-cliente/' || cliente_id::text || '/' || asset_ejecutado_id::text || '/%')$q$
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_clientes',
  'media_contacto lee sus empresas',
  'SELECT', 'public',
  $q$sponsorhub.auth_es_media_contacto() AND id IN (SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids)$q$,
  NULL
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_billing_cycles',
  'media_contacto lee ciclos de sus empresas',
  'SELECT', 'public',
  $q$sponsorhub.auth_es_media_contacto() AND cliente_id IN (SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids)$q$,
  NULL
);

SELECT sponsorhub._0024_ensure_policy(
  'sponsorhub', 'media_assets_ejecutados',
  'media_contacto lee assets de sus empresas',
  'SELECT', 'public',
  $q$sponsorhub.auth_es_media_contacto()
    AND billing_cycle_id IN (
      SELECT bc.id FROM sponsorhub.media_billing_cycles bc
      WHERE bc.cliente_id IN (SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids)
    )$q$,
  NULL
);

-- ── 6) Storage policies (alias cliente_id explícito) ─────────────────────────
SELECT sponsorhub._0024_ensure_policy(
  'storage', 'objects',
  'media_contacto lee objetos insumos',
  'SELECT', 'authenticated',
  $q$bucket_id = 'sponsorhub-archivos'
    AND (storage.foldername(name))[1] = 'media-cliente'
    AND (storage.foldername(name))[2] IN (
      SELECT ids.cliente_id::text
      FROM sponsorhub.auth_media_cliente_ids() AS ids
    )$q$,
  NULL
);

SELECT sponsorhub._0024_ensure_policy(
  'storage', 'objects',
  'media_contacto sube objetos insumos',
  'INSERT', 'authenticated',
  NULL,
  $q$bucket_id = 'sponsorhub-archivos'
    AND (storage.foldername(name))[1] = 'media-cliente'
    AND (storage.foldername(name))[2] IN (
      SELECT ids.cliente_id::text
      FROM sponsorhub.auth_media_cliente_ids() AS ids
    )
    AND EXISTS (
      SELECT 1
      FROM sponsorhub.media_assets_ejecutados a
      JOIN sponsorhub.media_billing_cycles bc ON bc.id = a.billing_cycle_id
      WHERE a.id::text = (storage.foldername(name))[3]
        AND bc.cliente_id::text = (storage.foldername(name))[2]
        AND bc.cliente_id IN (
          SELECT ids.cliente_id FROM sponsorhub.auth_media_cliente_ids() AS ids
        )
    )$q$
);

-- ── 7) GRANTs de tabla (mínimo) ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_cliente_contactos
  TO postgres, service_role;
GRANT SELECT ON TABLE sponsorhub.media_cliente_contactos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.media_asset_insumos
  TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE sponsorhub.media_asset_insumos TO authenticated;

-- ── 8) Limpieza helpers internos ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS sponsorhub._0024_assert_column(text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS sponsorhub._0024_norm(text);
DROP FUNCTION IF EXISTS sponsorhub._0024_assert_pk(text, text[]);
DROP FUNCTION IF EXISTS sponsorhub._0024_assert_fk(text, text, text, text);
DROP FUNCTION IF EXISTS sponsorhub._0024_assert_index(text, text[], boolean);
DROP FUNCTION IF EXISTS sponsorhub._0024_policy_qual(text, text, text);
DROP FUNCTION IF EXISTS sponsorhub._0024_ensure_policy(text, text, text, text, text, text, text);

COMMIT;
