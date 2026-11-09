-- TR Beauty Concept — horários dinâmicos e 15 minutos de setup.
-- O intervalo está protegido também na restrição do banco, impedindo
-- reservas simultâneas que não respeitem a preparação do estúdio.
-- Horários locais: America/Sao_Paulo. Persistência e RPCs: timestamptz UTC.
begin;

-- Verifica conflitos entre os registros existentes antes de alterar o índice.
-- Adiciona a nova restrição ANTES de remover a anterior (sem janela sem proteção).
-- UTC explícito torna a expressão imutável para o índice GiST e preserva
-- corretamente a comparação entre instantes absolutos.
alter table public.appointments
  add constraint no_overlapping_appointments_buffer_15
  exclude using gist (
    pg_catalog.tsrange(
      starts_at at time zone 'UTC',
      (ends_at at time zone 'UTC') + interval '15 minutes',
      '[)'
    ) with &&
  )
  where (status in ('pending', 'confirmed'));

alter table public.appointments
  drop constraint no_overlapping_appointments;

alter table public.appointments
  rename constraint no_overlapping_appointments_buffer_15
  to no_overlapping_appointments;

comment on constraint no_overlapping_appointments on public.appointments
is 'Impede reservas ativas conflitantes, incluindo 15 minutos de limpeza e preparação após o serviço. Comparação em UTC.';

-- Percorre lacunas reais entre atendimentos.
-- A sequência de 15 minutos é ancorada no começo de CADA lacuna e NÃO
-- em horas inteiras: se um serviço terminar 12:07, a lacuna abre 12:22.
-- Só retorna horários em que a duração escolhida + setup cabem inteiramente
-- antes do próximo agendamento (ou do fechamento).
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
  where bh.weekday = pg_catalog.extract(dow from p_date)
    and bh.enabled = true;
  if not found or v_open is null or v_close is null or v_close <= v_open then
    return;
  end if;

  v_open_at := (p_date + v_open) at time zone 'America/Sao_Paulo';
  v_close_at := (p_date + v_close) at time zone 'America/Sao_Paulo';
  v_cursor := v_open_at;

  for v_booking in
    select a.starts_at, a.ends_at
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and a.starts_at < v_close_at
      and a.ends_at + v_buffer > v_open_at
    order by a.starts_at, a.ends_at
  loop
    v_gap_end := pg_catalog.least(v_booking.starts_at, v_close_at);
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

    v_cursor := pg_catalog.greatest(
      v_cursor, v_booking.ends_at + v_buffer
    );
    if v_cursor >= v_close_at then
      return;
    end if;
  end loop;

  -- Última lacuna: do fim do último buffer até o fechamento.
  v_latest_start := v_close_at
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
  where bh.weekday = pg_catalog.extract(dow from v_local_start)
    and bh.enabled = true;
  if not found then
    raise exception 'Estúdio fechado na data escolhida' using errcode = '22023';
  end if;
  if v_local_start::time < v_open
     or v_local_setup_end::date <> v_local_start::date
     or v_local_setup_end::time > v_close then
    raise exception 'Horário fora do expediente (incluindo 15 min de preparação)' using errcode = '22023';
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

-- Mantém as concessões já existentes; acesso anônimo continua proibido.
revoke execute on function public.available_slots(uuid,date)
  from public, anon;
grant execute on function public.available_slots(uuid,date)
  to authenticated, service_role;
revoke execute on function public.book_appointment(uuid,timestamptz)
  from public, anon;
grant execute on function public.book_appointment(uuid,timestamptz)
  to authenticated, service_role;

comment on function public.available_slots(uuid,date)
is 'Horários por lacunas reais: 15 min de setup entre serviços e após o último; timezone America/Sao_Paulo, retorno timestamptz/ISO UTC.';
comment on function public.book_appointment(uuid,timestamptz)
is 'Cria reserva ativa apenas para slot ofertado pela agenda dinâmica, respeitando setup obrigatório de 15 min e exclusão GiST.';

commit;
