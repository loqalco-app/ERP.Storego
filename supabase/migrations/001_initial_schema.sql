-- ============================================================
-- Store ERP — Migración 001: Esquema inicial (Fase 1 MVP)
-- ============================================================
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANIZACIÓN
-- ============================================================
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  settings    jsonb not null default '{}',
  status      text not null default 'active' check (status in ('active', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- PERFILES DE USUARIO (extiende auth.users de Supabase)
-- ============================================================
create table user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name       text not null,
  phone           text,
  avatar_url      text,
  status          text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- ROLES Y PERMISOS (RBAC)
-- ============================================================
create table roles (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table permissions (
  id          uuid primary key default uuid_generate_v4(),
  code        text unique not null,  -- ej: 'customers.write'
  description text,
  module      text not null          -- ej: 'customers'
);

create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id         uuid not null references user_profiles(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  primary key (user_id, role_id)
);

-- ============================================================
-- CATÁLOGO: MARCAS Y CATEGORÍAS
-- ============================================================
create table brands (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  logo_url        text,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table categories (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_id       uuid references categories(id) on delete set null,
  name            text not null,
  slug            text not null,
  description     text,
  sort_order      int not null default 0,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

-- ============================================================
-- PRODUCTOS Y VARIANTES
-- ============================================================
create table products (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id     uuid references categories(id) on delete set null,
  brand_id        uuid references brands(id) on delete set null,
  name            text not null,
  description     text,
  condition       text not null default 'new' check (condition in ('new', 'used', 'refurbished')),
  -- SEO y tienda pública
  slug            text not null,
  seo_title       text,
  seo_description text,
  is_published    boolean not null default false,
  published_at    timestamptz,
  -- Estado
  status          text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  -- Metadatos
  attributes      jsonb not null default '{}',
  tags            text[] not null default '{}',
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create table product_variants (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  name            text not null,               -- ej: "Negro Talla 27"
  sku             text not null,
  barcode         text,
  sale_price      numeric(12,2) not null check (sale_price >= 0),
  cost_price      numeric(12,2) not null default 0 check (cost_price >= 0),
  weight_grams    int,
  attributes      jsonb not null default '{}', -- {"color":"Negro","talla":"27"}
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, sku)
);

create table product_images (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id) on delete cascade,
  variant_id  uuid references product_variants(id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  int not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INVENTARIO
-- ============================================================
create table inventory_locations (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  description     text,
  is_default      boolean not null default false,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now()
);

-- Ledger inmutable — fuente de verdad del inventario
create table inventory_ledger (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  variant_id      uuid not null references product_variants(id) on delete cascade,
  location_id     uuid references inventory_locations(id),
  movement_type   text not null check (movement_type in (
    'purchase',       -- entrada por compra
    'sale',           -- salida por venta
    'adjustment',     -- ajuste manual
    'return_in',      -- devolución recibida
    'return_out',     -- devolución enviada
    'transfer_in',    -- transferencia entrante
    'transfer_out',   -- transferencia saliente
    'reservation',    -- reserva temporal
    'reservation_release' -- liberación de reserva
  )),
  quantity        numeric(12,3) not null, -- positivo=entrada, negativo=salida
  unit_cost       numeric(12,2),          -- costo congelado al momento
  source_type     text,                   -- 'order', 'purchase', 'adjustment', etc.
  source_id       uuid,                   -- ID de la entidad origen
  notes           text,
  performed_by    uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- Stock actual (dato derivado para consultas rápidas)
create table stock_levels (
  variant_id      uuid not null references product_variants(id) on delete cascade,
  location_id     uuid not null references inventory_locations(id) on delete cascade,
  quantity_available numeric(12,3) not null default 0,
  quantity_reserved  numeric(12,3) not null default 0,
  quantity_damaged   numeric(12,3) not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (variant_id, location_id)
);

-- ============================================================
-- CRM: CLIENTES
-- ============================================================
create table customers (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  tax_id          text,                    -- RFC u otro ID fiscal
  notes           text,
  tags            text[] not null default '{}',
  credit_limit    numeric(12,2) not null default 0,
  balance_owing   numeric(12,2) not null default 0,
  status          text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table customer_addresses (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references customers(id) on delete cascade,
  label           text not null default 'Casa',  -- 'Casa', 'Trabajo', etc.
  street          text not null,
  neighborhood    text,
  city            text not null,
  state           text not null,
  zip_code        text,
  country         text not null default 'MX',
  references      text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

create table customer_interactions (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references customers(id) on delete cascade,
  type            text not null check (type in ('note', 'call', 'whatsapp', 'email', 'visit')),
  content         text not null,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- AUDITORÍA
-- ============================================================
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id),
  actor_id    uuid references auth.users(id),
  action      text not null,        -- ej: 'product.published'
  entity_type text not null,        -- ej: 'product'
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index on user_profiles (organization_id);
create index on products (organization_id, status);
create index on products (organization_id, is_published);
create index on product_variants (product_id);
create index on product_variants (organization_id, sku);
create index on inventory_ledger (variant_id, created_at desc);
create index on inventory_ledger (organization_id, movement_type);
create index on stock_levels (variant_id);
create index on customers (organization_id, status);
create index on customers (organization_id, email);
create index on audit_logs (organization_id, created_at desc);
create index on audit_logs (entity_type, entity_id);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations for each row execute function set_updated_at();
create trigger trg_user_profiles_updated_at  before update on user_profiles  for each row execute function set_updated_at();
create trigger trg_brands_updated_at         before update on brands          for each row execute function set_updated_at();
create trigger trg_categories_updated_at     before update on categories      for each row execute function set_updated_at();
create trigger trg_products_updated_at       before update on products         for each row execute function set_updated_at();
create trigger trg_product_variants_updated_at before update on product_variants for each row execute function set_updated_at();
create trigger trg_customers_updated_at      before update on customers        for each row execute function set_updated_at();

-- ============================================================
-- PERMISOS INICIALES DEL SISTEMA
-- ============================================================
insert into permissions (code, description, module) values
  ('customers.read',       'Ver clientes',              'customers'),
  ('customers.write',      'Crear y editar clientes',   'customers'),
  ('customers.delete',     'Eliminar clientes',         'customers'),
  ('products.read',        'Ver productos',             'products'),
  ('products.write',       'Crear y editar productos',  'products'),
  ('products.publish',     'Publicar productos',        'products'),
  ('products.delete',      'Eliminar productos',        'products'),
  ('inventory.read',       'Ver inventario',            'inventory'),
  ('inventory.adjust',     'Ajustar inventario',        'inventory'),
  ('inventory.purchase',   'Registrar compras',         'inventory'),
  ('sales.read',           'Ver ventas',                'sales'),
  ('sales.create',         'Crear ventas / POS',        'sales'),
  ('sales.cancel',         'Cancelar ventas',           'sales'),
  ('payments.read',        'Ver pagos',                 'payments'),
  ('payments.refund',      'Procesar reembolsos',       'payments'),
  ('finance.read',         'Ver finanzas',              'finance'),
  ('reports.read',         'Ver reportes',              'reports'),
  ('reports.export',       'Exportar reportes',         'reports'),
  ('users.read',           'Ver usuarios',              'users'),
  ('users.manage',         'Gestionar usuarios',        'users'),
  ('audit.read',           'Ver auditoría',             'audit'),
  ('settings.manage',      'Configurar sistema',        'settings');
