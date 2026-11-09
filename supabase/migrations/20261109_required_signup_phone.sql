-- Require a Brazilian mobile number for new e-mail sign-ups.
-- Existing customer accounts and Google sign-in accounts remain accessible
-- through the one-time mandatory phone completion screen.
begin;

create or replace function private.normalize_brazil_mobile(p_phone text)
returns text
language plpgsql immutable
set search_path = ''
as $function$
declare
  v_digits text := pg_catalog.regexp_replace(
    pg_catalog.coalesce(p_phone,''), '[^0-9]', '', 'g');
  v_ddd text;
begin
  if char_length(v_digits)=11 then
    v_digits:='55'||v_digits;
  end if;
  if char_length(v_digits)<>13 or left(v_digits,2)<>'55' then
    return null;
  end if;
  v_ddd:=substr(v_digits,3,2);
  if v_ddd not in (
    '11','12','13','14','15','16','17','18','19',
    '21','22','24','27','28',
    '31','32','33','34','35','37','38',
    '41','42','43','44','45','46','47','48','49',
    '51','53','54','55',
    '61','62','63','64','65','66','67','68','69',
    '71','73','74','75','77','79',
    '81','82','83','84','85','86','87','88','89',
    '91','92','93','94','95','96','97','98','99'
  ) or substr(v_digits,5,1)<>'9'
    or substr(v_digits,6,8) !~ '^[0-9]{8}$' then
    return null;
  end if;
  return '+'||v_digits;
end;
$function$;

revoke all on function private.normalize_brazil_mobile(text)
  from public,anon,authenticated;

-- Validate all new phone values, including updates through the REST API.
-- Allow NULL on pre-existing accounts while they complete onboarding; once
-- a client has a valid mobile, it cannot be cleared.
create or replace function private.enforce_profile_mobile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_normalized text;
begin
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

revoke all on function private.enforce_profile_mobile()
  from public,anon,authenticated;
drop trigger if exists tr_enforce_profile_mobile on public.profiles;
create trigger tr_enforce_profile_mobile
before insert or update of phone on public.profiles
for each row execute function private.enforce_profile_mobile();

-- Existing auth.users trigger is the authoritative creator of public.profiles.
-- For new email sign-ups reject missing/invalid phones at the database level.
-- OAuth (Google) users have no phone metadata at creation: they must complete
-- the same required mobile step on first sign-in before using the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mobile text;
begin
  v_mobile := private.normalize_brazil_mobile(
    new.raw_user_meta_data->>'phone'
  );

  if new.raw_app_meta_data->>'provider'='email' and v_mobile is null then
    raise exception 'Informe um celular brasileiro válido com DDD para criar sua conta.'
      using errcode='22023';
  end if;

  insert into public.profiles(id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name',''),
    v_mobile,
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- Keep all currently registered accounts and their access unchanged.
comment on function private.normalize_brazil_mobile(text) is
  'Normalizes Brazilian mobile numbers to E.164 for account contact; format validation, not ownership verification.';
commit;