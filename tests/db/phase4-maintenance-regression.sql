-- Phase 4 Stage 3: optional interval, database constraints and Admin-only edits.
\set ON_ERROR_STOP on
do $test$
begin
 if (select count(*) from public.services where maintenance_interval_days is not null)<>0 then
  raise exception 'Existing services must remain opted out until Admin configures maintenance';
 end if;
end;
$test$;
update public.services set maintenance_interval_days=21
 where id='00000000-0000-4000-8000-000000000060';
do $test$
declare rejected boolean:=false;
begin
 begin
  update public.services set maintenance_interval_days=7
    where id='00000000-0000-4000-8000-000000000060';
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Out of range value 7 accepted'; end if;
 rejected:=false;
 begin
  update public.services set maintenance_interval_days=91
    where id='00000000-0000-4000-8000-000000000060';
 exception when check_violation then rejected:=true;
 end;
 if not rejected then raise exception 'Out of range value 91 accepted'; end if;
 if (select maintenance_interval_days from public.services
      where id='00000000-0000-4000-8000-000000000060')<>21 then
  raise exception 'Valid maintenance cadence lost';
 end if;
end;
$test$;
-- Existing service RLS must not allow customer modification.
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000001',false);
do $test$
declare changed integer:=0; denied boolean:=false;
begin
 begin
  update public.services set maintenance_interval_days=30
    where id='00000000-0000-4000-8000-000000000060';
  get diagnostics changed = row_count;
 exception when insufficient_privilege then denied:=true;
 end;
 if not denied and changed<>0 then
  raise exception 'Client changed Admin maintenance configuration';
 end if;
end;
$test$;
reset role;
do $test$
begin
 if (select maintenance_interval_days from public.services
      where id='00000000-0000-4000-8000-000000000060')<>21 then
  raise exception 'Client update bypassed existing services RLS';
 end if;
end;
$test$;
update public.services set maintenance_interval_days=null
 where id='00000000-0000-4000-8000-000000000060';
select 'PASS phase4_maintenance_config' as result;
