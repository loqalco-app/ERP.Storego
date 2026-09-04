-- stock_disponible is a plain view, which in Postgres runs with the
-- privileges of its owner (bypassing RLS on the underlying stock_levels /
-- inventory_reservations tables) — Supabase's linter flags this as a
-- "Security Definer View". Supabase grants SELECT on public-schema views to
-- anon/authenticated by default, so without this fix any client holding the
-- public anon key could query stock_disponible directly via PostgREST and
-- read stock levels across every organization, bypassing the per-org RLS
-- policy on stock_levels.
--
-- Only /api/store/products/[slug] reads this view, and it does so with the
-- service_role key (which always bypasses grants), so locking anon/
-- authenticated out doesn't break anything.

revoke select on stock_disponible from anon, authenticated;
