-- Admin: bloquear dias inteiros ou intervalos sem permitir novas reservas.
-- Datas convertidas pelo PostgreSQL de America/Sao_Paulo para timestamptz UTC.
begin;

create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint calendar_blocks_valid_range check (end_at > start_at),
  constraint calendar_blocks_reason_limit check (length(coalesce(reason,'')) <= 200),
  constraint calendar_blocks_no_overlap exclude using gist (
    tstzrange(start_at,end_at,'[)') with &&
  )
);
create index calendar_blocks_upcoming on public.calendar_blocks(start_at, end_at);
alter table public.calendar_blocks enable row level security;
create policy "Admin can see calendar blocks"
  on public.calendar_blocks for select to authenticated
  using ((select private.is_admin()));
create policy "Admin can create calendar blocks"
  on public.calendar_blocks for insert to authenticated
  with check ((select private.is_admin()) and created_by=(select auth.uid()));
create policy "Admin can remove calendar blocks"
  on public.calendar_blocks for delete to authenticated
  using ((select private.is_admin()));
revoke all on public.calendar_blocks from public, anon;
grant select,insert,delete on public.calendar_blocks to authenticated;
grant all on public.calendar_blocks to service_role;

-- Escritas de reservas e de bloqueios usam o mesmo lock transacional.
-- Isso impede corridas entre confirmação de nova reserva e criação de bloqueio.
create or replace function public.calendar_blocks_reservation_guard()
returns trigger language plpgsql security definer set search_path = ''
as $guard$
begin
  if new.status in ('pending','confirmed') then
    perform pg_catalog.pg_advisory_xact_lock(20261111, 15);
    if exists (
      select 1 from public.calendar_blocks b
      where b.start_at < new.ends_at + interval '15 minutes'
        and b.end_at > new.starts_at
    ) then
      raise exception 'Horário bloqueado pelo estúdio. Escolha outra data ou horário.'
        using errcode='23P01';
    end if;
  end if;
  return new;
end;
$guard$;
create trigger appointments_respect_calendar_blocks
before insert or update of starts_at,ends_at,status on public.appointments
for each row execute function public.calendar_blocks_reservation_guard();

create or replace function public.calendar_blocks_appointment_guard()
returns trigger language plpgsql security definer set search_path = ''
as $guard$
begin
  perform pg_catalog.pg_advisory_xact_lock(20261111,15);
  if exists (
    select 1 from public.appointments a
    where a.status in ('pending','confirmed')
      and a.starts_at < new.end_at
      and a.ends_at + interval '15 minutes' > new.start_at
  ) then
    raise exception 'Existem agendamentos ativos neste período. Cancele ou reagende antes de bloquear.'
      using errcode='23P01';
  end if;
  return new;
end;
$guard$;
create trigger calendar_blocks_respect_existing_appointments
before insert or update of start_at,end_at on public.calendar_blocks
for each row execute function public.calendar_blocks_appointment_guard();

create or replace function public.admin_create_calendar_block(
  p_start_date date,
  p_end_date date,
  p_all_day boolean,
  p_start_time time default null,
  p_end_time time default null,
  p_reason text default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $rpc$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_id uuid;
begin
  if (select private.is_admin()) is distinct from true then
    raise exception 'Acesso restrito à administração' using errcode='42501';
  end if;
  if p_start_date is null or p_end_date is null or p_all_day is null
     or p_end_date < p_start_date or p_end_date > p_start_date + 90 then
    raise exception 'Informe um período válido de até 90 dias' using errcode='22023';
  end if;
  if p_all_day then
    v_start := p_start_date::timestamp at time zone 'America/Sao_Paulo';
    v_end := (p_end_date + 1)::timestamp at time zone 'America/Sao_Paulo';
  else
    if p_start_date <> p_end_date or p_start_time is null or p_end_time is null
       or p_end_time <= p_start_time then
      raise exception 'Para bloquear horários, selecione um dia e o intervalo inicial e final' using errcode='22023';
    end if;
    v_start := (p_start_date + p_start_time) at time zone 'America/Sao_Paulo';
    v_end := (p_start_date + p_end_time) at time zone 'America/Sao_Paulo';
  end if;
  if v_end <= now() then
    raise exception 'Não é possível bloquear um período já encerrado' using errcode='22023';
  end if;
  if length(coalesce(p_reason,'')) > 200 then
    raise exception 'Descrição muito longa (máximo 200 caracteres)' using errcode='22023';
  end if;
  insert into public.calendar_blocks (start_at,end_at,reason,created_by)
  values(v_start,v_end,nullif(trim(coalesce(p_reason,'')),''),(select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$rpc$;
revoke execute on function public.admin_create_calendar_block(date,date,boolean,time,time,text)
  from public,anon;
grant execute on function public.admin_create_calendar_block(date,date,boolean,time,time,text)
  to authenticated,service_role;

-- A agenda dinâmica agora vê períodos bloqueados além de reservas existentes.
create or replace function public.available_slots(
  p_service_id uuid,
  p_date date
)
returns table(starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_duration integer;
  v_open time;
  v_close time;
  v_open_at timestamptz;
  v_close_at timestamptz;
  v_cursor timestamptz;
  v_gap_end timestamptz;
  v_latest_start timestamptz;
  v_buffer constant interval := interval '15 minutes';
  v_now timestamptz := pg_catalog.now();
  v_booking record;
  v_strict_close boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Faça login para consultar horários' using errcode = '42501';
  end if;
  if p_date is null or p_service_id is null then
    raise exception 'Informe o serviço e a data' using errcode = '22023';
  end if;

  if p_date < (v_now at time zone 'America/Sao_Paulo')::date
     or p_date > (v_now at time zone 'America/Sao_Paulo')::date + 90 then
    raise exception 'Data fora do período permitido' using errcode = '22023';
  end if;

  select s.duration_minutes into v_duration
  from public.services s
  where s.id = p_service_id and s.active = true;
  if not found or v_duration is null or v_duration <= 0 then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;

  select bh.opens_at, bh.closes_at into v_open, v_close
  from public.business_hours bh
  where bh.weekday = extract(dow from p_date)
    and bh.enabled = true;
  if not found or v_open is null or v_close is null or v_close <= v_open then
    return;
  end if;

  v_open_at := (p_date + v_open) at time zone 'America/Sao_Paulo';
  v_close_at := (p_date + v_close) at time zone 'America/Sao_Paulo';
  v_cursor := v_open_at;
  -- Terça (2) e quinta (4) exigem conclusão + 15 min até 18h.
  -- Quarta, sexta e sábado aceitam INÍCIO até o horário de fechamento (20h).
  v_strict_close := extract(dow from p_date) in (2, 4);

  for v_booking in
    select occupied.busy_start, occupied.busy_end
    from (
      select a.starts_at as busy_start, a.ends_at + v_buffer as busy_end
      from public.appointments a
      where a.status in ('pending', 'confirmed')
        and a.starts_at < v_close_at
        and a.ends_at + v_buffer > v_open_at
      union all
      select b.start_at as busy_start, b.end_at as busy_end
      from public.calendar_blocks b
      where b.start_at < v_close_at
        and b.end_at > v_open_at
    ) occupied
    order by occupied.busy_start, occupied.busy_end
  loop
    v_gap_end := least(v_booking.busy_start, v_close_at);
    v_latest_start := v_gap_end
      - pg_catalog.make_interval(mins => v_duration) - v_buffer;

    if v_cursor <= v_latest_start then
      return query
        select candidate.slot_start
        from pg_catalog.generate_series(
          v_cursor, v_latest_start, interval '15 minutes'
        ) as candidate(slot_start)
        where candidate.slot_start > v_now
          and candidate.slot_start <= v_now + interval '90 days'
        order by candidate.slot_start;
    end if;

    v_cursor := greatest(v_cursor, v_booking.busy_end);
    if v_cursor > v_close_at then
      return;
    end if;
  end loop;

  -- Última lacuna: nos dias estritos, o atendimento e o setup terminam
  -- até o fechamento. Nos demais, 20h é o ÚLTIMO HORÁRIO DE INÍCIO.
  v_latest_start := case when v_strict_close
    then v_close_at - pg_catalog.make_interval(mins => v_duration) - v_buffer
    else v_close_at
  end;

  if v_cursor <= v_latest_start then
    if v_strict_close then
      return query
        select candidate.slot_start
        from pg_catalog.generate_series(
          v_cursor, v_latest_start, interval '15 minutes'
        ) as candidate(slot_start)
        where candidate.slot_start > v_now
          and candidate.slot_start <= v_now + interval '90 days'
          and not exists (
            select 1 from public.appointments a
            where a.status in ('pending','confirmed')
              and a.starts_at < candidate.slot_start
                    + pg_catalog.make_interval(mins => v_duration) + v_buffer
              and a.ends_at + v_buffer > candidate.slot_start
          )
          and not exists (
            select 1 from public.calendar_blocks b
            where b.start_at < candidate.slot_start +
              pg_catalog.make_interval(mins => v_duration) + v_buffer
              and b.end_at > candidate.slot_start
          )
        order by candidate.slot_start;
    else
      -- Inclui o horário de fechamento explicitamente mesmo quando o
      -- início dinâmico da lacuna não está alinhado a blocos de 15 min.
      return query
        select candidates.slot_start
        from (
          select gs.slot_start
          from pg_catalog.generate_series(
            v_cursor, v_latest_start, interval '15 minutes'
          ) as gs(slot_start)
          union
          select v_close_at
        ) as candidates
        where candidates.slot_start >= v_cursor
          and candidates.slot_start <= v_close_at
          and candidates.slot_start > v_now
          and candidates.slot_start <= v_now + interval '90 days'
          and not exists (
            select 1 from public.appointments a
            where a.status in ('pending','confirmed')
              and a.starts_at < candidates.slot_start
                    + pg_catalog.make_interval(mins => v_duration) + v_buffer
              and a.ends_at + v_buffer > candidates.slot_start
          )
          and not exists (
            select 1 from public.calendar_blocks b
            where b.start_at < candidates.slot_start +
              pg_catalog.make_interval(mins => v_duration) + v_buffer
              and b.end_at > candidates.slot_start
          )
        order by candidates.slot_start;
    end if;
  end if;
end;
$function$;

-- Uma chamada direta à RPC de agendamento não pode contornar a nova
-- regra. A exclusão GiST é a defesa final contra concorrência.

comment on table public.calendar_blocks is
  'Intervalos indisponíveis definidos pela administração; a RPC de agenda e triggers de segurança impedem novas reservas conflitantes.';

commit;