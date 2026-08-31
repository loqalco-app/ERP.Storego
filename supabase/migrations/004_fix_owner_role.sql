-- ============================================================
-- Store ERP — Migración 004: Corregir rol de propietario
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- Actualiza al primer miembro de cada organización a 'owner'
-- (el usuario más antiguo = quien creó la cuenta)
update user_profiles up
set    role = 'owner'
where  role = 'staff'
  and  id = (
    select id
    from   user_profiles up2
    where  up2.organization_id = up.organization_id
    order  by created_at asc
    limit  1
  );
