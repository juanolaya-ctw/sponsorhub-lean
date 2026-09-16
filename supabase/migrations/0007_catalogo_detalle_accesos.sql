-- ============================================================
-- 0007_catalogo_detalle_accesos.sql
--
-- Entregables por beneficio: instrucciones reales de Notion
-- (detalle_solicitud) + campos del formulario de accesos.
-- Pegar en el SQL Editor de Supabase y ejecutar.
--
-- `notas` ya existía en catalogo_beneficios desde 0002; se usa
-- IF NOT EXISTS para que re-ejecutar esta migración no falle.
-- compromiso_id vincula archivos y personas al beneficio concreto.
-- ============================================================

-- 1. Agregar detalle_solicitud al catálogo
ALTER TABLE sponsorhub.catalogo_beneficios
  ADD COLUMN IF NOT EXISTS detalle_solicitud text,
  ADD COLUMN IF NOT EXISTS notas text;

-- 2. Ampliar accesos_personas con los 10 campos reales del formulario de Notion
ALTER TABLE sponsorhub.accesos_personas
  ADD COLUMN IF NOT EXISTS documento_identidad text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS rol_ecosistema text,
  ADD COLUMN IF NOT EXISTS numero_celular text,
  ADD COLUMN IF NOT EXISTS pais_residencia text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS industria text,
  ADD COLUMN IF NOT EXISTS nivel_cargo text,
  ADD COLUMN IF NOT EXISTS compromiso_id uuid REFERENCES sponsorhub.compromisos(id) ON DELETE CASCADE;
-- (nombre, apellido, email ya existen)

ALTER TABLE sponsorhub.archivos
  ADD COLUMN IF NOT EXISTS compromiso_id uuid REFERENCES sponsorhub.compromisos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accesos_compromiso
  ON sponsorhub.accesos_personas(compromiso_id);
CREATE INDEX IF NOT EXISTS idx_archivos_compromiso
  ON sponsorhub.archivos(compromiso_id);

-- El sponsor debe poder reemplazar/eliminar SUS insumos y personas.
-- 0003 solo permitía SELECT + INSERT en estas tablas.
DROP POLICY IF EXISTS "sponsor actualiza sus insumos" ON sponsorhub.archivos;
CREATE POLICY "sponsor actualiza sus insumos" ON sponsorhub.archivos
  FOR UPDATE USING (
    sponsor_id = sponsorhub.auth_sponsor_id() AND direccion = 'sponsor_sube'
  ) WITH CHECK (
    sponsor_id = sponsorhub.auth_sponsor_id() AND direccion = 'sponsor_sube'
  );

DROP POLICY IF EXISTS "sponsor elimina sus insumos" ON sponsorhub.archivos;
CREATE POLICY "sponsor elimina sus insumos" ON sponsorhub.archivos
  FOR DELETE USING (
    sponsor_id = sponsorhub.auth_sponsor_id() AND direccion = 'sponsor_sube'
  );

DROP POLICY IF EXISTS "sponsor elimina sus accesos" ON sponsorhub.accesos_personas;
CREATE POLICY "sponsor elimina sus accesos" ON sponsorhub.accesos_personas
  FOR DELETE USING (sponsor_id = sponsorhub.auth_sponsor_id());

-- 3. Actualizar el catálogo de GovTech con los detalles reales
-- (los valores vienen del campo "Detalle de solicitud al sponsor" de Notion)

UPDATE sponsorhub.catalogo_beneficios SET
  detalle_solicitud = 'Solicitud de logo en .ai en blanco'
WHERE categoria = 'Branding / Logo'
  AND evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026');

UPDATE sponsorhub.catalogo_beneficios SET
  detalle_solicitud = 'Completa el formulario con los datos de cada persona:
1. Nombre completo
2. Documento de identidad
3. Correo corporativo
4. Perfil de LinkedIn
5. Rol dentro del ecosistema
6. Número de celular
7. País de residencia
8. Empresa
9. Industria
10. Nivel de cargo'
WHERE categoria IN ('Accesos generales', 'Accesos VIP')
  AND evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026');

UPDATE sponsorhub.catalogo_beneficios SET
  detalle_solicitud = 'Para publicar el newsletter necesitamos:
- Título (máx. 60 caracteres)
- Cuerpo (máx. 100 palabras)
- Imagen (1080×1080 px, formato .png)
- Link para el Call to Action (URL)',
  notas = 'Contenido no comercial. Se publica a nuestra base de datos.'
WHERE categoria = 'Newsletter'
  AND evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026');

UPDATE sponsorhub.catalogo_beneficios SET
  detalle_solicitud = 'Para tu participación como speaker, completa el formulario oficial: https://tally.so/r/pbNMvy — necesitamos esta información para tu acreditación y para incluirte en la agenda.'
WHERE categoria IN ('Speaker / Panel', 'Workshop')
  AND evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026');
