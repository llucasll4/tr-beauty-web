-- Fase 1 / Segurança: funções de gatilho são internas, não endpoints RPC.
-- Não altera o corpo das funções, gatilhos ou permissões de reservas/clientes.
-- Funções RETORNS trigger não precisam de EXECUTE público para disparar.
begin;

revoke all on function public.calendar_blocks_appointment_guard()
  from public, anon, authenticated;
revoke all on function public.calendar_blocks_reservation_guard()
  from public, anon, authenticated;
revoke all on function public.refund_cancelled_points_booking()
  from public, anon, authenticated;
revoke all on function public.protect_cancelled_points_booking()
  from public, anon, authenticated;

-- Só concluímos a migração quando as quatro funções ficam inacessíveis
-- diretamente a usuários de app ou visitantes.
do $verify$
declare v_name text;
begin
  foreach v_name in array array[
    'calendar_blocks_appointment_guard',
    'calendar_blocks_reservation_guard',
    'refund_cancelled_points_booking',
    'protect_cancelled_points_booking'
  ] loop
    if has_function_privilege('anon',format('public.%I()',v_name),'execute')
       or has_function_privilege('authenticated',format('public.%I()',v_name),'execute') then
      raise exception 'Permissão pública ainda ativa em %',v_name;
    end if;
  end loop;
end;
$verify$;

commit;
