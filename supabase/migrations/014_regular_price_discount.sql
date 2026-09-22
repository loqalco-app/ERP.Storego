-- "Precio regular" = precio de lista (ej. tiendas departamentales).
-- sale_price sigue siendo el precio real de venta. Cuando regular_price > sale_price,
-- el producto está en descuento — el % se calcula al vuelo, no se guarda.
alter table product_variants
  add column if not exists regular_price numeric(12,2) check (regular_price is null or regular_price >= 0);
