-- Agenda manual: somente administradoras podem agendar em nome de clientes cadastradas.
-- SECURITY INVOKER mantém RLS e GRANTs, além de checagem explicita de admin.
begin;
create or replace function public.admin_book_client_appointment(
  p_client_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_service public.services%rowtype;
  v_id uuid;
  v_date date;
begin
  if (select private.is_admin()) is distinct from true then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  if p_client_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'Selecione uma cliente, um serviço e um horário' using errcode = '22023';
  end if;
  if length(coalesce(p_notes,'')) > 400 then
    raise exception 'Observação longa demais (máximo 400 caracteres)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id=p_client_id and role='client') then
    raise exception 'Cliente não encontrada. Selecione uma cliente cadastrada.' using errcode = '22023';
  end if;
  select * into v_service
    from public.services where id=p_service_id and active=true;
  if not found then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;

  v_date := (p_starts_at at time zone 'America/Sao_Paulo')::date;
  -- Usa a mesma fonte de horários do fluxo público; rejeita horário arbitrário.
  if not exists (
    select 1 from public.available_slots(p_service_id,v_date) slots
    where slots.starts_at = p_starts_at
  ) then
    raise exception 'Horário indisponível ou fora do expediente' using errcode = '22023';
  end if;

  insert into public.appointments
    (client_id,service_id,starts_at,ends_at,status,price_at_booking,notes)
  values (
    p_client_id,p_service_id,p_starts_at,
    p_starts_at+pg_catalog.make_interval(mins=>v_service.duration_minutes),
    'confirmed',v_service.price,
    case
      when nullif(trim(p_notes),'') is null then 'Agendamento manual pela administração'
      else 'Agendamento manual pela administração: '||trim(p_notes)
    end
  )
  returning id into v_id;

  return v_id;
exception
  when exclusion_violation then
    raise exception 'Horário acabou de ser reservado. Escolha outro.' using errcode='23P01';
end;
$function$;
revoke all on function public.admin_book_client_appointment(uuid,uuid,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.admin_book_client_appointment(uuid,uuid,timestamptz,text) to authenticated;
comment on function public.admin_book_client_appointment(uuid,uuid,timestamptz,text)
is 'Admin: cria reserva confirmada para uma cliente cadastrada, respeitando disponibilidade e RLS.';
commit;