-- Administradora pode configurar qualquer valor INTEIRO POSITIVO em pontos.
begin;
alter table public.services drop constraint if exists services_redeem_points_positive;
alter table public.services add constraint services_redeem_points_positive check (redeem_points > 0);
alter table public.appointments drop constraint if exists appointments_points_redeemed_positive;
alter table public.appointments add constraint appointments_points_redeemed_positive check (points_redeemed is null or points_redeemed > 0);
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
  if v_cost is null or v_cost <= 0 then
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


commit;