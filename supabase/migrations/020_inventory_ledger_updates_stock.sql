-- Migration 020: the actual root cause of "sold past stock and it never
-- decremented" — inventory_ledger has NEVER updated stock_levels. No
-- trigger connecting them ever existed in any prior migration; both the
-- POS and the storefront checkout only ever insert a ledger row and
-- assumed something else applied it to stock. This makes the ledger the
-- single source of truth going forward, for every channel automatically —
-- no app code needs to change.

create or replace function apply_inventory_ledger_to_stock()
returns trigger language plpgsql as $$
declare
  target_location uuid;
begin
  -- Reservation holds are tracked separately (inventory_reservations +
  -- stock_disponible) — they must never touch committed stock.
  if NEW.movement_type in ('reservation', 'reservation_release') then
    return NEW;
  end if;

  target_location := NEW.location_id;

  if target_location is null then
    select location_id into target_location
    from stock_levels
    where variant_id = NEW.variant_id
    order by quantity_available desc
    limit 1;
  end if;

  if target_location is null then
    select id into target_location
    from inventory_locations
    where organization_id = NEW.organization_id
    order by created_at
    limit 1;
  end if;

  if target_location is not null then
    insert into stock_levels (variant_id, location_id, quantity_available)
    values (NEW.variant_id, target_location, 0)
    on conflict (variant_id, location_id) do nothing;

    update stock_levels
    set quantity_available = quantity_available + NEW.quantity,
        updated_at = now()
    where variant_id = NEW.variant_id and location_id = target_location;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_inventory_ledger_apply_stock on inventory_ledger;
create trigger trg_inventory_ledger_apply_stock
  after insert on inventory_ledger
  for each row execute function apply_inventory_ledger_to_stock();
