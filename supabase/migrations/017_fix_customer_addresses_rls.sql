-- Migration 017: re-create the missing RLS policy on customer_addresses
-- RLS was enabled on this table but the policy never took effect, so the
-- ERP's own dashboard (authenticated role) could never read/write addresses
-- (only the service-role checkout endpoint could, since it bypasses RLS).

drop policy if exists "org members can manage customer addresses" on customer_addresses;

create policy "org members can manage customer addresses"
  on customer_addresses for all
  to authenticated
  using (
    customer_id in (
      select id from customers
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  )
  with check (
    customer_id in (
      select id from customers
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  );
