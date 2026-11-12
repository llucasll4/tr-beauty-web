-- Isolated test support for Phase 3. Never run against production.
\set ON_ERROR_STOP on
alter table public.profiles add column if not exists full_name text;
create schema if not exists private;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='admin');
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

update public.profiles set role='admin'
 where id='00000000-0000-4000-8000-000000000002';

-- Local fixture: emulate the existing RLS required by the SECURITY INVOKER RPC.
alter table public.appointments enable row level security;
create policy "Fixture admin selects appointments"
 on public.appointments for select to authenticated
 using ((select private.is_admin()) is true);
create policy "Fixture admin updates appointments"
 on public.appointments for update to authenticated
 using ((select private.is_admin()) is true)
 with check ((select private.is_admin()) is true);
grant select,update on public.appointments to authenticated;
grant select on public.profiles,public.services to authenticated;
