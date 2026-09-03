-- product_images RLS checked variant_id, which is NULL for standard (no-color)
-- product photos — "NULL IN (...)" is never true, so every photo insert for a
-- standard product was silently blocked. Check product_id instead, which is
-- always present.

drop policy if exists "org members can manage product images" on product_images;

create policy "org members can manage product images"
  on product_images for all
  to authenticated
  using (
    product_id in (
      select id from products
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  )
  with check (
    product_id in (
      select id from products
      where organization_id = (select organization_id from user_profiles where id = auth.uid())
    )
  );
