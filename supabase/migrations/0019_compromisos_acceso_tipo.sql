-- Override opcional del tipo de acceso (vip|general) por compromiso.
-- Si es NULL, se infiere del nombre del beneficio (p. ej. "1 acceso VIP").
ALTER TABLE sponsorhub.compromisos
  ADD COLUMN IF NOT EXISTS acceso_tipo text
  CHECK (acceso_tipo IS NULL OR acceso_tipo IN ('vip', 'general'));

COMMENT ON COLUMN sponsorhub.compromisos.acceso_tipo IS
  'Override admin: vip|general. NULL = inferir del nombre del beneficio.';
