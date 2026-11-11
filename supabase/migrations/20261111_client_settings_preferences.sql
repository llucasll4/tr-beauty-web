-- Preferências das clientes do TR Beauty Concept.
-- Sem dados fictícios, sem disparos promocionais ou push automáticos.
begin;

create table public.client_care_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  service_style text not null default 'sem_preferencia'
    constraint client_care_style_check
    check (service_style in ('sem_preferencia','silencioso','conversar')),
  favorite_drink text not null default 'sem_preferencia'
    constraint client_care_drink_check
    check (favorite_drink in ('sem_preferencia','agua','cafe','cha')),
  app_alerts_enabled boolean not null default true,
  marketing_opt_in boolean not null default false,
  marketing_consented_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint marketing_consent_consistent
    check ((marketing_opt_in and marketing_consented_at is not null)
       or (not marketing_opt_in and marketing_consented_at is null))
);
alter table public.client_care_preferences enable row level security;
create policy "Client reads own preferences or admin"
  on public.client_care_preferences for select to authenticated
  using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy "Client inserts own preferences"
  on public.client_care_preferences for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy "Client updates own preferences"
  on public.client_care_preferences for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.client_care_preferences from public,anon,authenticated;
grant select,insert,update on public.client_care_preferences to authenticated;
grant all on public.client_care_preferences to service_role;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    constraint account_deletion_status_check check (status in ('pending','processed','rejected')),
  created_at timestamptz not null default now()
);
create unique index one_pending_deletion_request_per_user
  on public.account_deletion_requests(user_id) where status='pending';
alter table public.account_deletion_requests enable row level security;
create policy "Client reads own deletion requests or admin"
  on public.account_deletion_requests for select to authenticated
  using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy "Client can submit deletion request"
  on public.account_deletion_requests for insert to authenticated
  with check (user_id=(select auth.uid()) and status='pending');
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select,insert on public.account_deletion_requests to authenticated;
grant all on public.account_deletion_requests to service_role;

comment on table public.client_care_preferences is
  'Preferências de atendimento individuais: estilo, bebida, avisos in-app e consentimento para futuras novidades. Marketing opt-in não ativa envios automaticamente.';
comment on table public.account_deletion_requests is
  'Solicitações de exclusão para revisão pela administração. Inserção não remove auth.users automaticamente.';

commit;
