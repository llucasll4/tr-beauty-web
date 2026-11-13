-- Phase 4 rescheduling: disposable database only; production remains untouched.
\set ON_ERROR_STOP on
alter table public.appointments add column if not exists notes text;
