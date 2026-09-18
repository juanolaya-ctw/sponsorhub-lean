-- =============================================================================
-- 0011_usuarios_gestion.sql
--
-- Gestión de usuarios sponsor desde el panel admin. Amplía
-- sponsor_usuarios con perfil (nombre, cargo, teléfono), notas
-- internas de CS, y flag activo para desactivar sin borrar auth.
--
-- Idempotente: se puede re-ejecutar en el SQL Editor de Supabase.
-- No toca RLS: las policies existentes de sponsor_usuarios se
-- mantienen. Los nuevos campos los escribe admin_ct vía service_role;
-- el sponsor solo lee su propia fila (incluye activo, para el
-- layout del portal).
-- =============================================================================

ALTER TABLE sponsorhub.sponsor_usuarios
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS notas text;
