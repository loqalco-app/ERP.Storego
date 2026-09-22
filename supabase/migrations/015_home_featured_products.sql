-- Curaduría del Home de la tienda: qué productos se muestran y en qué orden.
-- Si ningún producto está marcado, el storefront cae de vuelta a mostrar
-- todos los publicados (para que el Home nunca se vea vacío).
alter table products
  add column if not exists is_featured boolean not null default false,
  add column if not exists home_sort_order int not null default 0;

create index if not exists products_featured_idx on products (organization_id, is_featured, home_sort_order);
