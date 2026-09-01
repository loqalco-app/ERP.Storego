-- ============================================================
-- Store ERP — Migración 006: Contraseña temporal obligatoria
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

alter table user_profiles
  add column if not exists must_change_password boolean not null default false;
