-- Migration 011: inventory_reservations + stock_disponible view
-- Implements anti-oversell pattern: reserve stock on cart add, release on payment or expiry.

-- ─── Tabla de reservas de carrito ─────────────────────────────────────────
create table if not exists inventory_reservations (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  variant_id      uuid not null references product_variants(id) on delete cascade,
  quantity        int  not null check (quantity > 0),
  session_id      text not null,            -- carrito / checkout session token
  status          text not null default 'pending'
    check (status in ('pending', 'confirmed', 'released', 'expired')),
  expires_at      timestamptz not null default (now() + interval '15 minutes'),
  order_id        uuid references orders(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ir_variant_status_idx   on inventory_reservations(variant_id, status);
create index if not exists ir_session_idx           on inventory_reservations(session_id);
create index if not exists ir_org_idx               on inventory_reservations(organization_id);
create index if not exists ir_expires_pending_idx   on inventory_reservations(expires_at)
  where status = 'pending';

-- ─── Vista: stock disponible (total - reservas activas de carrito) ─────────
create or replace view stock_disponible as
select
  sl.variant_id,
  sl.location_id,
  sl.quantity_available,
  sl.quantity_reserved,
  sl.quantity_damaged,
  coalesce(
    sum(ir.quantity) filter (where ir.status = 'pending' and ir.expires_at > now()),
    0
  )::int as quantity_cart_reserved,
  greatest(
    sl.quantity_available - coalesce(
      sum(ir.quantity) filter (where ir.status = 'pending' and ir.expires_at > now()),
      0
    )::int,
    0
  ) as quantity_disponible
from stock_levels sl
left join inventory_reservations ir on ir.variant_id = sl.variant_id
group by sl.variant_id, sl.location_id, sl.quantity_available, sl.quantity_reserved, sl.quantity_damaged;

-- ─── Índice en products.slug para búsquedas del storefront ────────────────
create index if not exists products_slug_idx on products(slug) where slug is not null;
create index if not exists products_published_idx on products(organization_id, is_published);
