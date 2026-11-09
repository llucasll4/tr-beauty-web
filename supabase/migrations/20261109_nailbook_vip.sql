-- TR Beauty Concept: Nail Book privado + TR Points VIP configurável.
begin;
create table if not exists public.nail_book_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  notes text not null default '' check (char_length(notes)<=800),
  photo_path text,
  kind text not null default 'inspiration' check (kind in ('inspiration','completed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint nail_book_photo_owner check (photo_path is null or split_part(photo_path,'/',1)=client_id::text)
);
create index if not exists nail_book_client_recent on public.nail_book_entries(client_id,created_at desc);
alter table public.nail_book_entries enable row level security;
revoke all on public.nail_book_entries from public,anon,authenticated;
grant select,insert,update,delete on public.nail_book_entries to authenticated;
create policy "Nail Book view owner or Admin" on public.nail_book_entries
  for select to authenticated using (client_id=(select auth.uid()) or (select private.is_admin()));
create policy "Nail Book insert own inspirations or Admin" on public.nail_book_entries
  for insert to authenticated with check (
    (client_id=(select auth.uid()) and kind='inspiration' and created_by=(select auth.uid()))
    or (select private.is_admin())
  );
create policy "Nail Book update own inspiration or Admin" on public.nail_book_entries
  for update to authenticated
  using ((client_id=(select auth.uid()) and kind='inspiration') or (select private.is_admin()))
  with check ((client_id=(select auth.uid()) and kind='inspiration') or (select private.is_admin()));
create policy "Nail Book delete own inspiration or Admin" on public.nail_book_entries
  for delete to authenticated using (
    (client_id=(select auth.uid()) and kind='inspiration') or (select private.is_admin())
  );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('nail-book','nail-book',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880,
allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Nail Book image read" on storage.objects for select to authenticated
  using (bucket_id='nail-book' and
    (split_part(name,'/',1)=(select auth.uid())::text or (select private.is_admin())));
create policy "Nail Book image upload" on storage.objects for insert to authenticated
  with check (bucket_id='nail-book' and
    (split_part(name,'/',1)=(select auth.uid())::text or (select private.is_admin())));
create policy "Nail Book image delete" on storage.objects for delete to authenticated
  using (bucket_id='nail-book' and
    (split_part(name,'/',1)=(select auth.uid())::text or (select private.is_admin())));

create table if not exists public.vip_settings (
  id smallint primary key default 1 check (id=1),
  silver_points integer not null default 500 check (silver_points>0),
  gold_points integer not null default 1500 check (gold_points>silver_points),
  birthday_bonus integer not null default 50 check (birthday_bonus between 0 and 10000),
  referral_bonus integer not null default 100 check (referral_bonus between 0 and 10000),
  frequency_bonus integer not null default 80 check (frequency_bonus between 0 and 10000),
  frequency_every integer not null default 5 check (frequency_every between 2 and 30),
  birthday_enabled boolean not null default false,
  referrals_enabled boolean not null default false,
  frequency_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.vip_settings(id) values(1) on conflict(id) do nothing;
alter table public.vip_settings enable row level security;
revoke all on public.vip_settings from public,anon,authenticated;
grant select on public.vip_settings to authenticated;
grant update (silver_points,gold_points,birthday_bonus,referral_bonus,
  frequency_bonus,frequency_every,birthday_enabled,referrals_enabled,frequency_enabled)
  on public.vip_settings to authenticated;
create policy "VIP settings visible to signed in customers" on public.vip_settings
  for select to authenticated using(true);
create policy "VIP settings only Admin edits" on public.vip_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create table if not exists public.customer_birthdays (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_day smallint not null check (birth_day between 1 and 31),
  registered_at timestamptz not null default now(),
  constraint birthday_valid_calendar_date check (
    extract(month from make_date(2000,birth_month,birth_day))=birth_month
  )
);
alter table public.customer_birthdays enable row level security;
revoke all on public.customer_birthdays from public,anon,authenticated;
grant select,insert,update,delete on public.customer_birthdays to authenticated;
create policy "Birthdate own or admin read" on public.customer_birthdays for select
  to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy "Birthdate customer can set once" on public.customer_birthdays for insert
  to authenticated with check(user_id=(select auth.uid()));
create policy "Birthdate corrections only Admin" on public.customer_birthdays for update
  to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy "Birthdate deletions only Admin" on public.customer_birthdays for delete
  to authenticated using((select private.is_admin()));

create table if not exists public.client_referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check(code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);
alter table public.client_referral_codes enable row level security;
revoke all on public.client_referral_codes from public,anon,authenticated;
grant select on public.client_referral_codes to authenticated;
create policy "Read own referral code" on public.client_referral_codes
  for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));

create table if not exists public.referral_claims (
  referred_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  rewarded_at timestamptz,
  reward_appointment_id uuid references public.appointments(id),
  constraint referral_not_self check(referred_id<>referrer_id)
);
alter table public.referral_claims enable row level security;
revoke all on public.referral_claims from public,anon,authenticated;
grant select on public.referral_claims to authenticated;
create policy "Referral own data" on public.referral_claims for select
  to authenticated using(referred_id=(select auth.uid()) or referrer_id=(select auth.uid()) or (select private.is_admin()));

create table if not exists public.vip_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  award_type text not null check(award_type in ('birthday','frequency','referral')),
  award_key text not null,
  points integer not null check(points>0),
  created_at timestamptz not null default now(),
  unique(user_id,award_type,award_key)
);
alter table public.vip_awards enable row level security;
revoke all on public.vip_awards from public,anon,authenticated;
grant select on public.vip_awards to authenticated;
create policy "VIP awards own or Admin" on public.vip_awards for select
  to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));

create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path=''
as $fn$
declare v_user uuid := (select auth.uid()); v_code text;
begin
 if v_user is null then raise exception 'Faça login' using errcode='42501'; end if;
 select code into v_code from public.client_referral_codes where user_id=v_user;
 if v_code is not null then return v_code;end if;
 perform 1 from public.profiles where id=v_user and role='client';
 if not found then raise exception 'Somente clientes recebem código de indicação'; end if;
 loop
   v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
   begin
     insert into public.client_referral_codes(user_id,code) values(v_user,v_code)
     on conflict (user_id) do nothing;
     exit;
   exception when unique_violation then null;
   end;
 end loop;
 return (select code from public.client_referral_codes where user_id=v_user);
end $fn$;
revoke all on function public.my_referral_code() from public,anon,authenticated;
grant execute on function public.my_referral_code() to authenticated;

create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer set search_path=''
as $fn$
declare
 v_user uuid:=(select auth.uid());
 v_referrer uuid;
 v_me_phone text;
 v_ref_phone text;
begin
 if v_user is null then raise exception 'Faça login' using errcode='42501';end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9]{8}$' then raise exception 'Código inválido';end if;
 perform 1 from public.profiles where id=v_user and role='client' for update;
 if not found then raise exception 'Conta de cliente não encontrada';end if;
 if exists(select 1 from public.referral_claims where referred_id=v_user) then raise exception 'Você já vinculou uma indicação';end if;
 if exists(select 1 from public.appointments where client_id=v_user and status='completed') then
   raise exception 'A indicação precisa ser vinculada antes do primeiro atendimento';end if;
 select user_id into v_referrer from public.client_referral_codes where code=upper(p_code);
 if v_referrer is null then raise exception 'Código de indicação não encontrado';end if;
 if v_referrer=v_user then raise exception 'Você não pode indicar a si mesma';end if;
 select regexp_replace(coalesce(phone,''),'\D','','g') into v_me_phone
 from public.profiles where id=v_user;
 select regexp_replace(coalesce(phone,''),'\D','','g') into v_ref_phone
 from public.profiles where id=v_referrer;
 if char_length(v_me_phone)<10 or char_length(v_ref_phone)<10 or v_me_phone=v_ref_phone then
   raise exception 'Para validar a indicação, ambas as contas precisam de telefones distintos e válidos';end if;
 insert into public.referral_claims(referred_id,referrer_id) values(v_user,v_referrer);
 return 'Indicação vinculada! O benefício poderá ser liberado após seu primeiro atendimento pago, se a campanha estiver ativa.';
end $fn$;
revoke all on function public.claim_referral(text) from public,anon,authenticated;
grant execute on function public.claim_referral(text) to authenticated;

create or replace function private.award_vip_on_completed()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 cfg public.vip_settings%rowtype;
 b record;
 claims record;
 paid_count integer;
 award_bucket integer;
 award_pts integer;
 award_type text;
 award_key text;
 receiver uuid;
begin
 if new.status<>'completed' or new.points_redeemed is not null or new.price_at_booking<=0
    or (tg_op='UPDATE' and old.status='completed') then return new;end if;
 select * into cfg from public.vip_settings where id=1;
 if cfg.id is null then return new;end if;

 -- Indicação: bonificar somente quem indicou, após o primeiro atendimento pago
 -- e com telefones diferentes, verificados novamente na conclusão.
 if cfg.referrals_enabled and cfg.referral_bonus>0 then
   select * into claims from public.referral_claims where referred_id=new.client_id for update;
   if found and claims.rewarded_at is null
     and (select count(*) from public.appointments
          where client_id=new.client_id and status='completed' and points_redeemed is null)=1
     and (select regexp_replace(coalesce(phone,''),'\D','','g') from public.profiles where id=new.client_id)
         <> (select regexp_replace(coalesce(phone,''),'\D','','g') from public.profiles where id=claims.referrer_id)
   then
      receiver:=claims.referrer_id;
      award_type:='referral';award_key:=new.client_id::text;award_pts:=cfg.referral_bonus;
      insert into public.vip_awards(user_id,appointment_id,award_type,award_key,points)
      values(receiver,new.id,award_type,award_key,award_pts)
      on conflict (user_id,award_type,award_key) do nothing;
      if found then
        insert into public.points_ledger(client_id,appointment_id,points,description,event_type)
        values(receiver,new.id,award_pts,'TR Points VIP: indicação concluída','adjustment');
      end if;
      update public.referral_claims set rewarded_at=now(),reward_appointment_id=new.id where referred_id=new.client_id;
   end if;
 end if;

 -- Aniversário: benefício no mês, se data foi registrada há pelo menos 30 dias.
 if cfg.birthday_enabled and cfg.birthday_bonus>0 then
   select * into b from public.customer_birthdays where user_id=new.client_id;
   if found and b.birth_month=extract(month from (new.starts_at at time zone 'America/Sao_Paulo'))
     and b.registered_at <= now()-interval '30 days' then
     award_type:='birthday';
     award_key:=extract(year from (new.starts_at at time zone 'America/Sao_Paulo'))::int::text;
     award_pts:=cfg.birthday_bonus;receiver:=new.client_id;
     insert into public.vip_awards(user_id,appointment_id,award_type,award_key,points)
     values(receiver,new.id,award_type,award_key,award_pts)
     on conflict (user_id,award_type,award_key) do nothing;
     if found then
       insert into public.points_ledger(client_id,appointment_id,points,description,event_type)
       values(receiver,new.id,award_pts,'TR Points VIP: aniversário','adjustment');
     end if;
   end if;
 end if;

 -- Frequência: a cada N atendimentos pagos concluídos (N configurável).
 if cfg.frequency_enabled and cfg.frequency_bonus>0 then
   select count(*) into paid_count from public.appointments
    where client_id=new.client_id and status='completed' and points_redeemed is null;
   if paid_count>0 and mod(paid_count,cfg.frequency_every)=0 then
     award_type:='frequency';award_key:=paid_count::text;award_pts:=cfg.frequency_bonus;
     receiver:=new.client_id;
     insert into public.vip_awards(user_id,appointment_id,award_type,award_key,points)
     values(receiver,new.id,award_type,award_key,award_pts)
     on conflict (user_id,award_type,award_key) do nothing;
     if found then
       insert into public.points_ledger(client_id,appointment_id,points,description,event_type)
       values(receiver,new.id,award_pts,'TR Points VIP: bônus por frequência','adjustment');
     end if;
   end if;
 end if;
 return new;
end $fn$;
revoke all on function private.award_vip_on_completed() from public,anon,authenticated;
drop trigger if exists tr_award_vip_on_completed on public.appointments;
create trigger tr_award_vip_on_completed
 after update of status on public.appointments
 for each row execute function private.award_vip_on_completed();

comment on table public.nail_book_entries is 'Álbum privado de unhas e referências por cliente. Apenas a Admin adiciona registros concluídos.';
comment on table public.vip_settings is 'Configuração dos níveis VIP e bônus, desligados por padrão até aprovação do estúdio.';
commit;