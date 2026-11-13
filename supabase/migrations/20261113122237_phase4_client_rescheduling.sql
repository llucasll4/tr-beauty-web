-- Phase 4: atomic client rescheduling, reuse calendar rules and preserve history.
-- Only schema/function definitions; no existing appointment data modified.
begin;
create table public.appointment_reschedules (
  id uuid primary key default gen_random_uuid(),
  old_appointment_id uuid not null unique references public.appointments(id) on delete restrict,
  new_appointment_id uuid not null unique references public.appointments(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  previous_starts_at timestamptz not null,
  new_starts_at timestamptz not null,
  previous_status text not null check (previous_status in ('pending','confirmed')),
  requested_at timestamptz not null default pg_catalog.now(),
  constraint appointment_reschedules_changed_time check (previous_starts_at <> new_starts_at),
  constraint appointment_reschedules_distinct_ids check (old_appointment_id <> new_appointment_id)
);
create index appointment_reschedules_client_requested_idx
  on public.appointment_reschedules (client_id,requested_at desc);
alter table public.appointment_reschedules enable row level security;
create policy "Read own rescheduling history or admin"
  on public.appointment_reschedules for select to authenticated
  using ((select auth.uid()) = client_id or (select private.is_admin()) is true);
revoke all on public.appointment_reschedules from public,anon,authenticated;
grant select on public.appointment_reschedules to authenticated;
comment on table public.appointment_reschedules is
  'Trilha de reagendamentos: antiga cancelada, nova pendente de aprovacao.';

-- The exact availability algorithm from production, with original appointment
-- excluded from the busy intervals. Execution is still ownership-checked.
CREATE OR REPLACE FUNCTION public.available_reschedule_slots(p_appointment_id uuid, p_date date)
 RETURNS TABLE(starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_original public.appointments%rowtype;
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
  select a.* into v_original from public.appointments a
   where a.id=p_appointment_id
     and a.client_id=(select auth.uid())
     and a.status in ('pending','confirmed')
     and a.starts_at > pg_catalog.now()+interval '24 hours';
  if not found then
    raise exception 'Esta reserva não permite reagendamento online (mínimo 24h)'
      using errcode='42501';
  end if;
  if (select auth.uid()) is null then
    raise exception 'Faça login para consultar horários' using errcode = '42501';
  end if;
  if p_date is null or v_original.service_id is null then
    raise exception 'Informe o serviço e a data' using errcode = '22023';
  end if;

  if p_date < (v_now at time zone 'America/Sao_Paulo')::date
     or p_date > (v_now at time zone 'America/Sao_Paulo')::date + 90 then
    raise exception 'Data fora do período permitido' using errcode = '22023';
  end if;

  select s.duration_minutes into v_duration
  from public.services s
  where s.id = v_original.service_id and s.active = true;
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
      where a.id <> p_appointment_id and a.status in ('pending', 'confirmed')
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
        where candidate.slot_start > v_now + interval '24 hours'
          and candidate.slot_start <= v_now + interval '90 days'
          and candidate.slot_start <> v_original.starts_at
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
        where candidate.slot_start > v_now + interval '24 hours'
          and candidate.slot_start <= v_now + interval '90 days'
          and candidate.slot_start <> v_original.starts_at
          and not exists (
            select 1 from public.appointments a
            where a.id <> p_appointment_id and a.status in ('pending','confirmed')
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
          and candidates.slot_start > v_now + interval '24 hours'
          and candidates.slot_start <= v_now + interval '90 days'
          and candidates.slot_start <> v_original.starts_at
          and not exists (
            select 1 from public.appointments a
            where a.id <> p_appointment_id and a.status in ('pending','confirmed')
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

revoke all on function public.available_reschedule_slots(uuid,date)
  from public,anon,authenticated;
grant execute on function public.available_reschedule_slots(uuid,date) to authenticated;

create or replace function public.reschedule_appointment(
  p_appointment_id uuid, p_new_starts_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path=''
as $reschedule$
declare
 v_client uuid := (select auth.uid());
 v_old public.appointments%rowtype;
 v_new uuid;
 v_redeem integer;
begin
 if v_client is null then
   raise exception 'Entre na sua conta para reagendar' using errcode='42501';
 end if;
 if p_appointment_id is null or p_new_starts_at is null then
   raise exception 'Informe o agendamento e o novo horário' using errcode='22023';
 end if;
 -- Match the profile lock order used by points redemption and its reversal.
 perform 1 from public.profiles where id=v_client for update;
 if not found then
   raise exception 'Perfil não encontrado' using errcode='42501';
 end if;
 select a.* into v_old from public.appointments a
  where a.id=p_appointment_id for update;
 if not found or v_old.client_id is distinct from v_client then
   raise exception 'Reserva não encontrada para esta conta' using errcode='42501';
 end if;
 if v_old.status not in ('pending','confirmed') then
   raise exception 'Somente agendamentos ativos podem ser reagendados' using errcode='22023';
 end if;
 if v_old.starts_at <= pg_catalog.now()+interval '24 hours' then
   raise exception 'Reagende com pelo menos 24 horas de antecedência' using errcode='22023';
 end if;
 if p_new_starts_at <= pg_catalog.now()+interval '24 hours'
    or p_new_starts_at > pg_catalog.now()+interval '90 days'
    or p_new_starts_at=v_old.starts_at then
   raise exception 'Escolha outro horário entre 24h e 90 dias a partir de agora'
     using errcode='22023';
 end if;
 -- Do not silently change redeemed points if the service cost has changed.
 if v_old.points_redeemed is not null then
   select s.redeem_points into v_redeem
     from public.services s where s.id=v_old.service_id and s.active=true;
   if v_redeem is distinct from v_old.points_redeemed then
     raise exception 'As regras de TR Points mudaram; peça ajuda ao estúdio'
       using errcode='22023';
   end if;
 end if;
 -- Single transaction: any error rolls back the cancellation, points refund,
 -- notifications and new booking. The new booking always awaits approval.
 update public.appointments set status='cancelled' where id=v_old.id;
 if v_old.points_redeemed is not null then
   v_new:=public.book_appointment_with_points(v_old.service_id,p_new_starts_at);
 else
   v_new:=public.book_appointment(v_old.service_id,p_new_starts_at);
   update public.appointments set price_at_booking=v_old.price_at_booking
     where id=v_new;
 end if;
 update public.appointments set notes=v_old.notes
    where id=v_new and v_old.notes is not null;
 insert into public.appointment_reschedules(
   old_appointment_id,new_appointment_id,client_id,
   previous_starts_at,new_starts_at,previous_status
 ) values(v_old.id,v_new,v_client,v_old.starts_at,p_new_starts_at,v_old.status);
 return v_new;
end;
$reschedule$;
revoke all on function public.reschedule_appointment(uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.reschedule_appointment(uuid,timestamptz)
  to authenticated;
comment on function public.reschedule_appointment(uuid,timestamptz) is
  'Reserva antiga cancelada somente se nova criada com sucesso; preço e pontos preservados, novo pedido pendente.';
commit;
