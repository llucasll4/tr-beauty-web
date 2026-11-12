-- Fase 3 / etapa 1: recebimentos informados manualmente pela administradora.
-- Nao altera pagamentos externos nem confirma conciliacao bancaria.
-- Aplicar somente depois de revisar os testes isolados e antes de habilitar o frontend.
begin;

create table if not exists public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('pix','cash','debit','credit','transfer','other')),
  received_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  constraint appointment_payments_void_fields check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null
        and char_length(btrim(coalesce(void_reason,''))) between 5 and 300)
  )
);

comment on table public.appointment_payments is
  'Registros manuais de recebimento; nao sao confirmacoes bancarias. Anulacoes mantem trilha de auditoria.';
create index if not exists appointment_payments_active_appointment_idx
  on public.appointment_payments (appointment_id) where voided_at is null;
create index if not exists appointment_payments_active_received_idx
  on public.appointment_payments (received_at desc) where voided_at is null;

alter table public.appointment_payments enable row level security;

create policy "Admin reads manual receipts"
  on public.appointment_payments for select to authenticated
  using ((select private.is_admin()) is true);
create policy "Admin records own manual receipts"
  on public.appointment_payments for insert to authenticated
  with check (
    (select private.is_admin()) is true
    and created_by = (select auth.uid())
    and voided_at is null and voided_by is null and void_reason is null
  );
create policy "Admin only voids own audited receipts"
  on public.appointment_payments for update to authenticated
  using ((select private.is_admin()) is true and voided_at is null)
  with check (
    (select private.is_admin()) is true
    and voided_at is not null and voided_by = (select auth.uid())
  );

-- Colunas de valores e autoria sao imutaveis para clientes da Data API.
revoke all on table public.appointment_payments from public, anon, authenticated;
grant select on table public.appointment_payments to authenticated;
grant insert (appointment_id, amount, method, received_at)
  on public.appointment_payments to authenticated;
grant update (voided_at, voided_by, void_reason)
  on public.appointment_payments to authenticated;

create or replace function public.p3_guard_payment_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guard$
declare
  v_status text;
  v_price numeric;
  v_received numeric;
begin
  if (select private.is_admin()) is not true
     or new.created_by is distinct from (select auth.uid()) then
    raise exception 'Registro de recebimento restrito a administradora'
      using errcode='42501';
  end if;

  -- Lock na reserva: dois registros concorrentes nao podem ultrapassar seu preco.
  select a.status,a.price_at_booking
    into v_status,v_price
    from public.appointments a where a.id=new.appointment_id
    for update;
  if not found then
    raise exception 'Atendimento nao encontrado' using errcode='23503';
  end if;
  if v_status <> 'completed' or v_price <= 0 then
    raise exception 'Registre recebimentos somente em atendimentos concluidos e com valor em reais'
      using errcode='23514';
  end if;

  select coalesce(sum(p.amount),0) into v_received
    from public.appointment_payments p
   where p.appointment_id=new.appointment_id and p.voided_at is null;
  if new.amount > v_price - v_received then
    raise exception 'O recebimento ultrapassa o saldo ainda nao registrado'
      using errcode='23514';
  end if;
  return new;
end;
$guard$;

create trigger p3_guard_payment_insert
  before insert on public.appointment_payments
  for each row execute function public.p3_guard_payment_insert();

create or replace function public.p3_guard_payment_void()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guard$
begin
  if (select private.is_admin()) is not true then
    raise exception 'Acesso restrito a administradora' using errcode='42501';
  end if;
  if old.voided_at is not null then
    raise exception 'O registro ja foi anulado' using errcode='23514';
  end if;
  if new.id is distinct from old.id
     or new.appointment_id is distinct from old.appointment_id
     or new.amount is distinct from old.amount
     or new.method is distinct from old.method
     or new.received_at is distinct from old.received_at
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Registros financeiros nao podem ser editados; anule e registre novamente'
      using errcode='23514';
  end if;
  if new.voided_at is null or new.voided_by is distinct from (select auth.uid())
     or char_length(btrim(coalesce(new.void_reason,''))) not between 5 and 300 then
    raise exception 'Informe o motivo da anulacao (5 a 300 caracteres)'
      using errcode='23514';
  end if;
  new.void_reason := btrim(new.void_reason);
  new.voided_at := pg_catalog.now();
  return new;
end;
$guard$;

create trigger p3_guard_payment_void
  before update on public.appointment_payments
  for each row execute function public.p3_guard_payment_void();

-- Trigger functions nao devem ser expostas como RPC da Data API.
revoke all on function public.p3_guard_payment_insert() from public, anon, authenticated;
revoke all on function public.p3_guard_payment_void() from public, anon, authenticated;

create or replace function public.p3_financial_snapshot(
  p_year integer, p_month integer default null
)
returns jsonb
language plpgsql stable security invoker set search_path=''
as $function$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_metrics jsonb;
  v_appointments jsonb;
  v_receipts jsonb;
begin
  if (select private.is_admin()) is not true then
    raise exception 'Acesso restrito a administradora' using errcode='42501';
  end if;
  if p_year is null or p_year < 2000 or p_year > 2099
     or (p_month is not null and (p_month < 1 or p_month > 12)) then
    raise exception 'Periodo invalido' using errcode='22023';
  end if;
  v_start := pg_catalog.make_timestamptz(
    p_year,coalesce(p_month,1),1,0,0,0,'America/Sao_Paulo');
  v_end := case when p_month is null or p_month=12 then
    pg_catalog.make_timestamptz(p_year+1,1,1,0,0,0,'America/Sao_Paulo')
    else pg_catalog.make_timestamptz(
      p_year,p_month+1,1,0,0,0,'America/Sao_Paulo') end;

  with completed as (
    select a.price_at_booking as expected,
      coalesce((select sum(p.amount) from public.appointment_payments p
        where p.appointment_id=a.id and p.voided_at is null),0) as registered
    from public.appointments a
    where a.status='completed' and a.starts_at>=v_start and a.starts_at<v_end
  )
  select pg_catalog.jsonb_build_object(
    'estimated_completed',coalesce(sum(expected),0),
    'registered_for_services',coalesce(sum(registered),0),
    'unrecorded',coalesce(sum(greatest(expected-registered,0)),0),
    'completed_count',count(*),
    'received_in_period',(
      select coalesce(sum(p.amount),0) from public.appointment_payments p
       where p.voided_at is null and p.received_at>=v_start and p.received_at<v_end
    )
  ) into v_metrics from completed;

  select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id',items.id,'starts_at',items.starts_at,
        'client',items.client,'service',items.service,
        'price',items.price,'registered',items.registered,
        'remaining',greatest(items.price-items.registered,0)
      ) order by items.starts_at desc,items.id
    ),'[]'::jsonb) into v_appointments
    from (
      select a.id,a.starts_at,coalesce(pr.full_name,'Cliente') as client,
             coalesce(s.name,'Servico') as service,
             a.price_at_booking as price,
             coalesce((select sum(p.amount)
                 from public.appointment_payments p
                 where p.appointment_id=a.id and p.voided_at is null),0) as registered
      from public.appointments a
      left join public.profiles pr on pr.id=a.client_id
      left join public.services s on s.id=a.service_id
      where a.status='completed' and a.price_at_booking>0
        and a.starts_at>=v_start and a.starts_at<v_end
      order by a.starts_at desc,a.id
      limit 60
    ) items;

  select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id',items.id,'appointment_id',items.appointment_id,
        'received_at',items.received_at,'amount',items.amount,
        'method',items.method,'client',items.client,'service',items.service
      ) order by items.received_at desc,items.id
    ),'[]'::jsonb) into v_receipts
    from (
      select p.id,p.appointment_id,p.received_at,p.amount,p.method,
             coalesce(pr.full_name,'Cliente') as client,
             coalesce(s.name,'Servico') as service
      from public.appointment_payments p
      join public.appointments a on a.id=p.appointment_id
      left join public.profiles pr on pr.id=a.client_id
      left join public.services s on s.id=a.service_id
      where p.voided_at is null and p.received_at>=v_start and p.received_at<v_end
      order by p.received_at desc,p.id
      limit 40
    ) items;

  return pg_catalog.jsonb_build_object(
    'year',p_year,'month',p_month,'timezone','America/Sao_Paulo',
    'metrics',v_metrics,'appointments',v_appointments,'receipts',v_receipts,
    'appointments_limit',60,'receipts_limit',40
  );
end;
$function$;

revoke all on function public.p3_financial_snapshot(integer,integer)
  from public,anon,authenticated;
grant execute on function public.p3_financial_snapshot(integer,integer)
  to authenticated;

comment on function public.p3_financial_snapshot(integer,integer)
  is 'Financeiro admin: servicos concluidos, registros de recebimento e saldo sem registro, com periodos Brasilia.';
commit;
