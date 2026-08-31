-- ============================================================
-- Store ERP — Migración 005: Trigger de invitación más robusto
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- Reescribe el trigger para que NO falle la creación del usuario
-- si algo sale mal internamente (evita "Database error saving new user")
create or replace function handle_invited_user()
returns trigger language plpgsql security definer as $$
declare
  v_org_id  uuid;
  v_role    text;
  v_name    text;
begin
  -- Solo actuar si vienen metadatos de invitación
  v_org_id := (new.raw_user_meta_data->>'org_id')::uuid;

  if v_org_id is null then
    return new;
  end if;

  v_role := coalesce(new.raw_user_meta_data->>'role', 'staff');
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Validar que el role sea válido
  if v_role not in ('owner','admin','staff','viewer') then
    v_role := 'staff';
  end if;

  -- Insertar perfil — ignorar si ya existe, no fallar si hay error
  begin
    insert into user_profiles (id, organization_id, full_name, role, status)
    values (new.id, v_org_id, v_name, v_role, 'active')
    on conflict (id) do nothing;
  exception when others then
    null; -- no fallar la creación del usuario
  end;

  -- Marcar invitación como aceptada — no fallar si no existe aún
  begin
    update organization_invitations
    set    status = 'accepted'
    where  email           = new.email
      and  organization_id = v_org_id
      and  status          = 'pending';
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- Verificar que el trigger sigue activo
drop trigger if exists on_invited_user_created on auth.users;
create trigger on_invited_user_created
  after insert on auth.users
  for each row execute function handle_invited_user();
