-- TR Points: agendar serviços pagos com pontos, regras editáveis pela admin.
begin;

alter table public.services
  add column if not exists redeem_points integer;
alter table public.services drop constraint if exists services_redeem_points_positive;
alter table public.services
  add constraint services_redeem_points_positive check (redeem_points >= 100);

-- Base inicial: menor preço = 300, +100 por serviço subsequente.
-- Se novos serviços forem cadastrados depois, a admin define o custo no painel.
with ranked as (
  select id, 300 + 100 * (row_number() over (order by price asc,id asc)-1)::integer as cost
  from public.services
)
update public.services s set redeem_points = ranked.cost
from ranked where ranked.id=s.id and s.redeem_points is null;

alter table public.appointments
  add column if not exists points_redeemed integer;
alter table public.appointments drop constraint if exists appointments_points_redeemed_positive;
alter table public.appointments
  add constraint appointments_points_redeemed_positive
  check (points_redeemed is null or points_redeemed >= 100);

-- A RPC é a única entrada para criar uma reserva com pontos.
-- Bloqueamos a linha do perfil, serializando operações sobre o saldo desta cliente.
create or replace function public.book_appointment_with_points(
  p_service_id uuid, p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_client uuid := (select auth.uid());
  v_cost integer;
  v_balance bigint;
  v_id uuid;
  v_enabled boolean;
begin
  if v_client is null then
    raise exception 'Faça login para usar seus TR Points' using errcode='42501';
  end if;
  if p_service_id is null or p_starts_at is null then
    raise exception 'Selecione um serviço e um horário' using errcode='22023';
  end if;
  -- Uma única solicitação de resgate por conta é processada de cada vez.
  perform 1 from public.profiles where id=v_client for update;
  if not found then
    raise exception 'Perfil da cliente não encontrado' using errcode='42501';
  end if;

  select enabled into v_enabled from public.loyalty_settings where id=1;
  if v_enabled is distinct from true then
    raise exception 'O programa TR Points está pausado';
  end if;

  select redeem_points into v_cost
  from public.services
  where id=p_service_id and active=true
  for share;
  if v_cost is null or v_cost < 100 then
    raise exception 'Este serviço não está disponível para resgate';
  end if;

  select coalesce(sum(points),0)::bigint into v_balance
  from public.points_ledger where client_id=v_client;

  if v_balance < v_cost then
    raise exception 'Saldo insuficiente: são necessários % pontos',v_cost;
  end if;

  -- Reusa todas as validações existentes de horário, expediente e disponibilidade.
  -- Se a reserva não puder ser criada, nenhuma pontuação é debitada.
  v_id := public.book_appointment(p_service_id,p_starts_at);

  update public.appointments
    set points_redeemed=v_cost, price_at_booking=0
    where id=v_id and client_id=v_client;

  insert into public.points_ledger
    (client_id,appointment_id,points,description,event_type)
  values
    (v_client,v_id,-v_cost,'Resgate de serviço com TR Points','redeemed');

  return v_id;
end;
$function$;

revoke all on function public.book_appointment_with_points(uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.book_appointment_with_points(uuid,timestamptz)
  to authenticated;

-- O resgate substitui o pagamento em dinheiro: não gerar pontos novamente
-- pela conclusão de um serviço já pago com pontos.
create or replace function public.credit_points_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rate integer;
  v_points integer;
begin
  if new.status <> 'completed' or new.points_redeemed is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status='completed' then
    return new;
  end if;
  select points_per_real into v_rate
    from public.loyalty_settings where id=1 and enabled=true;
  if not found then return new; end if;
  v_points := floor(new.price_at_booking * v_rate)::integer;
  if v_points>0 then
    insert into public.points_ledger
      (client_id,appointment_id,points,description,event_type)
    values (new.client_id,new.id,v_points,'Atendimento concluído','earned')
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

-- Cancelamentos de pedidos ainda não realizados estornam os pontos uma única vez.
-- Um pedido resgatado e já concluído não é estornado automaticamente.
create unique index if not exists points_ledger_one_redemption_refund
  on public.points_ledger (appointment_id)
  where event_type='reversal' and description='Estorno de agendamento TR Points cancelado';

create or replace function public.refund_cancelled_points_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status in ('pending','confirmed')
     and new.status='cancelled'
     and new.points_redeemed is not null then
    -- a mesma trava de perfil impede disputas com outros resgates
    perform 1 from public.profiles where id=new.client_id for update;
    insert into public.points_ledger
      (client_id,appointment_id,points,description,event_type)
    values (
      new.client_id,new.id,new.points_redeemed,
      'Estorno de agendamento TR Points cancelado','reversal'
    )
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists tr_refund_cancelled_points_booking on public.appointments;
create trigger tr_refund_cancelled_points_booking
  after update of status on public.appointments
  for each row execute function public.refund_cancelled_points_booking();

-- Impede reabrir uma reserva resgatada e cancelada após o estorno.
create or replace function public.protect_cancelled_points_booking()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.points_redeemed is not null
     and old.status='cancelled'
     and new.status <> 'cancelled' then
    raise exception 'Reserva TR Points cancelada não pode ser reaberta; crie outra reserva';
  end if;
  return new;
end;
$function$;
drop trigger if exists tr_protect_cancelled_points_booking on public.appointments;
create trigger tr_protect_cancelled_points_booking
  before update of status on public.appointments
  for each row execute function public.protect_cancelled_points_booking();

-- Clientes podem ver os custos de resgate nos serviços ativos via RLS existente.
-- Apenas Admin pode editar esse campo, através da RLS UPDATE de services.
comment on column public.services.redeem_points is
  'Preço de resgate em pontos; administradora configura no catálogo de serviços';
comment on column public.appointments.points_redeemed is
  'Valor em pontos debitado no pedido; se presente, price_at_booking=0';
commit;