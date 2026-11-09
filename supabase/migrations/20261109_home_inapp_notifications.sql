-- TR Beauty Concept — histórico de notificações dentro do site (Início/sino).
-- Os eventos seguem as mesmas transições do canal transacional P4,
-- mas são independentes das preferências de envio externo de e-mail/WhatsApp.
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null check (type in (
    'booking_requested', 'booking_confirmed', 'booking_cancelled', 'reminder_24h'
  )),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  visible_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_unique_appointment_event unique (appointment_id, type)
);

create index if not exists notifications_profile_recent
  on public.notifications (profile_id, created_at desc);
create index if not exists notifications_profile_unread
  on public.notifications (profile_id, visible_at)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

drop policy if exists "Cliente consulta notificações próprias" on public.notifications;
create policy "Cliente consulta notificações próprias"
on public.notifications for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "Cliente marca notificações próprias como lidas" on public.notifications;
create policy "Cliente marca notificações próprias como lidas"
on public.notifications for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create or replace function private.push_appointment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_type text;
  v_title text;
  v_message text;
  v_service text;
  v_when text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      v_type := 'booking_requested';
    elsif new.status = 'confirmed' then
      v_type := 'booking_confirmed';
    end if;
  else
    if old.status is not distinct from new.status then
      return new;
    end if;

    -- Não exibir um lembrete futuro de um atendimento cancelado ou concluído.
    if new.status in ('cancelled','completed') then
      delete from public.notifications
        where appointment_id = new.id
          and type = 'reminder_24h'
          and visible_at > now();
    end if;

    if new.status = 'confirmed' then
      v_type := 'booking_confirmed';
    elsif new.status = 'cancelled' then
      v_type := 'booking_cancelled';
    end if;
  end if;

  if v_type is null then
    return new;
  end if;

  select coalesce(nullif(s.name,''),'Atendimento')
  into v_service from public.services s where s.id = new.service_id;
  v_service := coalesce(v_service,'Atendimento');
  v_when := pg_catalog.to_char(
    new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'
  );

  if v_type='booking_requested' then
    v_title := 'Recebemos seu pedido de agendamento';
    v_message := pg_catalog.format(
      'Recebemos seu pedido de %s para %s. Avisaremos quando o estúdio confirmar.',v_service,v_when
    );
  elsif v_type='booking_confirmed' then
    v_title := 'Seu agendamento foi confirmado';
    v_message := pg_catalog.format(
      'Seu horário para %s está confirmado para %s. Esperamos você!',v_service,v_when
    );
  elsif v_type='booking_cancelled' then
    v_title := 'Seu agendamento foi cancelado';
    v_message := pg_catalog.format(
      'O agendamento de %s em %s foi cancelado. Você pode marcar outro horário em Reservas.',v_service,v_when
    );
  end if;

  insert into public.notifications
    (profile_id, appointment_id, type, title, body)
  values (new.client_id, new.id, v_type, v_title, v_message)
  on conflict (appointment_id, type) do nothing;

  -- A notificação de lembrete só fica visível quando chega o momento de envio.
  -- Segue a mesma janela do evento P4 (até 24h antes, e só se ainda faltarem 2h).
  if v_type = 'booking_confirmed'
     and new.starts_at > now() + interval '2 hours' then
    insert into public.notifications
      (profile_id, appointment_id, type, title, body, visible_at)
    values (
      new.client_id, new.id, 'reminder_24h',
      'Lembrete do seu atendimento',
      pg_catalog.format(
        'Lembrando: seu atendimento de %s será em %s. Até breve!',v_service,v_when
      ),
      greatest(now(),new.starts_at-interval '24 hours')
    )
    on conflict (appointment_id, type) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function private.push_appointment_notification()
from public, anon, authenticated;

drop trigger if exists tr_client_inapp_notifications on public.appointments;
create trigger tr_client_inapp_notifications
  after insert or update of status on public.appointments
  for each row execute function private.push_appointment_notification();

-- Habilitar atualizações instantâneas no frontend por Realtime, se não constar.
do $do$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public'
         and tablename='notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$do$;

comment on table public.notifications is
  'Avisos privados de agendamento no site, independentes do canal externo P4.';
commit;
