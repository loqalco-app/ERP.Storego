-- Migration 019: let owners/admins edit their org settings (bank details
-- live in organizations.settings jsonb), and a reference column on
-- order_payments to hold a pasted payment-link URL or transfer reference.

create policy "owners and admins can update their org"
  on organizations for update
  to authenticated
  using (
    id = (select organization_id from user_profiles where id = auth.uid())
    and (select role from user_profiles where id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    id = (select organization_id from user_profiles where id = auth.uid())
    and (select role from user_profiles where id = auth.uid()) in ('owner', 'admin')
  );

alter table order_payments add column if not exists reference text;
