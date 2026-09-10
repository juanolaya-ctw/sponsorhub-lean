-- Storage privado para archivos del portal.
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsorhub-archivos', 'sponsorhub-archivos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sponsor lee objetos propios" ON storage.objects;
CREATE POLICY "sponsor lee objetos propios"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sponsorhub-archivos'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

DROP POLICY IF EXISTS "sponsor sube objetos propios" ON storage.objects;
CREATE POLICY "sponsor sube objetos propios"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sponsorhub-archivos'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

DROP POLICY IF EXISTS "sponsor elimina objetos propios" ON storage.objects;
CREATE POLICY "sponsor elimina objetos propios"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sponsorhub-archivos'
    AND (storage.foldername(name))[1] = sponsorhub.auth_sponsor_id()::text
  );

CREATE OR REPLACE VIEW sponsorhub.v_timeline_sponsor AS
SELECT
  c.id AS compromiso_id,
  c.sponsor_id,
  COALESCE(cb.categoria, 'Otros') AS categoria,
  COALESCE(cb.beneficio, c.tipo) AS beneficio,
  ec.nombre AS estado_nombre,
  ec.color AS estado_color,
  ec.orden AS estado_orden,
  ec.es_estado_final,
  c.fecha_limite,
  c.updated_from_notion_at
FROM sponsorhub.compromisos c
LEFT JOIN sponsorhub.catalogo_beneficios cb
  ON cb.id = c.catalogo_beneficio_id
LEFT JOIN sponsorhub.estados_compromiso ec
  ON ec.id = c.estado_id
ORDER BY cb.orden, c.fecha_limite;

-- Las vistas son security definer por defecto. Fuerza que las tablas base
-- evalúen RLS con el usuario que consulta el timeline.
ALTER VIEW sponsorhub.v_timeline_sponsor SET (security_invoker = true);
