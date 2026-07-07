-- Informational hotel fields: security deposit (a hold the HOTEL collects at
-- check-in — never charged through LastKey) and a contact phone number.
-- Display-only: neither value may enter revenue, analytics, bid amounts, or
-- guest price calculations.

alter table public.hotels
  add column if not exists deposit_amount numeric default 0,
  add column if not exists phone text;

comment on column public.hotels.deposit_amount is
  'Informational display only. Never aggregate into revenue or analytics. Collected by hotel, not LastKey.';
