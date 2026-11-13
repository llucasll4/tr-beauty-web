-- Phase 4 / Stage 4: explicit marketing consent and in-app campaigns only.
-- No outbound email, WhatsApp, push notification, job or recipient list.
begin;

-- Keep evidence of each opt-in and opt-out, while allowing user deletion
-- in accordance with a future retention and account-erasure procedure.
create table public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opted_in boolean not null,
  changed_at timestamptz not null default pg_catalog.now(),
  source text not null default 'client_preferences'
    check (source='client_preferences')
);
create index marketing_consent_events_by_user
  on public.marketing_consent_events(user_id,changed_at desc);
alter table public.marketing_consent_events enable row level security;
create policy "Client reads own marketing consent changes or admin"
  on public.marketing_consent_events for select to authenticated
  using (user_id=(select auth.uid()) or (select private.is_admin()) is true);
revoke all on public.marketing_consent_events from public,anon,authenticated;
grant select on public.marketing_consent_events to authenticated;

-- The server, not client-supplied timestamps, is authoritative.
create or replace function private.p4_marketing_consent_stamp()
returns trigger language plpgsql security definer set search_path=''
as $consent$
begin
  if tg_op='INSERT' then
    new.marketing_consented_at := case when new.marketing_opt_in
      then pg_catalog.now() else null end;
  elsif new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_consented_at := case when new.marketing_opt_in
      then pg_catalog.now() else null end;
  else
    new.marketing_consented_at := old.marketing_consented_at;
  end if;
  return new;
end;
$consent$;
create trigger p4_marketing_consent_stamp
  before insert or update on public.client_care_preferences
  for each row execute function private.p4_marketing_consent_stamp();

create or replace function private.p4_marketing_consent_audit()
returns trigger language plpgsql security definer set search_path=''
as $consent$
begin
  if (tg_op='INSERT' and new.marketing_opt_in)
    or (tg_op='UPDATE' and new.marketing_opt_in is distinct from old.marketing_opt_in)
  then
    insert into public.marketing_consent_events(user_id,opted_in)
    values(new.user_id,new.marketing_opt_in);
  end if;
  return new;
end;
$consent$;
create trigger p4_marketing_consent_audit
  after insert or update on public.client_care_preferences
  for each row execute function private.p4_marketing_consent_audit();

revoke all on function private.p4_marketing_consent_stamp()
  from public,anon,authenticated;
revoke all on function private.p4_marketing_consent_audit()
  from public,anon,authenticated;

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 5 and 90),
  body text not null check (char_length(btrim(body)) between 15 and 550),
  cta text not null default 'book' check (cta in ('book','none')),
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  duration_days integer not null default 30
    check (duration_days between 7 and 90),
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  published_at timestamptz,
  expires_at timestamptz,
  constraint marketing_campaign_publication_consistency check (
    (status='draft' and published_at is null and expires_at is null)
    or (status='published' and published_at is not null
        and expires_at=published_at+pg_catalog.make_interval(days=>duration_days))
    or (status='archived')
  )
);
create index marketing_campaigns_public_idx
  on public.marketing_campaigns(published_at desc)
  where status='published';
alter table public.marketing_campaigns enable row level security;
create policy "Admin sees campaign drafts; consenting clients see live promotions"
  on public.marketing_campaigns for select to authenticated
  using (
    (select private.is_admin()) is true
    or (
      status='published' and published_at <= pg_catalog.now()
      and expires_at > pg_catalog.now()
      and exists (
        select 1 from public.client_care_preferences p
         where p.user_id=(select auth.uid())
           and p.marketing_opt_in=true
           and p.marketing_consented_at is not null
      )
    )
  );
create policy "Only Admin creates campaign drafts"
  on public.marketing_campaigns for insert to authenticated
  with check ((select private.is_admin()) is true
    and status='draft' and created_by=(select auth.uid()));
create policy "Only Admin changes campaigns"
  on public.marketing_campaigns for update to authenticated
  using ((select private.is_admin()) is true)
  with check ((select private.is_admin()) is true);

revoke all on public.marketing_campaigns from public,anon,authenticated;
grant select,insert,update on public.marketing_campaigns to authenticated;
-- No DELETE privilege: preserve publishing and archiving history.

create or replace function private.p4_campaign_guard()
returns trigger language plpgsql security invoker set search_path=''
as $campaign$
begin
  if (select private.is_admin()) is not true then
    raise exception 'Somente a administração edita campanhas'
      using errcode='42501';
  end if;
  new.title:=btrim(new.title);
  new.body:=btrim(new.body);
  if tg_op='INSERT' then
    if new.status<>'draft' or new.published_at is not null
       or new.expires_at is not null or new.created_by is distinct from auth.uid()
    then
      raise exception 'Crie campanhas apenas como rascunho'
        using errcode='23514';
    end if;
    new.updated_at:=pg_catalog.now();
  else
    if new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Não altere o histórico de autoria da campanha'
        using errcode='23514';
    end if;
    if old.status='archived' then
      raise exception 'Campanha arquivada não pode ser reaberta'
        using errcode='23514';
    end if;
    if old.status='published' then
      if new.status<>'archived'
        or new.title is distinct from old.title or new.body is distinct from old.body
        or new.cta is distinct from old.cta or new.duration_days is distinct from old.duration_days
        or new.published_at is distinct from old.published_at
        or new.expires_at is distinct from old.expires_at then
        raise exception 'Campanha publicada apenas pode ser arquivada'
          using errcode='23514';
      end if;
    elsif old.status='draft' then
      if new.status not in('draft','published','archived') then
        raise exception 'Transição inválida da campanha' using errcode='23514';
      end if;
      if new.status='published' then
        new.published_at:=pg_catalog.now();
        new.expires_at:=new.published_at+pg_catalog.make_interval(days=>new.duration_days);
      elsif new.published_at is not null or new.expires_at is not null then
        raise exception 'Publicação controlada pelo servidor' using errcode='23514';
      end if;
    end if;
    new.updated_at:=pg_catalog.now();
  end if;
  return new;
end;
$campaign$;
create trigger p4_campaign_guard
  before insert or update on public.marketing_campaigns
  for each row execute function private.p4_campaign_guard();
revoke all on function private.p4_campaign_guard()
  from public,anon,authenticated;

-- Only aggregate consent numbers, never return names, emails or phone numbers.
create or replace function public.p4_marketing_summary()
returns jsonb language plpgsql stable security invoker set search_path=''
as $summary$
begin
  if (select private.is_admin()) is not true then
    raise exception 'Resumo de campanhas restrito ao estúdio' using errcode='42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'consented',(
      select count(*) from public.client_care_preferences c
       join public.profiles p on p.id=c.user_id and p.role='client'
       where c.marketing_opt_in=true and c.marketing_consented_at is not null
    ),
    'published',(
      select count(*) from public.marketing_campaigns
       where status='published' and expires_at>pg_catalog.now()
    ),
    'drafts',(select count(*) from public.marketing_campaigns where status='draft')
  );
end;
$summary$;
revoke all on function public.p4_marketing_summary()
  from public,anon,authenticated;
grant execute on function public.p4_marketing_summary() to authenticated;

comment on table public.marketing_campaigns is
  'In-app editorial cards, only for clients opted in. Publishing never sends email or WhatsApp.';
comment on table public.marketing_consent_events is
  'Immutable client marketing opt-in/opt-out evidence; no direct client write.';
commit;
