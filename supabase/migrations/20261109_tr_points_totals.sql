-- Resumo completo do extrato TR Points da cliente autenticada.
-- A RPC usa SECURITY INVOKER, preservando a política RLS de points_ledger.
begin;
create or replace function public.get_my_points_totals()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'total_earned', coalesce(sum(greatest(l.points, 0)),0),
    'total_spent', coalesce(sum(greatest(-l.points, 0)),0),
    'net_points', coalesce(sum(l.points),0),
    'movements', count(*),
    'service_movements', count(*) filter (where l.appointment_id is not null)
  )
  from public.points_ledger l
  where l.client_id=(select auth.uid())
$$;
revoke all on function public.get_my_points_totals() from public,anon,authenticated;
grant execute on function public.get_my_points_totals() to authenticated;
comment on function public.get_my_points_totals() is 'Soma ganhos e débitos de pontos apenas da pessoa autenticada, respeitando RLS.';
commit;