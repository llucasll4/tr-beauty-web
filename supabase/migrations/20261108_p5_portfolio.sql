-- TR Beauty Concept — P5 Portfólio de trabalhos
-- Imagens públicas; somente administradoras podem criar, editar e apagar.
-- A galeria não contém dados de clientes; publique apenas imagens autorizadas.

begin;

create table if not exists public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  caption text check (caption is null or char_length(caption) <= 500),
  image_path text not null unique check (
    char_length(image_path) between 5 and 250
    and position('..' in image_path) = 0
  ),
  service_id uuid references public.services(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists p5_portfolio_order
  on public.portfolio_photos (sort_order, created_at desc);
create index if not exists p5_portfolio_service
  on public.portfolio_photos (service_id);

alter table public.portfolio_photos enable row level security;

revoke all on public.portfolio_photos from anon, authenticated;
grant select on public.portfolio_photos to anon, authenticated;
grant insert, update, delete on public.portfolio_photos to authenticated;

drop policy if exists "P5 portfolio visible to everyone" on public.portfolio_photos;
create policy "P5 portfolio visible to everyone"
  on public.portfolio_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "P5 admin creates portfolio" on public.portfolio_photos;
create policy "P5 admin creates portfolio"
  on public.portfolio_photos for insert
  to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "P5 admin edits portfolio" on public.portfolio_photos;
create policy "P5 admin edits portfolio"
  on public.portfolio_photos for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "P5 admin deletes portfolio" on public.portfolio_photos;
create policy "P5 admin deletes portfolio"
  on public.portfolio_photos for delete
  to authenticated
  using ((select private.is_admin()));

-- Arquivos públicos de até 5 MB (JPEG/PNG/WEBP).
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'portfolio', 'portfolio', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists "P5 anyone reads portfolio files" on storage.objects;
create policy "P5 anyone reads portfolio files"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "P5 admin uploads portfolio files" on storage.objects;
create policy "P5 admin uploads portfolio files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (select private.is_admin()));

drop policy if exists "P5 admin deletes portfolio files" on storage.objects;
create policy "P5 admin deletes portfolio files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (select private.is_admin()));

commit;
