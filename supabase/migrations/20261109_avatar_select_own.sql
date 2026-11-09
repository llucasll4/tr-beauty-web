-- Permite substituir a própria foto de perfil usando upsert, que exige SELECT.
-- Não libera acesso aos objetos de outros usuários.
begin;
drop policy if exists "TR avatar select own for replacement" on storage.objects;
create policy "TR avatar select own for replacement"
on storage.objects for select to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;