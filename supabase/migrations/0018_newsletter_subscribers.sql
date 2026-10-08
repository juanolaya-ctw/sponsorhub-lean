-- ============================================================
-- 0018_newsletter_subscribers.sql
--
-- Suscriptores del tab News (landing Lovable). Escritura solo vía
-- API pública de SponsorHub con service_role (no INSERT anon).
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsorhub.newsletter_subscribers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     uuid NOT NULL REFERENCES sponsorhub.eventos(id) ON DELETE CASCADE,
  email         text NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, email)
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_evento_idx
  ON sponsorhub.newsletter_subscribers (evento_id, subscribed_at DESC);

ALTER TABLE sponsorhub.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Sin policies para anon/authenticated: solo service_role (bypass RLS)
-- vía createAdminClient en POST /api/public/newsletter.

GRANT ALL ON TABLE sponsorhub.newsletter_subscribers TO postgres, service_role;
-- Grants de tabla al rol authenticated/anon existen por DEFAULT PRIVILEGES
-- del schema, pero sin policy RLS no pueden leer ni escribir.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sponsorhub.newsletter_subscribers
  TO anon, authenticated;
