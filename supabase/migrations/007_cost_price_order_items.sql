-- ============================================================
-- Store ERP — Migración 007: Costo en order_items
-- Ejecutar en: Supabase → SQL Editor → New query
-- ============================================================

-- 1. Agregar columna cost_price a order_items si no existe
alter table order_items
  add column if not exists cost_price numeric(12,2) not null default 0 check (cost_price >= 0);

-- 2. Retroalimentar órdenes existentes con el costo actual del producto
--    (solo actualiza filas donde cost_price aún es 0 y la variante tiene costo)
update order_items oi
set    cost_price = pv.cost_price
from   product_variants pv
where  oi.variant_id    = pv.id
  and  oi.cost_price    = 0
  and  pv.cost_price    > 0;
