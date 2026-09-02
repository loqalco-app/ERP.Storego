-- Migration 010: order source channel + seller attribution
-- Adds `source` column to track where each order came from (POS, ecommerce, manual)
-- and ensures created_by is indexed for fast joins to user_profiles.

alter table orders
  add column if not exists source text not null default 'pos'
    check (source in ('pos', 'ecommerce', 'manual'));

-- Backfill existing rows (all pre-migration orders came from POS)
update orders set source = 'pos' where source is null or source = 'pos';

-- Index for filtering by source in reports
create index if not exists orders_source_idx on orders(organization_id, source);

-- Index for joining created_by → user_profiles
create index if not exists orders_created_by_idx on orders(created_by);
