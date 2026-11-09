-- Monitoramento administrativo da integração de WhatsApp, sem expor telefones ou tokens.
begin;
create or replace function public.admin_whatsapp_summary()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_result jsonb;
begin
  if (select private.is_admin()) is distinct from true then
    raise exception 'Acesso exclusivo da administração' using errcode='42501';
  end if;
  select jsonb_build_object(
    'consented_clients',(select count(*) from public.notification_preferences where whatsapp_enabled=true),
    'queued',(select count(*) from public.notification_outbox where channel='whatsapp' and status in ('pending','processing')),
    'sent',(select count(*) from public.notification_outbox where channel='whatsapp' and status='sent'),
    'failed',(select count(*) from public.notification_outbox where channel='whatsapp' and status='failed'),
    'skipped',(select count(*) from public.notification_outbox where channel='whatsapp' and status='skipped'),
    'attendance_confirmed',(select count(*) from public.appointments where attendance_confirmed_at is not null),
    'last_send',(select max(processed_at) from public.notification_outbox where channel='whatsapp' and status='sent')
  ) into v_result;
  return v_result;
end $fn$;
revoke all on function public.admin_whatsapp_summary() from public,anon,authenticated;
grant execute on function public.admin_whatsapp_summary() to authenticated;
commit;