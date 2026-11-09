-- P6 — Painel financeiro administrativo
-- Preços do instante da reserva, agrupados pela data do atendimento em America/Sao_Paulo.
-- "Receita" significa valor de atendimentos concluídos; NÃO é comprovação de pagamento.

begin;

create index if not exists p6_appointments_starts_at_status
  on public.appointments (starts_at, status);

create or replace function public.p6_financial_dashboard(
  p_year integer,
  p_month integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_bins integer;
  v_metrics jsonb;
  v_series jsonb;
  v_services jsonb;
begin
  -- A autorização é obrigatória dentro da RPC: RLS de appointments,
  -- isoladamente, permitiria ao cliente agregar seus próprios registros.
  if (select private.is_admin()) is not true then
    raise exception 'Acesso restrito à administradora'
      using errcode = '42501';
  end if;

  if p_year is null or p_year < 2000 or p_year > 2099
     or (p_month is not null and (p_month < 1 or p_month > 12)) then
    raise exception 'Período inválido' using errcode = '22023';
  end if;

  v_start := pg_catalog.make_timestamptz(
    p_year, coalesce(p_month, 1), 1, 0, 0, 0, 'America/Sao_Paulo'
  );
  if p_month is null or p_month = 12 then
    v_end := pg_catalog.make_timestamptz(
      p_year + 1, 1, 1, 0, 0, 0, 'America/Sao_Paulo'
    );
  else
    v_end := pg_catalog.make_timestamptz(
      p_year, p_month + 1, 1, 0, 0, 0, 'America/Sao_Paulo'
    );
  end if;
  v_bins := case when p_month is null then 12
    else ((extract(day from (pg_catalog.make_date(p_year, p_month, 1)
        + interval '1 month - 1 day'))::integer - 1) / 7) + 1 end;

  select pg_catalog.jsonb_build_object(
    'completed', count(*) filter (where status='completed'),
    'revenue', coalesce(sum(price_at_booking) filter (where status='completed'), 0),
    'ticket', case when count(*) filter (where status='completed') > 0
      then coalesce(sum(price_at_booking) filter (where status='completed'), 0)
           / (count(*) filter (where status='completed')) else 0 end,
    'clients', count(distinct client_id) filter (where status='completed'),
    'confirmed', count(*) filter (where status='confirmed'),
    'confirmed_value', coalesce(sum(price_at_booking) filter (where status='confirmed'),0),
    'pending', count(*) filter (where status='pending'),
    'cancelled', count(*) filter (where status='cancelled')
  ) into v_metrics
  from public.appointments
  where starts_at >= v_start and starts_at < v_end;

  with grouped as (
    select case when p_month is null
      then extract(month from starts_at at time zone 'America/Sao_Paulo')::integer
      else ((extract(day from starts_at at time zone 'America/Sao_Paulo')::integer - 1) / 7) + 1
      end as bucket,
      count(*)::integer as completed,
      coalesce(sum(price_at_booking),0) as revenue
    from public.appointments
    where status = 'completed' and starts_at >= v_start and starts_at < v_end
    group by 1
  )
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'bucket', bins.bucket,
      'completed', coalesce(grouped.completed, 0),
      'revenue', coalesce(grouped.revenue, 0)
    ) order by bins.bucket
  ), '[]'::jsonb) into v_series
  from pg_catalog.generate_series(1,v_bins) as bins(bucket)
  left join grouped on grouped.bucket=bins.bucket;

  select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'service_id', service_id,
        'name', name,
        'completed', completed,
        'revenue', revenue
      ) order by revenue desc, name
    ), '[]'::jsonb)
    into v_services
  from (
    select a.service_id,
           coalesce(s.name,'Serviço removido') as name,
           count(*)::integer as completed,
           sum(a.price_at_booking) as revenue
    from public.appointments a
    left join public.services s on s.id = a.service_id
    where a.status='completed' and a.starts_at >= v_start and a.starts_at < v_end
    group by a.service_id, s.name
  ) by_service;

  return pg_catalog.jsonb_build_object(
    'year',p_year,
    'month',p_month,
    'timezone','America/Sao_Paulo',
    'metrics',v_metrics,
    'series',v_series,
    'services',v_services
  );
end;
$function$;

revoke all on function public.p6_financial_dashboard(integer,integer)
  from public, anon, authenticated;
grant execute on function public.p6_financial_dashboard(integer,integer)
  to authenticated;

comment on function public.p6_financial_dashboard(integer,integer)
  is 'P6 relatório admin: soma preço de agendamentos concluídos; não comprova recebimento de pagamentos.';

commit;
