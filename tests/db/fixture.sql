-- Isolated Postgres 17 fixture. Never touches production Supabase.
\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table public.profiles(id uuid primary key,role text not null default 'client');
create table public.services (
 id uuid primary key,name text not null,active boolean not null default true,
 duration_minutes integer not null check(duration_minutes>0),price numeric(10,2) not null,
 redeem_points integer
);
create table public.business_hours (
 weekday integer primary key check(weekday between 0 and 6),
 enabled boolean not null,opens_at time not null,closes_at time not null
);
insert into public.business_hours(weekday,enabled,opens_at,closes_at)
select d,d between 2 and 6,
 case when d in(2,4) then time '09:00' else time '08:00' end,
 case when d in(2,4) then time '18:00' else time '20:00' end
from generate_series(0,6) d;
create table public.appointments(
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id),
 service_id uuid not null references public.services(id),
 starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null default 'pending',
 price_at_booking numeric(10,2) not null default 0,
 points_redeemed integer
);
alter table public.appointments add constraint no_overlapping_appointments
exclude using gist (
 tsrange(starts_at at time zone 'UTC',
  (ends_at at time zone 'UTC')+interval '15 minutes','[)') with &&
) where(status in('pending','confirmed'));
create table public.calendar_blocks(
 id uuid primary key default gen_random_uuid(),
 start_at timestamptz not null,end_at timestamptz not null,
 constraint calendar_blocks_no_overlap exclude using gist
 (tstzrange(start_at,end_at,'[)') with &&)
);
create table public.loyalty_settings(
 id integer primary key, enabled boolean not null,
 points_per_real integer not null, goal_points integer not null
);
create table public.points_ledger(
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.profiles(id),
 appointment_id uuid references public.appointments(id),
 points integer not null,description text not null,event_type text not null,
 created_at timestamptz not null default now()
);
create unique index points_earned_once_per_appointment
 on public.points_ledger(appointment_id) where event_type='earned';
create unique index points_ledger_one_redemption_refund
 on public.points_ledger(appointment_id)
 where event_type='reversal' and description='Estorno de agendamento TR Points cancelado';
insert into public.profiles(id) values
('00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002');
insert into public.services(id,name,active,duration_minutes,price,redeem_points) values
('00000000-0000-4000-8000-000000000120','Serviço 120min',true,120,120,120),
('00000000-0000-4000-8000-000000000060','Serviço 60min',true,60,60,100);
insert into public.loyalty_settings values (1,true,1,300);
