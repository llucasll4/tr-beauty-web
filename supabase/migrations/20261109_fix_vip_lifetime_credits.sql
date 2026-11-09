-- VIP level credits exclude refunds of previously spent points; prevents tier inflation on cancellations.
begin;
create or replace function public.get_my_vip_summary()
returns jsonb language sql stable security invoker set search_path=''
as $fn$
  select jsonb_build_object(
    'lifetime_points',coalesce((select sum(case when points>0 and event_type in ('earned','adjustment') then points else 0 end) from public.points_ledger where client_id=(select auth.uid())),0),
    'completed_paid',coalesce((select count(*) from public.appointments where client_id=(select auth.uid()) and status='completed' and points_redeemed is null),0),
    'successful_referrals',coalesce((select count(*) from public.referral_claims where referrer_id=(select auth.uid()) and rewarded_at is not null),0),
    'birthday_month',(select birth_month from public.customer_birthdays where user_id=(select auth.uid())),
    'birthday_day',(select birth_day from public.customer_birthdays where user_id=(select auth.uid()))
  )
$fn$;
revoke all on function public.get_my_vip_summary() from public,anon,authenticated;
grant execute on function public.get_my_vip_summary() to authenticated;


commit;