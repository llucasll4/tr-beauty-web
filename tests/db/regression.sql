\set ON_ERROR_STOP on
-- Execute only against disposable PostgreSQL in CI, never production.
set time zone 'UTC';
select set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000001',false);
do $tests$
declare
 v_tue date; v_wed date; v_start timestamptz; v_id uuid; v_paid uuid;
 v_balance bigint; v_count bigint; v_raised boolean;
 s120 uuid := '00000000-0000-4000-8000-000000000120';
 s60 uuid := '00000000-0000-4000-8000-000000000060';
begin
 select min(d::date) into v_tue
 from generate_series(
  ((now() at time zone 'America/Sao_Paulo')::date+7)::timestamp,
  ((now() at time zone 'America/Sao_Paulo')::date+23)::timestamp,
  interval '1 day'
 ) d where extract(dow from d)=2;
 select min(d::date) into v_wed
 from generate_series(
  ((now() at time zone 'America/Sao_Paulo')::date+7)::timestamp,
  ((now() at time zone 'America/Sao_Paulo')::date+23)::timestamp,
  interval '1 day'
 ) d where extract(dow from d)=3;
 if v_tue is null or v_wed is null then
  raise exception 'Test weekdays not found';
 end if;
 v_start := (v_tue+time '10:00') at time zone 'America/Sao_Paulo';
 v_id := public.book_appointment(s120,v_start);
 if v_id is null then raise exception 'Booking not confirmed'; end if;
 if not exists (
  select 1 from public.available_slots(s60,v_tue)
  where starts_at=(v_tue+time '12:15') at time zone 'America/Sao_Paulo'
 ) then raise exception 'Two-hour service at 10h must free next slot at 12h15';end if;
 if exists (
  select 1 from public.available_slots(s60,v_tue)
  where starts_at=(v_tue+time '12:00') at time zone 'America/Sao_Paulo'
 ) then raise exception 'Missing 15 minute buffer';end if;
 v_raised:=false;
 begin
  perform public.book_appointment(s60,v_start);
 exception when sqlstate '22023' or exclusion_violation then v_raised:=true;
 end;
 if not v_raised then raise exception 'Conflict accepted by booking RPC';end if;
 v_raised:=false;
 begin
  insert into public.appointments(client_id,service_id,starts_at,ends_at,status,price_at_booking)
  values('00000000-0000-4000-8000-000000000002',s60,
   (v_tue+time '10:15') at time zone 'America/Sao_Paulo',
   (v_tue+time '11:15') at time zone 'America/Sao_Paulo','pending',60);
 exception when exclusion_violation then v_raised:=true;
 end;
 if not v_raised then raise exception 'GiST exclusion did not prevent overlap';end if;
 insert into public.calendar_blocks(start_at,end_at) values(
  (v_tue+time '14:00') at time zone 'America/Sao_Paulo',
  (v_tue+time '15:00') at time zone 'America/Sao_Paulo');
 if exists(
  select 1 from public.available_slots(s60,v_tue)
  where starts_at=(v_tue+time '13:00') at time zone 'America/Sao_Paulo'
 ) then raise exception 'Blocked gap incorrectly offered'; end if;
 if not exists(
  select 1 from public.available_slots(s60,v_tue)
  where starts_at=(v_tue+time '12:45') at time zone 'America/Sao_Paulo'
 ) then raise exception 'Valid intermediate gap lost'; end if;
 v_raised:=false;
 begin
  insert into public.calendar_blocks(start_at,end_at) values(
   (v_tue+time '10:15') at time zone 'America/Sao_Paulo',
   (v_tue+time '11:00') at time zone 'America/Sao_Paulo');
 exception when exclusion_violation then v_raised:=true;
 end;
 if not v_raised then raise exception 'Blocking an occupied appointment succeeded';end if;
 if exists(
  select 1 from public.available_slots(s120,v_tue)
  where (starts_at at time zone 'America/Sao_Paulo')::time>time '15:45'
 ) then raise exception 'Tuesday service+buffer exceeds closing time';end if;
 if not exists(
  select 1 from public.available_slots(s120,v_wed)
  where starts_at=(v_wed+time '20:00') at time zone 'America/Sao_Paulo'
 ) then raise exception 'Wednesday should offer last start at 20h';end if;
 select coalesce(sum(points),0) into v_balance from public.points_ledger
  where client_id='00000000-0000-4000-8000-000000000001';
 if v_balance<>0 then raise exception 'Points credited before completion';end if;
 update public.appointments set status='completed' where id=v_id;
 update public.appointments set status='completed' where id=v_id;
 select coalesce(sum(points),0),count(*) into v_balance,v_count
 from public.points_ledger where appointment_id=v_id and event_type='earned';
 if v_balance<>120 or v_count<>1 then
  raise exception 'Points credited incorrectly or twice: %, %',v_balance,v_count;
 end if;
 v_paid:=public.book_appointment_with_points(s60,
  (v_wed+time '11:00') at time zone 'America/Sao_Paulo');
 if not exists(select 1 from public.appointments
   where id=v_paid and price_at_booking=0 and points_redeemed=100)
 then raise exception 'TR Points reservation incorrect';end if;
 select coalesce(sum(points),0) into v_balance from public.points_ledger
  where client_id='00000000-0000-4000-8000-000000000001';
 if v_balance<>20 then raise exception 'Points balance after redemption wrong: %',v_balance;end if;
 update public.appointments set status='cancelled' where id=v_paid;
 update public.appointments set status='cancelled' where id=v_paid;
 select coalesce(sum(points),0) into v_balance from public.points_ledger
  where client_id='00000000-0000-4000-8000-000000000001';
 select count(*) into v_count from public.points_ledger
  where appointment_id=v_paid and event_type='reversal';
 if v_balance<>120 or v_count<>1 then
  raise exception 'Incorrect refund or duplicate: %, %',v_balance,v_count;
 end if;
 raise notice 'PASS: slots, buffer, overlapping, blocks, hours, points and refund';
end;
$tests$;
