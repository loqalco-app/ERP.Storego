-- ============================================================
-- Store ERP — Migración 003: Gestión de equipo
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- 1. Agregar columna role a user_profiles
alter table user_profiles
  add column if not exists role text not null default 'staff'
    check (role in ('owner','admin','staff','viewer'));

-- 2. Tabla de invitaciones pendientes
create table if not exists organization_invitations (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            text not null default 'staff'
    check (role in ('admin','staff','viewer')),
  invited_by      uuid references auth.users(id),
  status          text not null default 'pending'
    check (status in ('pending','accepted','expired','cancelled')),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  unique (organization_id, email, status)
);

create index if not exists on organization_invitations (organization_id, status);
create index if not exists on organization_invitations (email);

-- 3. Trigger: al crear un usuario invitado, crear su user_profile con org y rol
create or replace function handle_invited_user()
returns trigger language plpgsql security definer as $$
declare
  v_org_id  uuid;
  v_role    text;
  v_name    text;
begin
  v_org_id := (new.raw_user_meta_data->>'org_id')::uuid;
  v_role   := coalesce(new.raw_user_meta_data->>'role', 'staff');
  v_name   := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  if v_org_id is not null then
    insert into user_profiles (id, organization_id, full_name, role, status)
    values (new.id, v_org_id, v_name, v_role, 'active')
    on conflict (id) do nothing;

    update organization_invitations
    set    status = 'accepted'
    where  email           = new.email
      and  organization_id = v_org_id
      and  status          = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists on_invited_user_created on auth.users;
create trigger on_invited_user_created
  after insert on auth.users
  for each row execute function handle_invited_user();

-- 4. RLS para organization_invitations
alter table organization_invitations enable row level security;

create policy "Members can view invitations of their org"
  on organization_invitations for select
  using (
    organization_id = (
      select organization_id from user_profiles where id = auth.uid()
    )
  );

create policy "Admins can insert invitations"
  on organization_invitations for insert
  with check (
    organization_id = (
      select organization_id from user_profiles where id = auth.uid()
    )
    and (
      select role from user_profiles where id = auth.uid()
    ) in ('owner','admin')
  );

create policy "Admins can update invitations"
  on organization_invitations for update
  using (
    organization_id = (
      select organization_id from user_profiles where id = auth.uid()
    )
    and (
      select role from user_profiles where id = auth.uid()
    ) in ('owner','admin')
  );

-- 5. RLS adicional para user_profiles (role management)
create policy "Admins can update member roles"
  on user_profiles for update
  using (
    organization_id = (
      select organization_id from user_profiles up2 where up2.id = auth.uid()
    )
    and (
      select role from user_profiles up3 where up3.id = auth.uid()
    ) in ('owner','admin')
    and id != auth.uid()  -- no puede cambiar su propio rol
  );
