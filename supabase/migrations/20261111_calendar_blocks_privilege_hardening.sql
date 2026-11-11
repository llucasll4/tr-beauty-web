-- Supabase default grants include TRUNCATE/TRIGGER on new public tables.
-- Remove all broad privileges before granting only the actions the UI needs.
begin;
revoke all on table public.calendar_blocks from authenticated;
grant select,insert,delete on table public.calendar_blocks to authenticated;
commit;