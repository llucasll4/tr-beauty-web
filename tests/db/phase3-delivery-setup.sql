-- Phase 3 delivery monitoring: disposable PostgreSQL fixture only.
-- Run AFTER the existing finance setup and booking/points regressions.
\set ON_ERROR_STOP on
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  event_type text not null,
  status text not null,
  scheduled_for timestamptz not null,
  processed_at timestamptz,
  attempts smallint not null default 0
);
insert into public.notification_outbox(channel,event_type,status,scheduled_for,processed_at,attempts)
values
  ('email','booking_requested','pending',now()-interval '30 minutes',null,0),
  ('email','reminder_24h','pending',now()+interval '1 day',null,0),
  ('email','booking_confirmed','sent',now()-interval '2 hours',now()-interval '2 hours',1),
  ('email','booking_cancelled','processing',now()-interval '4 minutes',null,1),
  ('whatsapp','booking_confirmed','failed',now()-interval '30 minutes',now()-interval '25 minutes',1),
  ('whatsapp','reminder_24h','skipped',now()-interval '10 minutes',now()-interval '9 minutes',0);
