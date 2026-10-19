-- Alinea detalle_solicitud de Newsletter con specs del formato de envío
-- (1200×675, ≤20 KB) y Do's & Don'ts editoriales.

UPDATE sponsorhub.catalogo_beneficios SET
  detalle_solicitud = 'Para publicar el newsletter necesitamos:
- Título (máx. 60 caracteres)
- Cuerpo (máx. 100 palabras)
- Imagen editorial (1200×675 px, PNG, máx. 20 KB) — no uses el logo como imagen de la pieza
- Link para el Call to Action (URL)
Contenido: tono aspiracional, un solo CTA, sin lenguaje comercial.',
  notas = 'Contenido no comercial. Se publica a nuestra base de datos. Imágenes ya comprimidas/optimizadas.'
WHERE categoria = 'Newsletter'
  AND evento_id = (SELECT id FROM sponsorhub.eventos WHERE slug = 'govtech-2026');
