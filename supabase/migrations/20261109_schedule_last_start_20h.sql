-- TR Beauty Concept — expediente e política de último horário.
-- Ter e Qui 09–18: serviço + buffer de 15 min devem terminar até 18h.
-- Qua, Sex, Sáb 08–20: 20h é o último INÍCIO permitido, mesmo que o
-- serviço e o buffer terminem após esse horário.
-- Seg e Dom permanecem fechados. Comparação de reservas em UTC/ISO 8601.
begin;

update public.business_hours
set opens_at = case when weekday in (2,4) then time '09:00' else time '08:00' end,
    closes_at = case when weekday in (2,4) then time '18:00' else time '20:00' end,
    enabled = true
where weekday in (2,3,4,5,6);

update public.business_hours set enabled = false where weekday in (0,1);

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
    select a.starts_at, a.ends_at
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and a.starts_at < v_close_at
      and a.ends_at + v_buffer > v_open_at
    order by a.starts_at, a.ends_at
  loop
    v_gap_end := least(v_booking.starts_at, v_close_at);
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

    v_cursor := greatest(
      v_cursor, v_booking.ends_at + v_buffer
    );
    if v_cursor >= v_close_at then
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
        order by candidates.slot_start;
    end if;
  end if;
end;
$function$;

-- Uma chamada direta à RPC de agendamento não pode contornar a nova
-- regra. A exclusão GiST é a defesa final contra concorrência.

create or replace function public.book_appointment(
  p_service_id uuid, p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client uuid;
  v_service public.services%rowtype;
  v_local_start timestamp;
  v_local_setup_end timestamp;
  v_strict_close boolean;
  v_open time;
  v_close time;
  v_id uuid;
begin
  v_client := (select auth.uid());
  if v_client is null then
    raise exception 'Faça login para agendar' using errcode = '42501';
  end if;
  if p_service_id is null or p_starts_at is null then
    raise exception 'Serviço e horário são obrigatórios' using errcode = '22023';
  end if;
  if p_starts_at <= pg_catalog.now()
     or p_starts_at > pg_catalog.now() + interval '90 days' then
    raise exception 'Escolha um horário futuro nos próximos 90 dias' using errcode = '22023';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and active = true;
  if not found or v_service.duration_minutes <= 0 then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;

  v_local_start := p_starts_at at time zone 'America/Sao_Paulo';
  v_local_setup_end := (
    p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes + 15)
  ) at time zone 'America/Sao_Paulo';

  select bh.opens_at, bh.closes_at into v_open, v_close
  from public.business_hours bh
  where bh.weekday = extract(dow from v_local_start)
    and bh.enabled = true;
  if not found then
    raise exception 'Estúdio fechado na data escolhida' using errcode = '22023';
  end if;
  v_strict_close := extract(dow from v_local_start) in (2, 4);

  if v_local_start::time < v_open
     or v_local_start::time > v_close
     or (v_strict_close and (
           v_local_setup_end::date <> v_local_start::date
           or v_local_setup_end::time > v_close
        )) then
    raise exception 'Horário fora do expediente. Terça e quinta encerram às 18h; nos demais dias o último início é às 20h.' using errcode = '22023';
  end if;

  -- Validação final do slot: rejeita horários arbitrários fora das lacunas.
  if not exists (
    select 1 from public.available_slots(
      p_service_id, v_local_start::date
    ) slot
    where slot.starts_at = p_starts_at
  ) then
    raise exception 'Horário indisponível. Atualize a agenda e tente novamente.' using errcode = '22023';
  end if;

  insert into public.appointments (
    client_id, service_id, starts_at, ends_at, price_at_booking, status
  )
  values (
    v_client, p_service_id, p_starts_at,
    p_starts_at + pg_catalog.make_interval(mins => v_service.duration_minutes),
    v_service.price, 'pending'
  )
  returning id into v_id;
  return v_id;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.'
      using errcode = '23P01';
end;
$function$;

revoke execute on function public.available_slots(uuid,date) from public, anon;
grant execute on function public.available_slots(uuid,date) to authenticated, service_role;
revoke execute on function public.book_appointment(uuid,timestamptz) from public, anon;
grant execute on function public.book_appointment(uuid,timestamptz) to authenticated, service_role;

comment on function public.available_slots(uuid,date)
is 'Agenda dinâmica com buffer de 15 min; terça/quinta encerramento 18h, nos demais dias início permitido até 20h; fuso America/Sao_Paulo e retorno timestamptz.';
comment on function public.book_appointment(uuid,timestamptz)
is 'Validação do horário ofertado: encerramento obrigatório às 18h terça/quinta; último início às 20h nos demais dias; bloqueio de sobreposição inclui 15 min.';

commit;
