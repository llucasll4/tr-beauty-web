-- Phase 3 financial reconciliation regression, disposable Postgres only.
\set ON_ERROR_STOP on
insert into public.appointments(id,client_id,service_id,starts_at,ends_at,status,price_at_booking)
values('00000000-0000-4000-8000-000000008888',
'00000000-0000-4000-8000-000000000001',
'00000000-0000-4000-8000-000000000120',
'2030-03-18T16:00:00Z','2030-03-18T18:00:00Z','completed',120);

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);

-- No payment should be invented for a completed service.
do $test$
declare v jsonb;
begin
  v:=public.p3_financial_snapshot(2030,3);
  if (v->'metrics'->>'estimated_completed')::numeric<>120
    or (v->'metrics'->>'received_in_period')::numeric<>0
    or (v->'metrics'->>'unrecorded')::numeric<>120 then
    raise exception 'Phase3 initial estimated/received segregation failed: %',v->'metrics';
  end if;
end;
$test$;

insert into public.appointment_payments(appointment_id,amount,method,received_at)
values('00000000-0000-4000-8000-000000008888',50,'pix','2030-03-19T13:00:00Z');

do $test$
declare v jsonb;
begin
  v:=public.p3_financial_snapshot(2030,3);
  if (v->'metrics'->>'registered_for_services')::numeric<>50
    or (v->'metrics'->>'unrecorded')::numeric<>70
    or (v->'metrics'->>'received_in_period')::numeric<>50 then
    raise exception 'Phase3 partial receipt calculation failed: %',v->'metrics';
  end if;
end;
$test$;

-- DB must reject over-payment, even when client-side validation is bypassed.
do $test$
declare blocked boolean:=false;
begin
  begin
    insert into public.appointment_payments(appointment_id,amount,method,received_at)
    values('00000000-0000-4000-8000-000000008888',80,'cash','2030-03-19T13:01:00Z');
  exception when check_violation then blocked:=true;
  end;
  if not blocked then raise exception 'Overpayment was accepted'; end if;
end;
$test$;

insert into public.appointment_payments(appointment_id,amount,method,received_at)
values('00000000-0000-4000-8000-000000008888',70,'credit','2030-03-19T14:00:00Z');

do $test$
declare v jsonb;
begin
  v:=public.p3_financial_snapshot(2030,3);
  if (v->'metrics'->>'registered_for_services')::numeric<>120
    or (v->'metrics'->>'unrecorded')::numeric<>0 then
    raise exception 'Fully received service has wrong balance';
  end if;
end;
$test$;

-- Editing amounts is forbidden. Voiding requires a reason and stores actor/time.
do $test$
declare blocked boolean:=false;
begin
  begin
    update public.appointment_payments set amount=51
    where appointment_id='00000000-0000-4000-8000-000000008888' and amount=50;
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Payment amount was editable'; end if;
end;
$test$;

update public.appointment_payments
set voided_at=now(),voided_by=auth.uid(),void_reason='Duplicidade confirmada'
where appointment_id='00000000-0000-4000-8000-000000008888' and amount=50;

do $test$
declare v jsonb;
begin
  v:=public.p3_financial_snapshot(2030,3);
  if (v->'metrics'->>'registered_for_services')::numeric<>70
    or (v->'metrics'->>'unrecorded')::numeric<>50
    or (v->'metrics'->>'received_in_period')::numeric<>70 then
    raise exception 'Voided receipt is counted: %',v->'metrics';
  end if;
end;
$test$;

-- Client may neither read nor record another person's financial data.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $test$
declare blocked boolean:=false;
begin
  begin
    perform public.p3_financial_snapshot(2030,3);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Client accessed admin-only snapshot'; end if;
end;
$test$;

do $test$
declare blocked boolean:=false;
begin
  begin
    insert into public.appointment_payments(appointment_id,amount,method,received_at)
    values('00000000-0000-4000-8000-000000008888',10,'pix','2030-03-20T12:00:00Z');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Client created a payment'; end if;
end;
$test$;

do $test$
begin
  if (select count(*) from public.appointment_payments)<>0 then
    raise exception 'Client can read a payment';
  end if;
end;
$test$;

reset role;
do $test$
begin
  if (select count(*) from public.appointment_payments
      where appointment_id='00000000-0000-4000-8000-000000008888')<>2 then
    raise exception 'Voided audit row was deleted';
  end if;
end;
$test$;
select 'PASS phase3_manual_receipts_finance' as result;
