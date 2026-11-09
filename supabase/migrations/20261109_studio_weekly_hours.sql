-- TR Beauty Concept — expediente oficial do estúdio.
-- Dias em public.business_hours.weekday seguem o padrão PostgreSQL:
-- 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado.
-- Preserva domingo e segunda como fechados. A RPC available_slots consulta
-- esta tabela dinamicamente e exige duração do serviço + buffer de 15 minutos.
begin;

update public.business_hours
set opens_at = case when weekday in (2,4) then '09:00'::time else '08:00'::time end,
    closes_at = case when weekday in (2,4) then '18:00'::time else '20:00'::time end,
    enabled = true
where weekday in (2,3,4,5,6);

do $verify$
begin
  if (select count(*) from public.business_hours
      where enabled = true
        and ((weekday in (2,4) and opens_at='09:00'::time and closes_at='18:00'::time)
          or (weekday in (3,5,6) and opens_at='08:00'::time and closes_at='20:00'::time))
     ) <> 5 then
    raise exception 'Horários do estúdio incompletos ou inesperados';
  end if;
  if exists (select 1 from public.business_hours
      where weekday in (0,1) and enabled = true) then
    raise exception 'Domingo e segunda devem permanecer fechados';
  end if;
end;
$verify$;

commit;
