-- Phase 4 / stage 2: truthful operating metrics and auditable admin no-shows.
-- This migration adds only new functions/table/triggers; no existing data is changed.
begin;

create table public.appointment_no_shows (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  recorded_by uuid not null default auth.uid() references public.profiles(id),
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  constraint p4_no_show_void_consistency check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null
       and char_length(btrim(coalesce(void_reason,''))) between 5 and 300)
  )
);
create unique index appointment_no_shows_one_active
  on public.appointment_no_shows(appointment_id) where voided_at is null;
create index appointment_no_shows_recorded_idx
  on public.appointment_no_shows(recorded_at desc);

alter table public.appointment_no_shows enable row level security;
create policy "Admin reads recorded absences" on public.appointment_no_shows
  for select to authenticated
  using ((select private.is_admin()) is true);
create policy "Admin records absences" on public.appointment_no_shows
  for insert to authenticated
  with check ((select private.is_admin()) is true
    and recorded_by=(select auth.uid()) and voided_at is null
    and voided_by is null and void_reason is null);
create policy "Admin voids absences" on public.appointment_no_shows
  for update to authenticated
  using ((select private.is_admin()) is true and voided_at is null)
  with check ((select private.is_admin()) is true
    and voided_at is not null and voided_by=(select auth.uid()));

revoke all on table public.appointment_no_shows from public,anon,authenticated;
grant select on table public.appointment_no_shows to authenticated;
grant insert(appointment_id) on table public.appointment_no_shows to authenticated;
grant update(voided_at,voided_by,void_reason)
  on table public.appointment_no_shows to authenticated;
comment on table public.appointment_no_shows is
  'Faltas declaradas manualmente pela Admin; somente após reserva confirmada e encerrada. Correções são anuladas com auditoria.';

create or replace function public.p4_guard_no_show_insert()
returns trigger language plpgsql security invoker set search_path=''
as $guard$
declare
  v_status text;
  v_end timestamptz;
begin
  if (select private.is_admin()) is not true
    or new.recorded_by is distinct from (select auth.uid()) then
    raise exception 'Registro de ausência restrito à administração' using errcode='42501';
  end if;
  select a.status,a.ends_at into v_status,v_end
    from public.appointments a where a.id=new.appointment_id for update;
  if not found or v_status <> 'confirmed' or v_end > pg_catalog.now() then
    raise exception 'Registre falta somente após o término de atendimento confirmado'
      using errcode='23514';
  end if;
  return new;
end;
$guard$;

create trigger p4_guard_no_show_insert
  before insert on public.appointment_no_shows
  for each row execute function public.p4_guard_no_show_insert();

create or replace function public.p4_guard_no_show_void()
returns trigger language plpgsql security invoker set search_path=''
as $guard$
begin
  if (select private.is_admin()) is not true
    or old.voided_at is not null then
    raise exception 'Anulação de ausência não permitida' using errcode='42501';
  end if;
  if new.id is distinct from old.id
    or new.appointment_id is distinct from old.appointment_id
    or new.recorded_by is distinct from old.recorded_by
    or new.recorded_at is distinct from old.recorded_at
    or new.voided_at is null
    or new.voided_by is distinct from (select auth.uid())
    or char_length(btrim(coalesce(new.void_reason,''))) not between 5 and 300 then
    raise exception 'Informe um motivo (5 a 300 caracteres) e não altere dados históricos'
      using errcode='23514';
  end if;
  new.void_reason:=btrim(new.void_reason);
  new.voided_at:=pg_catalog.now();
  return new;
end;
$guard$;

create trigger p4_guard_no_show_void
  before update on public.appointment_no_shows
  for each row execute function public.p4_guard_no_show_void();

-- Do not complete/cancel a booking already registered as absent without
-- first voiding the incorrect absence; prevents contradictory metrics.
create or replace function public.p4_guard_no_show_appointment_transition()
returns trigger language plpgsql security definer set search_path=''
as $guard$
begin
  if old.status='confirmed'
    and new.status in ('completed','cancelled')
    and exists (
      select 1 from public.appointment_no_shows n
      where n.appointment_id=old.id and n.voided_at is null
    ) then
    raise exception 'Reverta o registro de falta antes de concluir ou cancelar este atendimento'
      using errcode='23514';
  end if;
  return new;
end;
$guard$;

create trigger p4_guard_no_show_appointment_transition
  before update of status on public.appointments
  for each row execute function public.p4_guard_no_show_appointment_transition();

revoke all on function public.p4_guard_no_show_insert()
  from public,anon,authenticated;
revoke all on function public.p4_guard_no_show_void()
  from public,anon,authenticated;
revoke all on function public.p4_guard_no_show_appointment_transition()
  from public,anon,authenticated;

-- Metrics follow appointment date in America/Sao_Paulo, not cancellation timestamp.
-- Capacity: studio working windows minus calendar blocks, intersected by day.
-- Utilization: pending/confirmed/completed booking time + 15 min buffer,
-- clipped to working windows, removing any overlaps with blocked periods.
create or replace function public.p4_operational_metrics(
  p_year integer, p_month integer default null
) returns jsonb
language plpgsql stable security invoker set search_path=''
as $metrics$
declare
  v_first date;
  v_after date;
  v_start timestamptz;
  v_end timestamptz;
  v_calendar_minutes numeric := 0;
  v_blocked_minutes numeric := 0;
  v_booked_minutes numeric := 0;
  v_booked_block_overlap numeric := 0;
  v_counts jsonb;
  v_review jsonb;
begin
  if (select private.is_admin()) is not true then
    raise exception 'Métricas restritas à administração' using errcode='42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2099
     or (p_month is not null and (p_month < 1 or p_month > 12)) then
    raise exception 'Período inválido' using errcode='22023';
  end if;
  v_first:=pg_catalog.make_date(p_year,coalesce(p_month,1),1);
  v_after:=case when p_month is null then pg_catalog.make_date(p_year+1,1,1)
    else (v_first + interval '1 month')::date end;
  v_start:=v_first::timestamp at time zone 'America/Sao_Paulo';
  v_end:=v_after::timestamp at time zone 'America/Sao_Paulo';

  with working as (
    select (d.day::date+bh.opens_at) at time zone 'America/Sao_Paulo' as opening,
           (d.day::date+bh.closes_at) at time zone 'America/Sao_Paulo' as closing
    from pg_catalog.generate_series(v_first::timestamp,(v_after-1)::timestamp,interval '1 day') as d(day)
    join public.business_hours bh
      on bh.weekday=extract(dow from d.day)::integer
     and bh.enabled=true and bh.closes_at>bh.opens_at
  )
  select
    (select coalesce(sum(extract(epoch from (closing-opening))/60),0) from working),
    (select coalesce(sum(greatest(0,extract(epoch from
      least(b.end_at,w.closing)-greatest(b.start_at,w.opening))/60)),0)
     from working w join public.calendar_blocks b
       on b.start_at<w.closing and b.end_at>w.opening),
    (select coalesce(sum(greatest(0,extract(epoch from
      least(a.ends_at+interval '15 minutes',w.closing)
      -greatest(a.starts_at,w.opening))/60)),0)
     from working w join public.appointments a
       on a.status in ('pending','confirmed','completed')
      and a.starts_at<w.closing and a.ends_at+interval '15 minutes'>w.opening),
    (select coalesce(sum(greatest(0,extract(epoch from
      least(a.ends_at+interval '15 minutes',b.end_at,w.closing)
      -greatest(a.starts_at,b.start_at,w.opening))/60)),0)
     from working w join public.appointments a
       on a.status in ('pending','confirmed','completed')
      and a.starts_at<w.closing and a.ends_at+interval '15 minutes'>w.opening
      join public.calendar_blocks b
        on b.start_at<w.closing and b.end_at>w.opening
       and b.start_at<a.ends_at+interval '15 minutes' and b.end_at>a.starts_at)
  into v_calendar_minutes,v_blocked_minutes,v_booked_minutes,v_booked_block_overlap;

  select pg_catalog.jsonb_build_object(
    'bookings',count(*) filter (
      where not exists (select 1 from public.appointment_reschedules r
                        where r.old_appointment_id=a.id)),
    'completed',count(*) filter (where a.status='completed'),
    'cancelled',count(*) filter (where a.status='cancelled'
      and not exists (select 1 from public.appointment_reschedules r
                      where r.old_appointment_id=a.id)),
    'rescheduled',count(*) filter (where exists (
      select 1 from public.appointment_reschedules r
      where r.old_appointment_id=a.id)),
    'confirmed_no_shows',count(*) filter (where ns.id is not null),
    'unreviewed_confirmed',count(*) filter (
      where a.status='confirmed' and a.ends_at<pg_catalog.now() and ns.id is null),
    'unconfirmed_past',count(*) filter (
      where a.status='pending' and a.ends_at<pg_catalog.now()),
    'attended_or_absent',count(*) filter (
      where a.status='completed' or ns.id is not null)
  ) into v_counts
  from public.appointments a
  left join public.appointment_no_shows ns
    on ns.appointment_id=a.id and ns.voided_at is null
  where a.starts_at>=v_start and a.starts_at<v_end;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id',items.id,'starts_at',items.starts_at,
      'ends_at',items.ends_at,'client',items.client,
      'service',items.service,'status',items.status,
      'no_show_id',items.no_show_id
    ) order by items.starts_at desc,items.id),'[]'::jsonb)
    into v_review
  from (
    select a.id,a.starts_at,a.ends_at,a.status,
           coalesce(p.full_name,'Cliente') as client,
           coalesce(s.name,'Serviço') as service,
           ns.id as no_show_id
    from public.appointments a
    left join public.profiles p on p.id=a.client_id
    left join public.services s on s.id=a.service_id
    left join public.appointment_no_shows ns
      on ns.appointment_id=a.id and ns.voided_at is null
    where a.status in ('pending','confirmed')
      and a.ends_at<pg_catalog.now()
      and a.starts_at>=v_start and a.starts_at<v_end
    order by a.starts_at desc,a.id
    limit 40
  ) items;

  return pg_catalog.jsonb_build_object(
    'year',p_year,'month',p_month,'timezone','America/Sao_Paulo',
    'minutes',pg_catalog.jsonb_build_object(
      'capacity',greatest(0,v_calendar_minutes-v_blocked_minutes),
      'booked',least(greatest(0,v_calendar_minutes-v_blocked_minutes),
                     greatest(0,v_booked_minutes-v_booked_block_overlap)),
      'blocked',v_blocked_minutes
    ),
    'metrics',v_counts,
    'review',v_review,'review_limit',40
  );
end;
$metrics$;
revoke all on function public.p4_operational_metrics(integer,integer)
  from public,anon,authenticated;
grant execute on function public.p4_operational_metrics(integer,integer)
  to authenticated;
comment on function public.p4_operational_metrics(integer,integer) is
  'Admin KPIs: occupancy excludes blocked minutes, cancelled excludes reschedules; no-shows are explicitly recorded only.';
commit;
