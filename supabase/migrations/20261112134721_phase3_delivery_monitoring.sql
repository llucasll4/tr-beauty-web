-- Fase 3 / etapa 3: monitoramento administrativo (somente leitura).
-- Reusa notification_outbox; não altera status, consentimento, cron ou envios.
begin;

-- Executa consultas restritas na fila privada, com checagem obrigatoria
-- de funcao admin. Nenhuma credencial, destinatario ou erro bruto e exposto.
create or replace function private.phase3_delivery_health_internal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $health$
declare
  v_channels jsonb;
  v_issues jsonb;
  v_overdue integer;
  v_failed integer;
begin
  if (select private.is_admin()) is not true or (select auth.uid()) is null then
    raise exception 'Acesso restrito a administracao'
      using errcode='42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'channel',channel,
      'pending',pending_count,
      'overdue',overdue_count,
      'processing',processing_count,
      'sent',sent_count,
      'failed',failed_count,
      'skipped',skipped_count,
      'last_sent_at',last_sent_at
    ) order by channel), '[]'::jsonb)
  into v_channels
  from (
    select c.channel,
      count(o.id) filter (where o.status='pending')::integer as pending_count,
      count(o.id) filter (where o.status='pending'
        and o.scheduled_for < pg_catalog.now() - interval '15 minutes')::integer as overdue_count,
      count(o.id) filter (where o.status='processing')::integer as processing_count,
      count(o.id) filter (where o.status='sent')::integer as sent_count,
      count(o.id) filter (where o.status='failed')::integer as failed_count,
      count(o.id) filter (where o.status='skipped')::integer as skipped_count,
      max(o.processed_at) filter (where o.status='sent') as last_sent_at
    from (values ('email'::text),('whatsapp'::text)) as c(channel)
    left join public.notification_outbox o on o.channel=c.channel
    group by c.channel
  ) stats;

  select count(*) filter (
      where status='pending'
        and scheduled_for < pg_catalog.now() - interval '15 minutes'
    )::integer,
    count(*) filter (where status='failed')::integer
  into v_overdue,v_failed
  from public.notification_outbox;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'channel',item.channel,
      'event_type',item.event_type,
      'status',item.status,
      'scheduled_for',item.scheduled_for,
      'processed_at',item.processed_at,
      'attempts',item.attempts
    ) order by item.sort_at desc,item.channel), '[]'::jsonb)
  into v_issues
  from (
    select o.channel,o.event_type,o.status,o.scheduled_for,
      o.processed_at,o.attempts,
      coalesce(o.processed_at,o.scheduled_for) as sort_at
    from public.notification_outbox o
    where o.status='failed' or (
      o.status='pending'
      and o.scheduled_for < pg_catalog.now() - interval '15 minutes'
    )
    order by coalesce(o.processed_at,o.scheduled_for) desc, o.id
    limit 20
  ) item;

  return pg_catalog.jsonb_build_object(
    'as_of',pg_catalog.now(),
    'overdue_threshold_minutes',15,
    'total_overdue',coalesce(v_overdue,0),
    'total_failed',coalesce(v_failed,0),
    'channels',v_channels,
    'recent_issues',v_issues,
    'issues_limit',20
  );
end;
$health$;

-- A rotina privilegiada fica no schema nao exposto ao Data API.
revoke all on function private.phase3_delivery_health_internal()
  from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.phase3_delivery_health_internal()
  to authenticated;

-- Entrada RPC publica sem privilegios extras.
create or replace function public.p3_delivery_health()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $rpc$
begin
  if (select auth.uid()) is null or
     (select private.is_admin()) is not true then
    raise exception 'Acesso restrito a administracao'
      using errcode='42501';
  end if;
  return private.phase3_delivery_health_internal();
end;
$rpc$;

revoke all on function public.p3_delivery_health()
  from public,anon,authenticated;
grant execute on function public.p3_delivery_health()
  to authenticated;

comment on function public.p3_delivery_health()
  is 'Fase 3: resumo admin de status e atrasos na fila de notificacoes, sem PII, segredos ou reenvio.';
commit;
