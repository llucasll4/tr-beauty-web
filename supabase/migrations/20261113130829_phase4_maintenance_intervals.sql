-- Phase 4 / stage 3: opt-in maintenance cadence per nail service.
-- Existing services remain with NULL cadence (no suggestion) until Admin configures it.
begin;
alter table public.services
  add column maintenance_interval_days integer
  constraint services_maintenance_interval_days_valid
    check (maintenance_interval_days between 14 and 90);
comment on column public.services.maintenance_interval_days is
  'Optional Admin-configured number of days after a completed appointment to suggest returning for this service; NULL disables suggestions. Does not book or message the client.';
-- The existing services SELECT/UPDATE RLS policies remain in force.
commit;
