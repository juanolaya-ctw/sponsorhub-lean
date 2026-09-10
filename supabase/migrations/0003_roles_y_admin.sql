-- ============================================================
-- 0003_roles_y_admin.sql
--
-- Introduce el rol de usuario (admin_ct vs sponsor). Hasta ahora
-- sponsor_usuarios asumía que TODO usuario pertenece a un sponsor;
-- el panel admin para CS/Growth requiere usuarios sin sponsor
-- asociado. Reescribe RLS para reflejar exactamente la separación
-- de funciones acordada:
--   - El sponsor NUNCA edita estado de compromiso — solo lee, como
--     timeline.
--   - El sponsor sube SUS insumos (direccion sponsor_sube) y
--     descarga lo que CT entrega (direccion ctw_entrega).
--   - admin_ct (CS/Growth) es la única superficie que escribe
--     estado, gestiona catálogo, y crea/edita los estados posibles.
-- ============================================================

-- sponsor_id pasa a ser NULLABLE: un admin_ct no tiene sponsor
ALTER TABLE sponsorhub.sponsor_usuarios
    ALTER COLUMN sponsor_id DROP NOT NULL;

ALTER TABLE sponsorhub.sponsor_usuarios
    ADD COLUMN rol text NOT NULL DEFAULT 'sponsor'
    CHECK (rol IN ('admin_ct', 'sponsor'));

-- Integridad: un admin_ct NO debe tener sponsor_id; un sponsor
-- SIEMPRE debe tenerlo. Evita un dato mal cargado que deje a un
-- admin "atado" a un sponsor por error de carga.
ALTER TABLE sponsorhub.sponsor_usuarios
    ADD CONSTRAINT chk_rol_sponsor_consistente CHECK (
        (rol = 'admin_ct' AND sponsor_id IS NULL) OR
        (rol = 'sponsor' AND sponsor_id IS NOT NULL)
    );

-- El primer usuario admin_ct se promueve manualmente por SQL Editor
-- (decisión explícita: no se construye flujo de invitación hoy).
-- Ejemplo, una vez ese usuario exista en auth.users tras registrarse:
--   UPDATE sponsorhub.sponsor_usuarios SET rol = 'admin_ct', sponsor_id = NULL
--   WHERE email = 'persona@colombiatech.com';

CREATE OR REPLACE FUNCTION sponsorhub.auth_sponsor_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sponsor_id FROM sponsorhub.sponsor_usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION sponsorhub.auth_es_admin_ct()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT rol = 'admin_ct' FROM sponsorhub.sponsor_usuarios WHERE id = auth.uid()),
    false
  )
$$;

-- ============================================================
-- RLS reescrito por tabla
-- ============================================================

-- sponsors
DROP POLICY IF EXISTS "sponsor lee su propio registro" ON sponsorhub.sponsors;
CREATE POLICY "acceso a sponsors segun rol" ON sponsorhub.sponsors
  FOR SELECT USING (
    sponsorhub.auth_es_admin_ct() OR id = sponsorhub.auth_sponsor_id()
  );
CREATE POLICY "admin_ct gestiona sponsors" ON sponsorhub.sponsors
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- compromisos: el sponsor SOLO lee (regla explícita: nunca edita estado)
DROP POLICY IF EXISTS "sponsor lee sus compromisos" ON sponsorhub.compromisos;
CREATE POLICY "lectura compromisos segun rol" ON sponsorhub.compromisos
  FOR SELECT USING (
    sponsorhub.auth_es_admin_ct() OR sponsor_id = sponsorhub.auth_sponsor_id()
  );
CREATE POLICY "solo admin_ct inserta compromisos" ON sponsorhub.compromisos
  FOR INSERT WITH CHECK (sponsorhub.auth_es_admin_ct());
CREATE POLICY "solo admin_ct edita compromisos" ON sponsorhub.compromisos
  FOR UPDATE USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- archivos: sponsor sube SOLO sus insumos; admin_ct sube entregables
-- de CT y ve/gestiona todo
DROP POLICY IF EXISTS "sponsor lee y sube sus archivos" ON sponsorhub.archivos;
DROP POLICY IF EXISTS "sponsor inserta sus propios archivos" ON sponsorhub.archivos;

CREATE POLICY "lectura archivos segun rol" ON sponsorhub.archivos
  FOR SELECT USING (
    sponsorhub.auth_es_admin_ct() OR sponsor_id = sponsorhub.auth_sponsor_id()
  );
CREATE POLICY "sponsor inserta solo sus insumos" ON sponsorhub.archivos
  FOR INSERT WITH CHECK (
    sponsor_id = sponsorhub.auth_sponsor_id() AND direccion = 'sponsor_sube'
  );
CREATE POLICY "admin_ct inserta entregables de CT" ON sponsorhub.archivos
  FOR INSERT WITH CHECK (
    sponsorhub.auth_es_admin_ct() AND direccion = 'ctw_entrega'
  );
CREATE POLICY "admin_ct gestiona todos los archivos" ON sponsorhub.archivos
  FOR UPDATE USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- accesos_personas: mismo patrón — sponsor inserta lo suyo, admin_ct
-- ve y gestiona todo
DROP POLICY IF EXISTS "sponsor lee y gestiona sus accesos" ON sponsorhub.accesos_personas;
DROP POLICY IF EXISTS "sponsor inserta sus propios accesos" ON sponsorhub.accesos_personas;

CREATE POLICY "lectura accesos segun rol" ON sponsorhub.accesos_personas
  FOR SELECT USING (
    sponsorhub.auth_es_admin_ct() OR sponsor_id = sponsorhub.auth_sponsor_id()
  );
CREATE POLICY "sponsor inserta sus accesos" ON sponsorhub.accesos_personas
  FOR INSERT WITH CHECK (sponsor_id = sponsorhub.auth_sponsor_id());
CREATE POLICY "admin_ct gestiona todos los accesos" ON sponsorhub.accesos_personas
  FOR UPDATE USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- evidencias: sin cambios de fondo, pero admin_ct necesita poder
-- insertar (antes solo existía policy de lectura del sponsor)
CREATE POLICY "admin_ct gestiona evidencias" ON sponsorhub.evidencias
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- notificaciones: admin_ct (CS) las crea; sponsor solo lee (ya existía)
CREATE POLICY "admin_ct gestiona notificaciones" ON sponsorhub.notificaciones
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- estados_compromiso: Growth (admin_ct) crea/edita/elimina sin
-- depender de un desarrollador — este es el punto central de hoy
DROP POLICY IF EXISTS "solo admin_ct gestiona estados" ON sponsorhub.estados_compromiso;
CREATE POLICY "admin_ct gestiona estados" ON sponsorhub.estados_compromiso
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- catalogo_beneficios: mismo patrón
CREATE POLICY "admin_ct gestiona catalogo" ON sponsorhub.catalogo_beneficios
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- eventos: admin_ct necesita poder ver/gestionar eventos (workspace
-- selector del panel); antes no existía RLS sobre esta tabla porque
-- solo el cron de sync la tocaba
ALTER TABLE sponsorhub.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_ct lee y gestiona eventos" ON sponsorhub.eventos
  FOR ALL USING (sponsorhub.auth_es_admin_ct()) WITH CHECK (sponsorhub.auth_es_admin_ct());

-- ============================================================
-- Vista de timeline para el portal del sponsor (solo lectura,
-- agrupada por estado dinámico — no por % de avance)
-- ============================================================

CREATE VIEW sponsorhub.v_timeline_sponsor AS
SELECT
    c.id AS compromiso_id,
    c.sponsor_id,
    cb.categoria,
    cb.beneficio,
    ec.nombre AS estado_nombre,
    ec.color AS estado_color,
    ec.orden AS estado_orden,
    ec.es_estado_final,
    c.fecha_limite,
    c.updated_from_notion_at
FROM sponsorhub.compromisos c
LEFT JOIN sponsorhub.catalogo_beneficios cb ON cb.id = c.catalogo_beneficio_id
LEFT JOIN sponsorhub.estados_compromiso ec ON ec.id = c.estado_id
ORDER BY cb.orden, c.fecha_limite;

-- Nota: las vistas heredan RLS de las tablas base en Postgres, así
-- que esta vista respeta automáticamente las policies de arriba sin
-- lógica de seguridad adicional.
