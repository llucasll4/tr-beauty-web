-- Fase 1: acompanhamento auditável dos pedidos LGPD.
-- "responded" significa RESPOSTA enviada ao titular, não exclusão concluída.
-- Não apaga auth.users, reservas, pontos ou dados sujeitos à retenção legal.
begin;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_status_check;
alter table public.account_deletion_requests
  add constraint account_deletion_status_check
  check (status in ('pending','in_review','responded','processed','rejected'));

alter table public.account_deletion_requests
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users(id),
  add column if not exists response_note text;
alter table public.account_deletion_requests
  add constraint account_deletion_response_note_limit
    check (length(coalesce(response_note,'')) <= 1000);

drop index if exists public.one_pending_deletion_request_per_user;
create unique index one_open_deletion_request_per_user
  on public.account_deletion_requests(user_id)
  where status in ('pending','in_review');

create policy "Admin may handle account deletion requests"
  on public.account_deletion_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Permissões de coluna: a administradora altera apenas status e mensagem.
-- Campos de auditoria são preenchidos automaticamente por gatilho.
grant update(status,response_note) on public.account_deletion_requests
  to authenticated;

create or replace function public.stamp_account_deletion_request_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $review$
begin
  if (select private.is_admin()) is distinct from true then
    raise exception 'Acesso restrito à administração' using errcode='42501';
  end if;
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    raise exception 'Não é permitido alterar o titular do pedido' using errcode='42501';
  end if;
  if old.status not in ('pending','in_review') then
    raise exception 'Pedido já finalizado' using errcode='22023';
  end if;
  if new.status not in ('in_review','responded','rejected') then
    raise exception 'Transição de status inválida' using errcode='22023';
  end if;
  if new.status in ('responded','rejected')
     and length(trim(coalesce(new.response_note,''))) < 15 then
    raise exception 'Registre a resposta fornecida à cliente (mínimo 15 caracteres)'
      using errcode='22023';
  end if;
  new.updated_at:=pg_catalog.now();
  new.handled_at:=pg_catalog.now();
  new.handled_by:=(select auth.uid());
  return new;
end;
$review$;
revoke all on function public.stamp_account_deletion_request_review()
  from public,anon,authenticated;

create trigger tr_stamp_account_deletion_review
before update of status,response_note on public.account_deletion_requests
for each row execute function public.stamp_account_deletion_request_review();

comment on table public.account_deletion_requests is
  'Solicitações LGPD com status, resposta e auditoria. responded não implica exclusão, que deve seguir procedimentos legais próprios.';
comment on column public.account_deletion_requests.response_note is
  'Mensagem enviada ao titular (visível para ele). Não registrar notas internas ou dados sensíveis neste campo.';

commit;
