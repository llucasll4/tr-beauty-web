-- Permite que uma cliente autenticada consulte os dados de serviços
-- que ela própria concluiu, mesmo que o serviço tenha sido desativado.
-- Visitantes seguem visualizando apenas os serviços ativos.
begin;
drop policy if exists "Customer historical completed services" on public.services;
create policy "Customer historical completed services"
  on public.services for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.service_id=services.id
        and a.client_id=(select auth.uid())
        and a.status='completed'
    )
  );
commit;