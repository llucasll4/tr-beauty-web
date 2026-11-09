-- Avoid PL/pgSQL local-name ambiguity in VIP award conflicts.
begin;
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
      on conflict on constraint vip_awards_user_id_award_type_award_key_key do nothing;
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
     on conflict on constraint vip_awards_user_id_award_type_award_key_key do nothing;
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
     on conflict on constraint vip_awards_user_id_award_type_award_key_key do nothing;
     if found then
       insert into public.points_ledger(client_id,appointment_id,points,description,event_type)
       values(receiver,new.id,award_pts,'TR Points VIP: bônus por frequência','adjustment');
     end if;
   end if;
 end if;
 return new;
end $fn$;

commit;