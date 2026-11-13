-- Phase 4 operation KPIs: disposable Postgres only. This file never touches production.
\set ON_ERROR_STOP on
grant select on public.business_hours,public.calendar_blocks,
  public.appointment_reschedules to authenticated;
-- Actual Supabase has RLS on business_hours and calendar_blocks; in the
-- isolated fixture, these SELECT grants model the existing Admin policies.
