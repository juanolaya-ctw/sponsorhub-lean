-- =============================================================================
-- 0023_media_acuerdo_configurable.sql
-- Bloque 1: tarifa de referencia por crédito + acuerdo por ciclo (monto/fechas).
-- Ejecutar manualmente en SQL Editor como UNA sola transacción (BEGIN/COMMIT).
-- Los BEGIN internos de DO $$ no sustituyen esta transacción global.
-- NO hardcodea tarifas. NO infiere monto/tarifa/fechas en históricos.
-- NO borra/fusiona/reemplaza objetos incompatibles: aborta con motivo.
-- Conserva UNIQUE legacy (sponsor_id, periodo). No cambia policies/grants portal.
-- =============================================================================

BEGIN;

-- ── Compatibilidad de columnas nuevas (si ya existen, deben coincidir) ───────
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(format('%s.%s:%s', table_name, column_name, data_type), ', ')
  INTO bad
  FROM information_schema.columns
  WHERE table_schema = 'sponsorhub'
    AND (
      (table_name = 'media_planes' AND column_name = 'tarifa_credito_usd'
        AND NOT (data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 4))
      OR (table_name = 'media_billing_cycles' AND column_name = 'monto_contratado_usd'
        AND NOT (data_type = 'numeric' AND numeric_precision = 12 AND numeric_scale = 2))
      OR (table_name = 'media_billing_cycles' AND column_name = 'fecha_inicio'
        AND data_type IS DISTINCT FROM 'date')
      OR (table_name = 'media_billing_cycles' AND column_name = 'fecha_fin'
        AND data_type IS DISTINCT FROM 'date')
      OR (table_name = 'media_billing_cycles' AND column_name = 'tarifa_credito_usd'
        AND NOT (data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 4))
    );

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION
      '0023 aborted: incompatible existing column definition(s): %. Do not drop/replace automatically.',
      bad;
  END IF;
END $$;

ALTER TABLE sponsorhub.media_planes
  ADD COLUMN IF NOT EXISTS tarifa_credito_usd numeric(10,4);

ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS monto_contratado_usd numeric(12,2);

ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS fecha_inicio date;

ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS fecha_fin date;

ALTER TABLE sponsorhub.media_billing_cycles
  ADD COLUMN IF NOT EXISTS tarifa_credito_usd numeric(10,4);

COMMENT ON COLUMN sponsorhub.media_planes.tarifa_credito_usd IS
  'Tarifa de referencia USD por crédito del catálogo. No se deduce de precio_usd/créditos.';
COMMENT ON COLUMN sponsorhub.media_billing_cycles.monto_contratado_usd IS
  'Monto total contratado USD del acuerdo. NULL = nunca registrado (no inferir).';
COMMENT ON COLUMN sponsorhub.media_billing_cycles.fecha_inicio IS
  'Inicio del uso contratado. NULL en históricos sin fechas confirmadas.';
COMMENT ON COLUMN sponsorhub.media_billing_cycles.fecha_fin IS
  'Fin del uso contratado. NULL en históricos sin fechas confirmadas.';
COMMENT ON COLUMN sponsorhub.media_billing_cycles.tarifa_credito_usd IS
  'Snapshot de tarifa al acordar. Editar el catálogo no debe cambiar este valor.';

-- ── CHECK fecha rango: crear o verificar definición + validado ───────────────
DO $$
DECLARE
  existing_def text;
  expected_def text :=
    'CHECK (((fecha_inicio IS NULL) OR (fecha_fin IS NULL) OR (fecha_fin >= fecha_inicio)))';
  is_validated boolean;
BEGIN
  SELECT pg_get_constraintdef(c.oid), c.convalidated
  INTO existing_def, is_validated
  FROM pg_constraint c
  WHERE c.conname = 'media_billing_cycles_fecha_rango_chk'
    AND c.conrelid = 'sponsorhub.media_billing_cycles'::regclass;

  IF existing_def IS NOT NULL THEN
    IF replace(existing_def, ' ', '') IS DISTINCT FROM replace(expected_def, ' ', '') THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_fecha_rango_chk exists with incompatible definition: %. Expected: %.',
        existing_def, expected_def;
    END IF;
    IF NOT COALESCE(is_validated, false) THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_fecha_rango_chk exists but is NOT VALIDATED.';
    END IF;
  ELSE
    ALTER TABLE sponsorhub.media_billing_cycles
      ADD CONSTRAINT media_billing_cycles_fecha_rango_chk
      CHECK (
        fecha_inicio IS NULL
        OR fecha_fin IS NULL
        OR fecha_fin >= fecha_inicio
      );
  END IF;
END $$;

-- ── Propiedad: relajar NOT NULL solo si aún aplica (idempotente) ─────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'sponsorhub'
      AND table_name = 'media_billing_cycles'
      AND column_name = 'sponsor_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sponsorhub.media_billing_cycles
      ALTER COLUMN sponsor_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'sponsorhub'
      AND table_name = 'media_assets_ejecutados'
      AND column_name = 'sponsor_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE sponsorhub.media_assets_ejecutados
      ALTER COLUMN sponsor_id DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN sponsorhub.media_billing_cycles.sponsor_id IS
  'Sponsor portal (legacy). NULL permitido si hay cliente_id (CRM sin portal).';
COMMENT ON COLUMN sponsorhub.media_assets_ejecutados.sponsor_id IS
  'Copia opcional del sponsor del ciclo. NULL en ciclos solo-cliente.';

-- ── Owner CHECK + abort si hay huérfanos ─────────────────────────────────────
DO $$
DECLARE
  orphan_count integer;
  existing_def text;
  expected_def text :=
    'CHECK (((sponsor_id IS NOT NULL) OR (cliente_id IS NOT NULL)))';
  is_validated boolean;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM sponsorhub.media_billing_cycles
  WHERE sponsor_id IS NULL AND cliente_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      '0023 aborted: % cycle(s) have neither sponsor_id nor cliente_id. Resolve ownership manually before re-running.',
      orphan_count;
  END IF;

  SELECT pg_get_constraintdef(c.oid), c.convalidated
  INTO existing_def, is_validated
  FROM pg_constraint c
  WHERE c.conname = 'media_billing_cycles_owner_chk'
    AND c.conrelid = 'sponsorhub.media_billing_cycles'::regclass;

  IF existing_def IS NOT NULL THEN
    IF replace(existing_def, ' ', '') IS DISTINCT FROM replace(expected_def, ' ', '') THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_owner_chk exists with incompatible definition: %. Expected: %.',
        existing_def, expected_def;
    END IF;
    IF NOT COALESCE(is_validated, false) THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_owner_chk exists but is NOT VALIDATED.';
    END IF;
  ELSE
    ALTER TABLE sponsorhub.media_billing_cycles
      ADD CONSTRAINT media_billing_cycles_owner_chk
      CHECK (sponsor_id IS NOT NULL OR cliente_id IS NOT NULL);
  END IF;
END $$;

-- ── Unique parcial (cliente_id, periodo): abort si duplicados o índice incompatible
DO $$
DECLARE
  dup_groups integer;
  sample text;
  existing_def text;
  expected_def text :=
    'CREATE UNIQUE INDEX media_billing_cycles_cliente_periodo_uidx ON sponsorhub.media_billing_cycles USING btree (cliente_id, periodo) WHERE (cliente_id IS NOT NULL)';
  is_valid boolean;
  is_unique boolean;
BEGIN
  SELECT COUNT(*) INTO dup_groups
  FROM (
    SELECT cliente_id, periodo
    FROM sponsorhub.media_billing_cycles
    WHERE cliente_id IS NOT NULL
    GROUP BY cliente_id, periodo
    HAVING COUNT(*) > 1
  ) d;

  IF dup_groups > 0 THEN
    SELECT string_agg(format('%s @ %s (x%s)', cliente_id, periodo, cnt), ', ')
    INTO sample
    FROM (
      SELECT cliente_id::text, periodo::text, COUNT(*)::text AS cnt
      FROM sponsorhub.media_billing_cycles
      WHERE cliente_id IS NOT NULL
      GROUP BY cliente_id, periodo
      HAVING COUNT(*) > 1
      LIMIT 5
    ) s;

    RAISE EXCEPTION
      '0023 aborted: % duplicate (cliente_id, periodo) group(s). Resolve manually before re-running. Sample: %',
      dup_groups,
      COALESCE(sample, '(none)');
  END IF;

  SELECT pg_get_indexdef(x.indexrelid), x.indisvalid, x.indisunique
  INTO existing_def, is_valid, is_unique
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_index x ON x.indrelid = t.oid
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE n.nspname = 'sponsorhub'
    AND t.relname = 'media_billing_cycles'
    AND i.relname = 'media_billing_cycles_cliente_periodo_uidx';

  IF existing_def IS NOT NULL THEN
    IF replace(lower(existing_def), ' ', '')
       IS DISTINCT FROM replace(lower(expected_def), ' ', '') THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_cliente_periodo_uidx exists with incompatible definition: %. Expected: %.',
        existing_def, expected_def;
    END IF;
    IF NOT COALESCE(is_unique, false) THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_cliente_periodo_uidx exists but is not UNIQUE.';
    END IF;
    IF NOT COALESCE(is_valid, false) THEN
      RAISE EXCEPTION
        '0023 aborted: media_billing_cycles_cliente_periodo_uidx exists but is NOT VALID.';
    END IF;
  ELSE
    EXECUTE $idx$
      CREATE UNIQUE INDEX media_billing_cycles_cliente_periodo_uidx
        ON sponsorhub.media_billing_cycles (cliente_id, periodo)
        WHERE cliente_id IS NOT NULL
    $idx$;
  END IF;
END $$;

-- Conservar UNIQUE legacy (sponsor_id, periodo): solo verificar presencia, no alterar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'sponsorhub.media_billing_cycles'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(sponsor_id, periodo)%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'sponsorhub'
      AND tablename = 'media_billing_cycles'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(sponsor_id, periodo)%'
  ) THEN
    RAISE EXCEPTION
      '0023 aborted: legacy UNIQUE (sponsor_id, periodo) not found. Refusing to continue without it.';
  END IF;
END $$;

COMMIT;
