-- Phase 4 Stage 2: truthful occupancy, no-show audit and admin-only access.
\set ON_ERROR_STOP on
-- June 4, 2025 (Wednesday), studio opens 08:00 to 20:00 local.
insert into public.appointments(id,client_id,service_id,starts_at,ends_at,status,price_at_booking)
values
 ('00000000-0000-4000-8000-000000009010',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 10:00-03','2025-06-04 11:00-03','completed',60),
 ('00000000-0000-4000-8000-000000009012',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 12:00-03','2025-06-04 13:00-03','confirmed',60),
 ('00000000-0000-4000-8000-000000009014',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 14:00-03','2025-06-04 15:00-03','cancelled',60),
 ('00000000-0000-4000-8000-000000009016',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 16:00-03','2025-06-04 17:00-03','pending',60),
 ('00000000-0000-4000-8000-000000009018',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 18:00-03','2025-06-04 18:30-03','cancelled',60),
 ('00000000-0000-4000-8000-000000009019',
  '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000060',
  '2025-06-04 19:00-03','2025-06-04 19:30-03','confirmed',60);
insert into public.appointment_reschedules(
  old_appointment_id,new_appointment_id,client_id,
  previous_starts_at,new_starts_at,previous_status
) values (
 '00000000-0000-4000-8000-000000009018',
 '00000000-0000-4000-8000-000000009019',
 '00000000-0000-4000-8000-000000000001',
 '2025-06-04 18:00-03','2025-06-04 19:00-03','confirmed'
);
insert into public.calendar_blocks(start_at,end_at)
values ('2025-06-04 09:00-03','2025-06-04 09:30-03');

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',false);

do $check$
declare v jsonb; m jsonb; min_data jsonb;
begin
  v:=public.p4_operational_metrics(2025,6);
  m:=v->'metrics';min_data:=v->'minutes';
  if (m->>'bookings')::int<>5
    or (m->>'cancelled')::int<>1
    or (m->>'rescheduled')::int<>1
    or (m->>'completed')::int<>1 then
    raise exception 'Cancellation/rebooking classification incorrect: %',m;
  end if;
  if (m->>'confirmed_no_shows')::int<>0
    or (m->>'unreviewed_confirmed')::int<>2
    or (m->>'unconfirmed_past')::int<>1 then
    raise exception 'Past unreviewed must NOT be inferred as no-shows: %',m;
  end if;
  if (min_data->>'booked')::numeric<>270
    or (min_data->>'blocked')::numeric<>30
    or (min_data->>'capacity')::numeric<=0 then
    raise exception 'Occupancy or block capacity wrong: %',min_data;
  end if;
  if jsonb_array_length(v->'review')<>3 then
    raise exception 'Attendance review list missing rows';
  end if;
  if (public.p4_operational_metrics(2025,null)->'minutes'->>'capacity')::numeric
      <= (min_data->>'capacity')::numeric then
    raise exception 'Annual capacity should exceed monthly';
  end if;
end;
$check$;

-- Explicitly recording one confirmed past no-show affects KPIs, not bookings.
insert into public.appointment_no_shows(appointment_id)
values ('00000000-0000-4000-8000-000000009012');
do $check$
declare v jsonb; n uuid;blocked boolean:=false;
begin
  v:=public.p4_operational_metrics(2025,6);
  if (v->'metrics'->>'confirmed_no_shows')::int<>1
    or (v->'metrics'->>'unreviewed_confirmed')::int<>1
    or (v->'metrics'->>'attended_or_absent')::int<>2 then
    raise exception 'Recorded no-show not reflected: %',v->'metrics';
  end if;
  select id into n from public.appointment_no_shows
   where appointment_id='00000000-0000-4000-8000-000000009012'
     and voided_at is null;
  if n is null then raise exception 'Audit entry missing'; end if;
  begin
    update public.appointments set status='completed'
      where id='00000000-0000-4000-8000-000000009012';
  exception when check_violation then blocked:=true;
  end;
  if not blocked then
    raise exception 'Contradictory completion after recorded absence was accepted';
  end if;
end;
$check$;

-- A pending appointment is not a confirmed absence.
do $check$
declare blocked boolean:=false;
begin
  begin
    insert into public.appointment_no_shows(appointment_id)
    values ('00000000-0000-4000-8000-000000009016');
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'Pending reservation classified as confirmed absence'; end if;
end;
$check$;

-- Correction needs a reason and audit trail.
do $check$
declare blocked boolean:=false;
begin
  begin
    update public.appointment_no_shows set voided_at=now(),
      voided_by=auth.uid(),void_reason='erro'
    where appointment_id='00000000-0000-4000-8000-000000009012' and voided_at is null;
  exception when check_violation then blocked:=true; end;
  if not blocked then raise exception 'No-show correction accepted without valid reason'; end if;
end;
$check$;
update public.appointment_no_shows
  set voided_at=now(),voided_by=auth.uid(),
      void_reason='Cliente compareceu ao atendimento'
where appointment_id='00000000-0000-4000-8000-000000009012'
  and voided_at is null;
do $check$
declare v jsonb;
begin
  v:=public.p4_operational_metrics(2025,6);
  if (v->'metrics'->>'confirmed_no_shows')::integer<>0 then
    raise exception 'Voided no-show still counted';
  end if;
end;
$check$;

-- A new record after correction is allowed; old row remains for audit.
insert into public.appointment_no_shows(appointment_id)
values ('00000000-0000-4000-8000-000000009012');

-- A client has neither global KPI access nor no-show registration privileges.
select pg_catalog.set_config('request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',false);
do $check$
declare denied boolean:=false;
begin
  begin perform public.p4_operational_metrics(2025,6);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Client accessed admin operation KPIs'; end if;
  if (select count(*) from public.appointment_no_shows)<>0 then
    raise exception 'Client read confidential attendance records';
  end if;
  denied:=false;
  begin
    insert into public.appointment_no_shows(appointment_id)
      values ('00000000-0000-4000-8000-000000009019');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Client recorded no-show'; end if;
end;
$check$;
reset role;
do $check$
begin
  if has_function_privilege('anon','public.p4_operational_metrics(integer,integer)','EXECUTE') then
    raise exception 'Unauthenticated role can execute KPI RPC';
  end if;
  if has_table_privilege('authenticated','public.appointment_no_shows','DELETE')
    or has_column_privilege('authenticated','public.appointment_no_shows','appointment_id','UPDATE')
    or has_column_privilege('authenticated','public.appointment_no_shows','recorded_by','UPDATE') then
    raise exception 'Audit history incorrectly writable';
  end if;
  if (select count(*) from public.appointment_no_shows
    where appointment_id='00000000-0000-4000-8000-000000009012')<>2 then
    raise exception 'Corrected audit record removed';
  end if;
end;
$check$;
select 'PASS phase4_operational_kpis_and_audited_no_shows' as result;
