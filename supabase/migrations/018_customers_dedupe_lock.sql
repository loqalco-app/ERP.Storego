-- Migration 018: hard lock against duplicate customers per organization.
-- A customer is the same person if they share the same email OR the same
-- phone within the org — enforced at the DB level so no code path (POS,
-- storefront checkout, CRM form) can create a duplicate by mistake.

create unique index if not exists customers_org_email_uniq
  on customers (organization_id, lower(email))
  where email is not null;

create unique index if not exists customers_org_phone_uniq
  on customers (organization_id, phone)
  where phone is not null;
