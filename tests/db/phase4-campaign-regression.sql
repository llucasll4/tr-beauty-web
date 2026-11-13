-- Consent-first in-app campaigns, real RLS and audited opt-out regression.
\set ON_ERROR_STOP on
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000002',false);

do $tests$
declare
  v_campaign uuid;
  v_published_at timestamptz;
  v_blocked boolean;
  v_count integer;
begin
  if (public.p4_marketing_summary()->>'consented')::int<>0 then
    raise exception 'Marketing must be opt-in by default';
  end if;

  insert into public.marketing_campaigns(title,body,duration_days,cta)
    values('Novidade do estúdio','Conheça a nova coleção de inspirações de unhas.',14,'book')
    returning id into v_campaign;

  if (public.p4_marketing_summary()->>'drafts')::int<>1 then
    raise exception 'New campaign must be only a draft';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000001',false);
  if (select count(*) from public.marketing_campaigns)<>0 then
    raise exception 'Client saw a marketing draft without consent';
  end if;

  -- User tries to forge the date. Only server time may be stored.
  insert into public.client_care_preferences(
    user_id,marketing_opt_in,marketing_consented_at
  ) values (
    '00000000-0000-4000-8000-000000000001',
    true,'2001-01-01T00:00:00Z'
  );
  if not exists(
    select 1 from public.client_care_preferences
     where user_id='00000000-0000-4000-8000-000000000001'
       and marketing_opt_in and marketing_consented_at>now()-interval '1 minute'
  ) then raise exception 'Server consent timestamp not authoritative'; end if;
  if (select count(*) from public.marketing_consent_events)<>1 then
    raise exception 'Explicit opt-in was not audited'; end if;
  if (select count(*) from public.marketing_campaigns)<>0 then
    raise exception 'Consented client saw unpublished draft'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000002',false);
  update public.marketing_campaigns set status='published' where id=v_campaign;
  select published_at into v_published_at from public.marketing_campaigns
    where id=v_campaign;
  if v_published_at is null or
    (select expires_at from public.marketing_campaigns where id=v_campaign)
      <>v_published_at+interval '14 days' then
    raise exception 'Campaign not published with server-side expiration';
  end if;

  v_blocked:=false;
  begin
    update public.marketing_campaigns set body='Texto alterado de forma imprópria'
      where id=v_campaign;
  exception when check_violation then v_blocked:=true; end;
  if not v_blocked then raise exception 'Published campaign body was mutable'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000001',false);
  if (select count(*) from public.marketing_campaigns)<>1 then
    raise exception 'Consented client cannot view published campaign'; end if;
  if (select title from public.marketing_campaigns limit 1)
     is distinct from 'Novidade do estúdio' then
    raise exception 'Unexpected campaign title'; end if;

  -- Even on a selected campaign, a client cannot write it.
  v_blocked:=false;
  begin
    update public.marketing_campaigns set status='archived' where id=v_campaign;
    get diagnostics v_count = row_count;
    if v_count=0 then v_blocked:=true; end if;
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Client changed a campaign'; end if;

  -- Client can opt out instantly even when the Admin published a promotion.
  update public.client_care_preferences
     set marketing_opt_in=false,marketing_consented_at='2001-01-01T00:00:00Z'
   where user_id='00000000-0000-4000-8000-000000000001';
  if (select count(*) from public.marketing_campaigns)<>0 then
    raise exception 'Opt-out did not immediately revoke campaign visibility';
  end if;
  if (select count(*) from public.marketing_consent_events)<>2 then
    raise exception 'Opt-out missing from audit'; end if;
  if exists (select 1 from public.client_care_preferences
    where user_id='00000000-0000-4000-8000-000000000001'
      and marketing_consented_at is not null) then
    raise exception 'Opt-out retained current marketing consent';
  end if;

  -- Another client cannot see the first client's consent events.
  perform pg_catalog.set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000002',false);
  if (public.p4_marketing_summary()->>'consented')::int<>0 then
    raise exception 'Audience counts did not respect opt-out';
  end if;
  if (select count(*) from public.marketing_consent_events)<>2 then
    raise exception 'Admin cannot inspect opt-in/opt-out audit';
  end if;
  update public.marketing_campaigns set status='archived' where id=v_campaign;
  v_blocked:=false;
  begin
    update public.marketing_campaigns set status='published' where id=v_campaign;
  exception when check_violation then v_blocked:=true; end;
  if not v_blocked then raise exception 'Archived campaign could be reopened'; end if;
end;
$tests$;

-- Anonymous and regular users have no permission to audit, send, delete or
-- call Admin summary. Campaign lifecycle never writes notification_outbox.
select pg_catalog.set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000001',false);
do $rights$
declare denied boolean:=false;
begin
  begin perform public.p4_marketing_summary();
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Client accessed Admin marketing aggregate'; end if;
  if (select count(*) from public.marketing_consent_events)<>2 then
    raise exception 'Client lost their own audit'; end if;
  denied:=false;
  begin
    insert into public.marketing_consent_events(user_id,opted_in)
      values(auth.uid(),true);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Client could forge consent evidence'; end if;
end;
$rights$;
reset role;

do $rights$
begin
  if has_function_privilege('anon','public.p4_marketing_summary()','EXECUTE') then
    raise exception 'Anon can call marketing aggregate';
  end if;
  if has_table_privilege('anon','public.marketing_campaigns','SELECT')
    or has_table_privilege('authenticated','public.marketing_campaigns','DELETE')
    or has_table_privilege('authenticated','public.marketing_consent_events','INSERT')
    or has_table_privilege('authenticated','public.marketing_consent_events','UPDATE')
    or has_table_privilege('authenticated','public.marketing_consent_events','DELETE') then
    raise exception 'Campaign / consent permissions too broad';
  end if;
end;
$rights$;
select 'PASS phase4_consent_campaigns' as result;
