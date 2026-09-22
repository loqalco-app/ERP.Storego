-- Migration 016: push_subscriptions
-- Web Push subscriptions for the admin PWA (notify team of new web orders).

create table if not exists push_subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists push_subscriptions_org_idx on push_subscriptions(organization_id);

alter table push_subscriptions enable row level security;

create policy "org members manage their push subscriptions"
  on push_subscriptions for all
  using (
    organization_id in (
      select organization_id from user_profiles where id = auth.uid()
    )
  )
  with check (
    organization_id in (
      select organization_id from user_profiles where id = auth.uid()
    )
  );
