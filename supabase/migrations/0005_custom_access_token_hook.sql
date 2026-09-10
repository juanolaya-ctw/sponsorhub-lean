-- Inyecta el rol de SponsorHub en app_metadata del access token.
-- El dashboard debe activar esta función como Custom Access Token Hook.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rol text;
BEGIN
  SELECT rol
  INTO v_rol
  FROM sponsorhub.sponsor_usuarios
  WHERE id = (event->>'user_id')::uuid;

  IF v_rol IS NOT NULL THEN
    event := jsonb_set(
      event,
      '{claims,app_metadata,rol}',
      to_jsonb(v_rol)
    );
  END IF;

  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA sponsorhub TO supabase_auth_admin;
GRANT SELECT ON sponsorhub.sponsor_usuarios TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

-- sponsor_usuarios tiene RLS: el GRANT de tabla no basta por sí solo.
DROP POLICY IF EXISTS "auth hook lee roles"
  ON sponsorhub.sponsor_usuarios;
CREATE POLICY "auth hook lee roles"
  ON sponsorhub.sponsor_usuarios
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
