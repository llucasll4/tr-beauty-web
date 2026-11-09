-- Only customer accounts are subject to mandatory Brazilian mobile validation.
begin;
create or replace function private.enforce_profile_mobile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_normalized text;
begin
  -- Admin accounts retain their existing optional contact number rules.
  if new.role <> 'client' then
    return new;
  end if;
  if new.phone is null or trim(new.phone)='' then
    if tg_op='UPDATE' and new.role='client'
      and private.normalize_brazil_mobile(old.phone) is not null then
      raise exception 'O celular é obrigatório. Informe um número válido com DDD.'
        using errcode='22023';
    end if;
    new.phone:=null;
    return new;
  end if;

  v_normalized := private.normalize_brazil_mobile(new.phone);
  if v_normalized is null then
    raise exception 'Celular inválido. Use DDD e número de 9 dígitos começando com 9.'
      using errcode='22023';
  end if;
  new.phone:=v_normalized;
  return new;
end;
$function$;


commit;
