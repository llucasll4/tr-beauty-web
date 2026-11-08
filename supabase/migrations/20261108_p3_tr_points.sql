-- TR Beauty Concept — P3 TR Points
-- Execute em Supabase > SQL Editor após revisar a regra comercial.
-- Regra inicial: 1 ponto por R$ 1 inteiro; meta visual de 300 pontos.
-- Atingir a meta NÃO faz resgate, desconto ou prêmio automaticamente.
-- Não credita agendamentos já concluídos antes desta migração.

begin;

create table if not exists public.loyalty_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  points_per_real integer not null default 1 check (points_per_real between 1 and 100),
  goal_points integer not null default 300 check (goal_points > 0)
);
insert into public.loyalty_settings (id, enabled, points_per_real, goal_points)
values (1, true, 1, 300)
on conflict (id) do nothing;

alter table public.loyalty_settings enable row level security;
revoke all on public.loyalty_settings from anon, authenticated;
grant select on public.loyalty_settings to authenticated;
drop policy if exists "Signed-in users read loyalty settings" on public.loyalty_settings;
create policy "Signed-in users read loyalty settings"
on public.loyalty_settings for select to authenticated
using ((select auth.uid()) is not null);

alter table public.points_ledger
  add column if not exists event_type text not null default 'adjustment';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.points_ledger'::regclass
      and conname = 'points_ledger_event_type_check'
  ) then
    alter table public.points_ledger
      add constraint points_ledger_event_type_check
      check (event_type in ('earned', 'adjustment', 'redeemed', 'reversal'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.points_ledger'::regclass
      and conname = 'points_earned_requires_appointment'
  ) then
    alter table public.points_ledger
      add constraint points_earned_requires_appointment
      check (event_type <> 'earned' or appointment_id is not null);
  end if;
end $$;

create unique index if not exists points_earned_once_per_appointment
on public.points_ledger (appointment_id)
where event_type = 'earned';

-- Gravação somente pelo trigger; consulta segue as políticas RLS existentes.
revoke insert, update, delete on public.points_ledger from anon, authenticated;

create or replace function public.credit_points_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate integer;
  v_points integer;
begin
  if new.status <> 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'completed' then
      return new;
    end if;
  end if;

  select points_per_real into v_rate
  from public.loyalty_settings
  where id = 1 and enabled = true;
  if not found then
    return new;
  end if;

  v_points := floor(new.price_at_booking * v_rate)::integer;
  if v_points > 0 then
    insert into public.points_ledger (
      client_id, appointment_id, points, description, event_type
    ) values (
      new.client_id, new.id, v_points, 'Atendimento concluído', 'earned'
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.credit_points_after_completion() from public, anon, authenticated;
drop trigger if exists tr_credit_points_after_completion on public.appointments;
create trigger tr_credit_points_after_completion
  after insert or update of status on public.appointments
  for each row
  execute function public.credit_points_after_completion();

-- Saldo próprio com RLS: security invoker.
create or replace function public.get_my_loyalty()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_client uuid := auth.uid();
  v_balance bigint;
  v_goal integer;
  v_rate integer;
  v_enabled boolean;
  v_history jsonb;
begin
  if v_client is null then
    raise exception 'Faça login para consultar TR Points' using errcode = '42501';
  end if;

  select enabled, goal_points, points_per_real
  into v_enabled, v_goal, v_rate
  from public.loyalty_settings
  where id = 1;

  select coalesce(sum(points), 0)::bigint into v_balance
  from public.points_ledger
  where client_id = v_client;

  select coalesce(jsonb_agg(jsonb_build_object(
    'points', recent.points,
    'description', recent.description,
    'event_type', recent.event_type,
    'created_at', recent.created_at
  ) order by recent.created_at desc), '[]'::jsonb)
  into v_history
  from (
    select points, description, event_type, created_at
    from public.points_ledger
    where client_id = v_client
    order by created_at desc
    limit 5
  ) recent;

  return jsonb_build_object(
    'balance', greatest(v_balance, 0),
    'goal_points', coalesce(v_goal, 300),
    'points_per_real', coalesce(v_rate, 1),
    'enabled', coalesce(v_enabled, false),
    'recent_history', v_history
  );
end;
$$;
revoke all on function public.get_my_loyalty() from public, anon;
grant execute on function public.get_my_loyalty() to authenticated;

-- Saldo por cliente exclusivo da administradora.
create or replace function public.admin_client_loyalty(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Acesso restrito à administração' using errcode = '42501';
  end if;
  select coalesce(sum(points), 0)::bigint into v_balance
  from public.points_ledger
  where client_id = p_client_id;
  return jsonb_build_object('balance', greatest(v_balance, 0));
end;
$$;
revoke all on function public.admin_client_loyalty(uuid) from public, anon;
grant execute on function public.admin_client_loyalty(uuid) to authenticated;

commit;