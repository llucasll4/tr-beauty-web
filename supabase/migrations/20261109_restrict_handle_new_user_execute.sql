-- handle_new_user is a trigger-only function, not a public RPC endpoint.
begin;
revoke all on function public.handle_new_user() from public,anon,authenticated;
commit;
