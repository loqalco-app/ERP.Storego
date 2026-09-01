create table if not exists parked_sales (
  id              uuid          primary key default gen_random_uuid(),
  organization_id uuid          not null references organizations(id) on delete cascade,
  saved_by        uuid          references auth.users(id) on delete set null,
  customer_id     uuid          references customers(id) on delete set null,
  customer_name   text,
  cart            jsonb         not null default '[]',
  total           numeric(12,2) not null default 0,
  saved_at        timestamptz   not null default now()
);

alter table parked_sales enable row level security;

create policy "parked_sales_org_access"
  on parked_sales for all
  using (
    organization_id = (
      select organization_id from user_profiles where id = auth.uid()
    )
  );

create index parked_sales_org_idx on parked_sales(organization_id, saved_at desc);
