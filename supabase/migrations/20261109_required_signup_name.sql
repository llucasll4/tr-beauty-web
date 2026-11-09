-- Cadastro por e-mail: todos os dados obrigatórios, inclusive nome completo.
-- A validação de e-mail/senha continua no Supabase Auth.
-- A validação de celular continua em private.normalize_brazil_mobile.
begin;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mobile text;
  v_name text;
begin
  v_mobile := private.normalize_brazil_mobile(
    new.raw_user_meta_data->>'phone'
  );
  v_name := btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'name'),''),
    ''
  ));

  if new.raw_app_meta_data->>'provider'='email' then
    if char_length(v_name)<2 then
      raise exception 'Informe seu nome completo para criar a conta.'
        using errcode='22023';
    end if;
    if v_mobile is null then
      raise exception 'Informe um celular brasileiro válido com DDD para criar sua conta.'
        using errcode='22023';
    end if;
  end if;

  insert into public.profiles(id,full_name,phone,role)
  values (new.id,v_name,v_mobile,'client')
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public,anon,authenticated;
commit;