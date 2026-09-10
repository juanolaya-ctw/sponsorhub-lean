-- ============================================================
-- 0002_catalogo_beneficios.sql
--
-- Catálogo de beneficios por tier + generación automática de
-- compromisos. Resuelve el problema reportado por CS/Growth tras
-- la demo: los compromisos no reflejaban lo que realmente le
-- corresponde a cada sponsor según su tier — antes se cargaban a
-- mano, sin relación a un catálogo real.
--
-- Fuente real: "📦 Catálogo de Beneficios por Paquete GovTech" en
-- Notion (collection://3d499829-d217-80c3-bdf2-000bc2830c3a).
-- GovTech tiene este catálogo estructurado; CTW/CTF NO lo tiene
-- todavía (su info vive mezclada en el Customer Success Board de
-- 60+ campos). Por eso el trigger de generación automática solo
-- produce efecto donde exista catálogo cargado — CTW/CTF sigue
-- con compromisos manuales sin romperse, porque simplemente no
-- hay filas de catálogo para sus tiers todavía.
-- ============================================================

CREATE TABLE sponsorhub.catalogo_beneficios (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id     uuid NOT NULL REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE,
    tier          text NOT NULL,       -- texto libre, no enum: varía por evento
                                        -- (Associate/Elite/Deluxe Partner en GovTech;
                                        -- Diamond/Platinum/Gold/etc. eventualmente en CTW/CTF)
    categoria     text NOT NULL,       -- 'Branding / Logo', 'Accesos VIP', 'Accesos generales',
                                        -- 'Newsletter', 'Stand', 'Speaker / Panel', 'Add-on / Descuento'
    beneficio     text NOT NULL,
    cantidad      integer,             -- para beneficios cuantificables (accesos, % descuento)
    notas         text,
    orden         integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalogo_evento_tier ON sponsorhub.catalogo_beneficios(evento_id, tier);

-- compromisos gana una referencia opcional al catálogo — opcional
-- porque CTW/CTF sigue creando compromisos sin catálogo (manual)
ALTER TABLE sponsorhub.compromisos
    ADD COLUMN catalogo_beneficio_id uuid REFERENCES sponsorhub.catalogo_beneficios(id);

-- ============================================================
-- Estados de compromiso — tabla editable, NO enum.
-- Growth debe poder crear/editar estados sin depender de una
-- migración de código (un enum fijo requeriría ALTER TYPE cada
-- vez, es decir, depender de un desarrollador). Reemplaza el
-- enum compromiso_estado de 0001_init.sql.
-- ============================================================

CREATE TABLE sponsorhub.estados_compromiso (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       uuid REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE, -- NULL = disponible para todos los eventos
    nombre          text NOT NULL,
    color           text,                         -- para el timeline visual del sponsor
    orden           integer NOT NULL DEFAULT 0,   -- posición en el timeline
    es_estado_final boolean NOT NULL DEFAULT false,
    created_by      uuid REFERENCES sponsorhub.sponsor_usuarios(id), -- NULL para los estados seed
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (evento_id, nombre)
);

-- Seed inicial — Growth puede editar, agregar o quitar estos después
-- desde el panel admin; esto NO es un valor fijo, es punto de partida.
INSERT INTO sponsorhub.estados_compromiso (evento_id, nombre, color, orden, es_estado_final) VALUES
    (NULL, 'Pendiente',    '#94a3b8', 1, false),
    (NULL, 'En progreso',  '#42B3F3', 2, false),
    (NULL, 'Vencido',      '#ef4444', 3, false),
    (NULL, 'Publicado',    '#22c55e', 4, false),
    (NULL, 'Completado',   '#16a34a', 5, true);

-- compromisos: reemplaza el enum estado (de 0001) + porcentaje
-- (ya no aplica — Growth definió que el seguimiento es por status,
-- no por %) por una referencia a estados_compromiso
ALTER TABLE sponsorhub.compromisos
    DROP COLUMN estado,
    DROP COLUMN porcentaje,
    ADD COLUMN estado_id uuid REFERENCES sponsorhub.estados_compromiso(id);

-- El tipo enum compromiso_estado de 0001_init.sql queda sin uso.
-- No se elimina (DROP TYPE) por si algo externo aún lo referencia;
-- limpiar en una migración posterior si se confirma que no hay uso.

-- ============================================================
-- Generación automática de compromisos al asignar/cambiar tier
-- ============================================================

CREATE OR REPLACE FUNCTION sponsorhub.generar_compromisos_desde_catalogo()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.paquete IS DISTINCT FROM OLD.paquete) THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generar_compromisos
  AFTER INSERT OR UPDATE OF paquete ON sponsorhub.sponsors
  FOR EACH ROW
  EXECUTE FUNCTION sponsorhub.generar_compromisos_desde_catalogo();

ALTER TABLE sponsorhub.catalogo_beneficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorhub.estados_compromiso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cualquier autenticado lee el catalogo"
  ON sponsorhub.catalogo_beneficios FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "cualquier autenticado lee estados"
  ON sponsorhub.estados_compromiso FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies de escritura de estados_compromiso y catalogo_beneficios
-- (restringidas a admin_ct) se crean en 0003_roles_y_admin.sql, una
-- vez exista el concepto de rol.
