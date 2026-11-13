-- Marketing integration fixture — disposable PostgreSQL only, never production.
\set ON_ERROR_STOP on
create table public.client_care_preferences (
  user_id uuid primary key references public.profiles(id),
  service_style text not null default 'sem_preferencia',
  favorite_drink text not null default 'sem_preferencia',
  app_alerts_enabled boolean not null default true,
  marketing_opt_in boolean not null default false,
  marketing_consented_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.client_care_preferences enable row level security;
create policy "Fixture client reads own care or admin"
 on public.client_care_preferences for select to authenticated
 using (user_id=(select auth.uid()) or (select private.is_admin()) is true);
create policy "Fixture client inserts own care"
 on public.client_care_preferences for insert to authenticated
 with check (user_id=(select auth.uid()));
create policy "Fixture client updates own care"
 on public.client_care_preferences for update to authenticated
 using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));
grant select,insert,update on public.client_care_preferences to authenticated;
