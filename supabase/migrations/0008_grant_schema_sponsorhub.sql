-- Permisos del schema sponsorhub para la API (PostgREST).
-- Sin USAGE, el cron (service_role) responde:
--   permission denied for schema sponsorhub
-- Pegar en el SQL Editor de Supabase si el sync / admin fallan con ese error.

GRANT USAGE ON SCHEMA sponsorhub TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA sponsorhub TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sponsorhub TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA sponsorhub TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sponsorhub
  TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sponsorhub
  TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA sponsorhub
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sponsorhub
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sponsorhub
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA sponsorhub
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
