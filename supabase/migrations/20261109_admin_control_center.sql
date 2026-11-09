-- Central de Controle: avisos exclusivos por administradora.
-- Mantém as notificações das clientes e os e-mails da P4 sem alterações.
begin;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  outbox_id uuid references public.notification_outbox(id) on delete set null,
  type text not null check (type in ('booking_requested','client_cancelled','system_alert')),
  priority text not null check (priority in ('critical','high','normal')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz,
  constraint admin_notification_appointment_event unique (recipient_id,appointment_id,type),
  constraint admin_notification_outbox_event unique (recipient_id,outbox_id,type)
);

create index if not exists admin_notifications_by_recipient
  on public.admin_notifications(recipient_id,created_at desc);
create index if not exists admin_notifications_unread
  on public.admin_notifications(recipient_id,created_at desc)
  where read_at is null;

alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from public,anon,authenticated;
grant select on public.admin_notifications to authenticated;
grant update (read_at) on public.admin_notifications to authenticated;

drop policy if exists "Admin reads own operational alerts" on public.admin_notifications;
create policy "Admin reads own operational alerts"
on public.admin_notifications for select to authenticated
using (recipient_id = (select auth.uid()) and (select private.is_admin()));

drop policy if exists "Admin marks own operational alerts read" on public.admin_notifications;
create policy "Admin marks own operational alerts read"
on public.admin_notifications for update to authenticated
using (recipient_id = (select auth.uid()) and (select private.is_admin()))
with check (recipient_id = (select auth.uid()) and (select private.is_admin()));

create or replace function private.enqueue_admin_appointment_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_type text;
  v_priority text;
  v_title text;
  v_body text;
  v_name text;
  v_service text;
  v_when text;
begin
  -- Fechar o pedido anterior para que nenhum botão de ação fique disponível.
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending' then
    update public.admin_notifications
    set resolved_at = coalesce(resolved_at,now())
    where appointment_id = new.id and type = 'booking_requested';
  end if;

  if tg_op='INSERT' and new.status='pending' then
    v_type := 'booking_requested';
    v_priority := 'normal';
    v_title := 'Novo pedido de agendamento';
  elsif tg_op='UPDATE' and old.status is distinct from new.status
    and new.status = 'cancelled'
    and (select auth.uid()) = new.client_id then
    -- Apenas cancelamentos iniciados pela própria conta da cliente.
    v_type := 'client_cancelled';
    v_priority := 'critical';
    v_title := 'Cancelamento feito pela cliente';
  else
    return new;
  end if;

  select coalesce(nullif(trim(p.full_name),''),'Cliente'),
         coalesce(nullif(trim(s.name),''),'Serviço')
  into v_name,v_service
  from public.profiles p cross join public.services s
  where p.id=new.client_id and s.id=new.service_id;
  v_name:=coalesce(v_name,'Cliente');
  v_service:=coalesce(v_service,'Serviço');
  v_when := pg_catalog.to_char(
    new.starts_at at time zone 'America/Sao_Paulo','DD/MM/YYYY "às" HH24:MI');

  if v_type='booking_requested' then
    v_body := pg_catalog.format('%s solicitou %s para %s. Analise e aprove ou recuse.',v_name,v_service,v_when);
  else
    v_body := pg_catalog.format('%s cancelou %s de %s. Confira o horário liberado.',v_name,v_service,v_when);
  end if;

  insert into public.admin_notifications
      (recipient_id,appointment_id,type,priority,title,body)
  select p.id,new.id,v_type,v_priority,v_title,v_body
  from public.profiles p where p.role='admin'
  on conflict (recipient_id,appointment_id,type) do nothing;
  return new;
end;
$function$;

revoke all on function private.enqueue_admin_appointment_alert() from public,anon,authenticated;
drop trigger if exists tr_admin_appointment_alert on public.appointments;
create trigger tr_admin_appointment_alert
after insert or update of status on public.appointments
for each row execute function private.enqueue_admin_appointment_alert();

-- Falhas concretas no envio de e-mail/WhatsApp viram alertas críticos de operação.
-- Nunca armazenamos o erro bruto ou dados de credenciais no aviso.
create or replace function private.enqueue_admin_delivery_failure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_channel text;
  v_kind text;
begin
  if new.status <> 'failed' or
      (tg_op='UPDATE' and old.status='failed') then
    return new;
  end if;

  v_channel := case new.channel when 'email' then 'e-mail'
               when 'whatsapp' then 'WhatsApp'
               else 'mensagem' end;
  v_kind := case new.event_type
    when 'booking_requested' then 'pedido de agendamento'
    when 'booking_confirmed' then 'confirmação do atendimento'
    when 'booking_cancelled' then 'cancelamento'
    when 'reminder_24h' then 'lembrete do atendimento'
    else 'notificação' end;

  insert into public.admin_notifications
      (recipient_id,appointment_id,outbox_id,type,priority,title,body)
  select p.id,new.appointment_id,new.id,'system_alert','critical',
    'Falha no envio de notificação',
    pg_catalog.format('Não foi possível enviar %s por %s. Verifique o envio de notificações do %s.',v_kind,v_channel,'estúdio')
  from public.profiles p where p.role='admin'
  on conflict (recipient_id,outbox_id,type) do nothing;
  return new;
end;
$function$;

revoke all on function private.enqueue_admin_delivery_failure() from public,anon,authenticated;
drop trigger if exists tr_admin_delivery_failure on public.notification_outbox;
create trigger tr_admin_delivery_failure
after insert or update of status on public.notification_outbox
for each row execute function private.enqueue_admin_delivery_failure();

-- Pedidos pendentes existentes recebem uma tarefa inicial, sem inventar novos eventos.
insert into public.admin_notifications
  (recipient_id,appointment_id,type,priority,title,body,created_at)
select
  p.id,a.id,'booking_requested','normal','Pedido aguardando análise',
  pg_catalog.format('Pedido de %s para %s ainda precisa de análise.',
    coalesce(nullif(trim(s.name),''),'serviço'),
    pg_catalog.to_char(a.starts_at at time zone 'America/Sao_Paulo',
      'DD/MM/YYYY "às" HH24:MI')),
  a.created_at
from public.appointments a
join public.services s on s.id=a.service_id
cross join public.profiles p
where p.role='admin' and a.status='pending'
on conflict (recipient_id,appointment_id,type) do nothing;

do $do$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename='admin_notifications')
  then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end
$do$;

comment on table public.admin_notifications is
  'Central operacional por conta Admin: pedidos, cancelamentos iniciados por cliente e erros de entrega de mensagens.';
commit;
