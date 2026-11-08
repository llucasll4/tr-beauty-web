-- TR Beauty Concept | P4 — notificações transacionais
-- Execute no Supabase SQL Editor ANTES de publicar o frontend da P4.
-- NÃO envia mensagens por si só; requer Edge Function, provedor e cron.
-- Por padrão ambos os canais começam DESLIGADOS, até a cliente consentir.

begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  whatsapp_consented_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_preferences to service_role;

drop policy if exists "Cliente consulta seus canais" on public.notification_preferences;
create policy "Cliente consulta seus canais"
  on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Cliente opta por canais" on public.notification_preferences;
create policy "Cliente opta por canais"
  on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Cliente atualiza seus canais" on public.notification_preferences;
create policy "Cliente atualiza seus canais"
  on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.p4_stamp_notification_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.whatsapp_enabled and (
    tg_op = 'INSERT' or
    (tg_op = 'UPDATE' and old.whatsapp_enabled = false)
  ) then
    new.whatsapp_consented_at := now();
  elsif not new.whatsapp_enabled then
    new.whatsapp_consented_at := null;
  elsif tg_op = 'UPDATE' then
    new.whatsapp_consented_at := old.whatsapp_consented_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.p4_stamp_notification_consent() from public, anon, authenticated;
drop trigger if exists p4_stamp_notification_consent on public.notification_preferences;
create trigger p4_stamp_notification_consent
  before insert or update on public.notification_preferences
  for each row execute function public.p4_stamp_notification_consent();

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'booking_requested', 'booking_confirmed', 'booking_cancelled', 'reminder_24h'
  )),
  channel text not null check (channel in ('email', 'whatsapp')),
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'sent', 'failed', 'skipped'
  )),
  attempts smallint not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (appointment_id, event_type, channel)
);

create index if not exists p4_outbox_due
  on public.notification_outbox (scheduled_for, id)
  where status = 'pending';

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
grant select, update, insert on public.notification_outbox to service_role;

-- Apenas alterações reais de status geram eventos.
-- Para evitar mensagens antigas, a transição para confirmado/cancelado
-- descarta alertas anteriores ainda não processados.
create or replace function public.p4_enqueue_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_email boolean := false;
  v_whatsapp boolean := false;
  v_reminder_at timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      v_event := 'booking_requested';
    end if;
  else
    if old.status is not distinct from new.status then
      return new;
    end if;

    if new.status = 'confirmed' then
      v_event := 'booking_confirmed';
      update public.notification_outbox
      set status = 'skipped', processed_at = now(), last_error = 'Estado anterior substituído'
      where appointment_id = new.id and event_type = 'booking_requested'
        and status = 'pending';

    elsif new.status = 'cancelled' then
      v_event := 'booking_cancelled';
      update public.notification_outbox
      set status = 'skipped', processed_at = now(), last_error = 'Atendimento cancelado'
      where appointment_id = new.id and status = 'pending'
        and event_type in ('booking_requested', 'booking_confirmed', 'reminder_24h');

    elsif new.status = 'completed' then
      update public.notification_outbox
      set status = 'skipped', processed_at = now(), last_error = 'Atendimento concluído'
      where appointment_id = new.id and event_type = 'reminder_24h'
        and status = 'pending';
    end if;
  end if;

  if v_event is null then
    return new;
  end if;

  select p.email_enabled, p.whatsapp_enabled
    into v_email, v_whatsapp
  from public.notification_preferences p
  where p.user_id = new.client_id;

  if coalesce(v_email, false) then
    insert into public.notification_outbox
      (appointment_id, client_id, event_type, channel)
    values (new.id, new.client_id, v_event, 'email')
    on conflict (appointment_id, event_type, channel) do nothing;
  end if;

  if coalesce(v_whatsapp, false) then
    insert into public.notification_outbox
      (appointment_id, client_id, event_type, channel)
    values (new.id, new.client_id, v_event, 'whatsapp')
    on conflict (appointment_id, event_type, channel) do nothing;
  end if;

  -- Lembrete somente para agendamento confirmado ainda no futuro.
  -- Para confirmação com menos de 24h, envia no próximo processamento
  -- se faltarem pelo menos duas horas para a sessão.
  if v_event = 'booking_confirmed'
    and new.starts_at > now() + interval '2 hours' then
    v_reminder_at := greatest(now(), new.starts_at - interval '24 hours');

    if coalesce(v_email, false) then
      insert into public.notification_outbox
        (appointment_id, client_id, event_type, channel, scheduled_for)
      values (new.id, new.client_id, 'reminder_24h', 'email', v_reminder_at)
      on conflict (appointment_id, event_type, channel) do nothing;
    end if;

    if coalesce(v_whatsapp, false) then
      insert into public.notification_outbox
        (appointment_id, client_id, event_type, channel, scheduled_for)
      values (new.id, new.client_id, 'reminder_24h', 'whatsapp', v_reminder_at)
      on conflict (appointment_id, event_type, channel) do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.p4_enqueue_appointment_notifications()
  from public, anon, authenticated;

drop trigger if exists p4_enqueue_appointment_notifications on public.appointments;
create trigger p4_enqueue_appointment_notifications
  after insert or update of status on public.appointments
  for each row execute function public.p4_enqueue_appointment_notifications();

commit;

-- Auditoria sem dados pessoais (rode separadamente, se desejar):
-- select status, channel, event_type, count(*)
-- from public.notification_outbox group by 1,2,3 order by 1,2,3;
