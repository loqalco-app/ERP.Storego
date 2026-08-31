-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on core tables
alter table user_profiles        enable row level security;
alter table organizations        enable row level security;
alter table products             enable row level security;
alter table product_variants     enable row level security;
alter table product_images       enable row level security;
alter table brands               enable row level security;
alter table categories           enable row level security;
alter table customers            enable row level security;
alter table customer_addresses   enable row level security;
alter table customer_interactions enable row level security;
alter table inventory_locations  enable row level security;
alter table inventory_ledger     enable row level security;
alter table stock_levels         enable row level security;
alter table user_roles           enable row level security;

-- ── user_profiles ──────────────────────────────────────────
-- Any authenticated user can read profiles in their org
create policy "users can view profiles in their org"
  on user_profiles for select
  to authenticated
  using (
    organization_id = (
      select organization_id from user_profiles where id = auth.uid()
    )
  );

-- Each user can update only their own profile
create policy "users can update own profile"
  on user_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── organizations ───────────────────────────────────────────
create policy "users can view own org"
  on organizations for select
  to authenticated
  using (
    id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── products ────────────────────────────────────────────────
create policy "org members can view products"
  on products for select
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can insert products"
  on products for insert
  to authenticated
  with check (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can update products"
  on products for update
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can delete products"
  on products for delete
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── product_variants ─────────────────────────────────────────
create policy "org members can view variants"
  on product_variants for select
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can manage variants"
  on product_variants for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── product_images ───────────────────────────────────────────
create policy "org members can manage product images"
  on product_images for all
  to authenticated
  using (
    variant_id in (
      select id from product_variants
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  );

-- ── brands ───────────────────────────────────────────────────
create policy "org members can manage brands"
  on brands for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── categories ───────────────────────────────────────────────
create policy "org members can manage categories"
  on categories for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── customers ────────────────────────────────────────────────
create policy "org members can view customers"
  on customers for select
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can manage customers"
  on customers for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── customer_addresses ───────────────────────────────────────
create policy "org members can manage customer addresses"
  on customer_addresses for all
  to authenticated
  using (
    customer_id in (
      select id from customers
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  );

-- ── customer_interactions ────────────────────────────────────
create policy "org members can manage customer interactions"
  on customer_interactions for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── inventory_locations ──────────────────────────────────────
create policy "org members can manage inventory locations"
  on inventory_locations for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── inventory_ledger ─────────────────────────────────────────
create policy "org members can view ledger"
  on inventory_ledger for select
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

create policy "org members can insert ledger"
  on inventory_ledger for insert
  to authenticated
  with check (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── stock_levels ─────────────────────────────────────────────
create policy "org members can manage stock"
  on stock_levels for all
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );

-- ── user_roles ───────────────────────────────────────────────
create policy "org members can view user roles"
  on user_roles for select
  to authenticated
  using (
    organization_id = (select organization_id from user_profiles where id = auth.uid())
  );
