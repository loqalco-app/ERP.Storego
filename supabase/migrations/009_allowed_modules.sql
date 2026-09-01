-- Permisos de módulos por usuario.
-- NULL = usar los defaults del rol. Array = override explícito.
alter table user_profiles
  add column if not exists allowed_modules text[];
