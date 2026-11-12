-- Phase 3 delivery health: auth and status counts, disposable PG only.
\set ON_ERROR_STOP on
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',false);

do $test$
declare
  v jsonb;
  v_email jsonb;
  v_wa jsonb;
begin
  v:=public.p3_delivery_health();
  if (v->>'total_overdue')::integer<>1
     or (v->>'total_failed')::integer<>1
     or (v->>'overdue_threshold_minutes')::integer<>15 then
    raise exception 'Delivery monitoring summary not correct: %',v;
  end if;
  select elem into v_email from jsonb_array_elements(v->'channels') elem
    where elem->>'channel'='email';
  select elem into v_wa from jsonb_array_elements(v->'channels') elem
    where elem->>'channel'='whatsapp';
  if (v_email->>'pending')::integer<>2
     or (v_email->>'overdue')::integer<>1
     or (v_email->>'processing')::integer<>1
     or (v_email->>'sent')::integer<>1
     or (v_wa->>'failed')::integer<>1
     or (v_wa->>'skipped')::integer<>1 then
    raise exception 'Channel metrics not correct: %',v->'channels';
  end if;
  if jsonb_array_length(v->'recent_issues')<>2 then
    raise exception 'Delivery issue list must have only failed or late jobs';
  end if;
  if v::text like '%client_id%'
     or v::text like '%last_error%'
     or v::text like '%provider_message_id%' then
    raise exception 'Sensitive field leaked in health RPC';
  end if;
end;
$test$;

-- Changing to a normal client must deny both public and private functions.
select pg_catalog.set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

do $test$
declare denied boolean:=false;
begin
  begin
    perform public.p3_delivery_health();
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Client can access delivery RPC'; end if;
end;
$test$;

do $test$
declare denied boolean:=false;
begin
  begin
    perform private.phase3_delivery_health_internal();
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Client can access privileged health query'; end if;
end;
$test$;
reset role;

do $test$
begin
  if has_function_privilege('anon','public.p3_delivery_health()','EXECUTE')
     or has_function_privilege('anon','private.phase3_delivery_health_internal()','EXECUTE') then
    raise exception 'Anonymous access to health report';
  end if;
  if has_table_privilege('authenticated','public.notification_outbox','SELECT') then
    raise exception 'Outbox direct SELECT granted to authenticated';
  end if;
  if (select count(*) from public.notification_outbox)<>6 then
    raise exception 'Monitoring modified the outbox';
  end if;
end;
$test$;
select 'PASS phase3_delivery_health' as result;
