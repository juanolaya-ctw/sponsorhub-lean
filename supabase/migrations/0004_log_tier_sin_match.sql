CREATE TABLE sponsorhub.alertas_sync (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            text NOT NULL,
    sponsor_id      uuid REFERENCES sponsorhub.sponsors(id) ON DELETE CASCADE,
    evento_id       uuid REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE,
    detalle         text NOT NULL,
    resuelta        boolean NOT NULL DEFAULT false,
    resuelta_por    uuid REFERENCES sponsorhub.sponsor_usuarios(id),
    resuelta_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alertas_sync_pendientes ON sponsorhub.alertas_sync(resuelta) WHERE resuelta = false;

CREATE OR REPLACE FUNCTION sponsorhub.generar_compromisos_desde_catalogo()
RETURNS TRIGGER AS $$
DECLARE
  v_tiene_catalogo boolean;
  v_filas_insertadas integer;
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.paquete IS DISTINCT FROM OLD.paquete) THEN

    SELECT EXISTS (
      SELECT 1 FROM sponsorhub.catalogo_beneficios WHERE evento_id = NEW.evento_id
    ) INTO v_tiene_catalogo;

    INSERT INTO sponsorhub.compromisos (sponsor_id, tipo, catalogo_beneficio_id, estado_id)
    SELECT
      NEW.id,
      cb.beneficio,
      cb.id,
      (SELECT id FROM sponsorhub.estados_compromiso
       WHERE nombre = 'Pendiente' AND (evento_id = NEW.evento_id OR evento_id IS NULL)
       ORDER BY evento_id NULLS LAST LIMIT 1)
    FROM sponsorhub.catalogo_beneficios cb
    WHERE cb.evento_id = NEW.evento_id
      AND cb.tier = NEW.paquete
      AND NOT EXISTS (
        SELECT 1 FROM sponsorhub.compromisos c
        WHERE c.sponsor_id = NEW.id AND c.catalogo_beneficio_id = cb.id
      );

    GET DIAGNOSTICS v_filas_insertadas = ROW_COUNT;

    IF v_tiene_catalogo AND v_filas_insertadas = 0 THEN
      INSERT INTO sponsorhub.alertas_sync (tipo, sponsor_id, evento_id, detalle)
      VALUES (
        'tier_sin_match',
        NEW.id,
        NEW.evento_id,
        format(
          'El sponsor "%s" tiene paquete/tier "%s", que no coincide con ningún tier del catálogo de beneficios de este evento.',
          NEW.nombre, NEW.paquete
        )
      );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE sponsorhub.alertas_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ct gestiona alertas de sync"
  ON sponsorhub.alertas_sync FOR ALL
  USING (sponsorhub.auth_es_admin_ct())
  WITH CHECK (sponsorhub.auth_es_admin_ct());