-- Phase 4: end-to-end rescheduling with real booking/points functions.
\set ON_ERROR_STOP on
set time zone 'UTC';
select pg_catalog.set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);

do $tests$
declare
  s120 uuid := '00000000-0000-4000-8000-000000000120';
  s60 uuid := '00000000-0000-4000-8000-000000000060';
  client1 uuid := '00000000-0000-4000-8000-000000000001';
  client2 uuid := '00000000-0000-4000-8000-000000000002';
  v_fri date;
  v_first uuid;
  v_second uuid;
  v_third uuid;
  v_points uuid;
  v_new_points uuid;
  v_collision uuid;
  v_bad uuid;
  v_cash_orig numeric;
  v_total bigint;
  v_points_balance_before bigint;
  v_reversals integer;
  v_blocked boolean;
begin
  select min(d::date) into v_fri
    from pg_catalog.generate_series(
       ((pg_catalog.now() at time zone 'America/Sao_Paulo')::date+12)::timestamp,
       ((pg_catalog.now() at time zone 'America/Sao_Paulo')::date+20)::timestamp,
       interval '1 day') d
   where extract(dow from d)=5;
  if v_fri is null then raise exception 'Test Friday missing'; end if;

  v_first:=public.book_appointment(s120,(v_fri+time '10:00') at time zone 'America/Sao_Paulo');
  update public.appointments set notes='Detalhe originalmente informado' where id=v_first;
  if exists (
    select 1 from public.available_slots(s120,v_fri)
    where starts_at=(v_fri+time '11:00') at time zone 'America/Sao_Paulo'
  ) then raise exception 'Existing booking incorrectly ignored by normal availability'; end if;
  if not exists (
    select 1 from public.available_reschedule_slots(v_first,v_fri)
    where starts_at=(v_fri+time '11:00') at time zone 'America/Sao_Paulo'
  ) then raise exception 'Rescheduling calendar must ignore own occupied slot'; end if;
  if exists (
    select 1 from public.available_reschedule_slots(v_first,v_fri)
    where starts_at=(v_fri+time '10:00') at time zone 'America/Sao_Paulo'
  ) then raise exception 'Rescheduling offered identical original time'; end if;

  -- Price changes must not raise the originally agreed amount.
  select price_at_booking into v_cash_orig from public.appointments where id=v_first;
  update public.services set price=180 where id=s120;
  v_second:=public.reschedule_appointment(
    v_first,(v_fri+time '11:00') at time zone 'America/Sao_Paulo');
  if v_second=v_first or not exists(
    select 1 from public.appointments where id=v_first and status='cancelled'
  ) or not exists (
    select 1 from public.appointments
      where id=v_second and status='pending' and price_at_booking=v_cash_orig
       and notes='Detalhe originalmente informado'
  ) then raise exception 'Cash reschedule failed to preserve booking terms'; end if;
  if not exists (
    select 1 from public.appointment_reschedules
    where old_appointment_id=v_first and new_appointment_id=v_second
       and client_id=client1 and previous_status='pending'
  ) then raise exception 'Cash audit link missing'; end if;

  -- Confirmed reservations require a new approval after rescheduling.
  update public.appointments set status='confirmed' where id=v_second;
  v_third:=public.reschedule_appointment(
    v_second,(v_fri+time '13:00') at time zone 'America/Sao_Paulo');
  if not exists (
    select 1 from public.appointments where id=v_third and status='pending'
  ) or not exists (
    select 1 from public.appointment_reschedules
      where old_appointment_id=v_second and previous_status='confirmed'
  ) then raise exception 'Confirmed booking did not return to pending'; end if;

  -- Other account must not access slots or mutate a booking by guessing UUID.
  perform pg_catalog.set_config('request.jwt.claim.sub',client2::text,false);
  v_blocked:=false;
  begin perform * from public.available_reschedule_slots(v_third,v_fri);
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Other account could list reschedule slots'; end if;
  v_blocked:=false;
  begin
    perform public.reschedule_appointment(
      v_third,(v_fri+time '10:00') at time zone 'America/Sao_Paulo');
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Other account rescheduled a booking'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',client1::text,false);

  -- Failure must roll back cancellation, point reversals and audit rows.
  v_collision:=public.book_appointment(
    s60,(v_fri+time '19:00') at time zone 'America/Sao_Paulo');
  v_blocked:=false;
  begin
    perform public.reschedule_appointment(
      v_third,(v_fri+time '19:00') at time zone 'America/Sao_Paulo');
  exception when sqlstate '22023' or exclusion_violation then v_blocked:=true; end;
  if not v_blocked then raise exception 'Conflict accepted'; end if;
  if not exists (
    select 1 from public.appointments where id=v_third and status='pending'
  ) or exists (
    select 1 from public.appointment_reschedules where old_appointment_id=v_third
  ) then raise exception 'Conflict incorrectly cancelled original booking'; end if;

  -- A late request must fail without touching the original.
  insert into public.appointments(client_id,service_id,starts_at,ends_at,status,price_at_booking)
  values(client1,s60,now()+interval '12 hours',
         now()+interval '13 hours','pending',60) returning id into v_bad;
  v_blocked:=false;
  begin
    perform public.reschedule_appointment(
      v_bad,(v_fri+time '08:00') at time zone 'America/Sao_Paulo');
  exception when sqlstate '22023' then v_blocked:=true; end;
  if not v_blocked then raise exception '24h cutoff not enforced'; end if;
  if not exists (
    select 1 from public.appointments where id=v_bad and status='pending'
  ) then raise exception 'Late booking was incorrectly cancelled'; end if;

  -- Points: cancellation refunds once, fresh pending booking redeems once.
  v_points:=public.book_appointment_with_points(
    s60,(v_fri+time '16:00') at time zone 'America/Sao_Paulo');
  select coalesce(sum(points),0) into v_total from public.points_ledger
    where client_id=client1;
  v_points_balance_before:=v_total;
  update public.services set redeem_points=120 where id=s60;
  v_blocked:=false;
  begin
    perform public.reschedule_appointment(
      v_points,(v_fri+time '17:00') at time zone 'America/Sao_Paulo');
  exception when sqlstate '22023' then v_blocked:=true; end;
  if not v_blocked then raise exception 'Changed points terms were not rejected'; end if;
  if not exists (select 1 from public.appointments where id=v_points and status='pending')
     or (select coalesce(sum(points),0) from public.points_ledger where client_id=client1)<>v_total then
    raise exception 'Failed points attempt modified balance or booking'; end if;
  update public.services set redeem_points=100 where id=s60;

  v_new_points:=public.reschedule_appointment(
    v_points,(v_fri+time '17:00') at time zone 'America/Sao_Paulo');
  if not exists (
    select 1 from public.appointments
    where id=v_points and status='cancelled' and points_redeemed=100
  ) or not exists (
    select 1 from public.appointments
    where id=v_new_points and status='pending' and points_redeemed=100
      and price_at_booking=0
  ) then raise exception 'Points reschedule did not retain redemption'; end if;
  select coalesce(sum(points),0) into v_total from public.points_ledger where client_id=client1;
  select count(*) into v_reversals from public.points_ledger
    where appointment_id=v_points and event_type='reversal';
  if v_total<>v_points_balance_before or v_reversals<>1 then
    raise exception 'Points refund/redeem not atomic: balance %, refunds %',v_total,v_reversals;
  end if;
  v_blocked:=false;
  begin
    perform public.reschedule_appointment(
      v_points,(v_fri+time '18:00') at time zone 'America/Sao_Paulo');
  exception when sqlstate '22023' then v_blocked:=true; end;
  if not v_blocked then raise exception 'Already cancelled reservation rescheduled twice'; end if;
  raise notice 'PASS phase4: own slots, cutoff, conflict rollback, price, status, TR Points';
end;
$tests$;

-- RLS: client may read own audit rows but cannot add, edit or delete them.
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000001',false);
do $rls$
declare v_denied boolean:=false;
begin
 if (select count(*) from public.appointment_reschedules)<3 then
   raise exception 'Client cannot read own rescheduling audit trail';
 end if;
 begin
   delete from public.appointment_reschedules;
 exception when insufficient_privilege then v_denied:=true;
 end;
 if not v_denied then raise exception 'Client could delete audit history'; end if;
end;
$rls$;
reset role;
do $rights$
begin
 if has_function_privilege('anon','public.reschedule_appointment(uuid,timestamptz)','EXECUTE')
    or has_function_privilege('anon','public.available_reschedule_slots(uuid,date)','EXECUTE') then
   raise exception 'Anonymous rescheduling access was granted';
 end if;
 if has_table_privilege('authenticated','public.appointment_reschedules','INSERT')
    or has_table_privilege('authenticated','public.appointment_reschedules','UPDATE')
    or has_table_privilege('authenticated','public.appointment_reschedules','DELETE') then
   raise exception 'Audit trail must not be mutable via Data API';
 end if;
end;
$rights$;
select 'PASS phase4_client_rescheduling' as result;
