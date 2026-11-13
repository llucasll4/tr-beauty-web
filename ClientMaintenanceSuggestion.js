import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={
  white:'#FFFFFF',ink:'#30231E',mocha:'#665043',muted:'#756B65',
  nude:'#EBE3D9',border:'#E0D8CF',gold:'#A97D48',
};
const DAY=86400000;
const dateLabel=new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'long',year:'numeric',
});
const getService=related=>Array.isArray(related)?related[0]:related;

export function chooseMaintenanceSuggestion(completed=[],upcoming=[],now=Date.now()){
  const booked=new Set(upcoming.map(item=>item.service_id).filter(Boolean));
  const seen=new Set();
  // Completed bookings are requested in descending order. Only consider
  // the latest completed visit for each service; never resurrect older prompts.
  for(const row of completed){
    if(!row?.service_id||seen.has(row.service_id))continue;
    seen.add(row.service_id);
    const service=getService(row.services);
    const interval=service?.maintenance_interval_days;
    const days=Number(interval);
    if(service?.active!==true||!Number.isInteger(days)||days<14||days>90
       ||booked.has(row.service_id))continue;
    const completedAt=new Date(row.ends_at).getTime();
    if(!Number.isFinite(completedAt)||completedAt>now)continue;
    const due=completedAt+days*DAY;
    // Show a timely reminder for one week before the suggested day,
    // until 30 days after. No perpetual or premature engagement nudges.
    if(now<due-7*DAY||now>due+30*DAY)continue;
    return {serviceName:service.name||'seu último atendimento',due};
  }
  return null;
}

export default function ClientMaintenanceSuggestion({userId,refreshSignal=0,onStartBooking}){
  const [suggestion,setSuggestion]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!userId){setSuggestion(null);setLoading(false);return;}
    let alive=true;
    async function load(){
      try{
        const now=new Date();
        const [history,bookings]=await Promise.all([
          supabase.from('appointments')
            .select('service_id,ends_at,services(name,active,maintenance_interval_days)')
            .eq('client_id',userId).eq('status','completed')
            .lte('ends_at',now.toISOString())
            .order('ends_at',{ascending:false}).limit(35),
          supabase.from('appointments').select('service_id')
            .eq('client_id',userId).in('status',['pending','confirmed'])
            .gte('starts_at',now.toISOString()),
        ]);
        if(history.error)throw history.error;
        if(bookings.error)throw bookings.error;
        const picked=chooseMaintenanceSuggestion(history.data||[],bookings.data||[],now.getTime());
        if(alive)setSuggestion(picked);
      }catch(_){
        // Suggestions are optional: don't mistake a failed read for a due visit.
        if(alive)setSuggestion(null);
      }finally{if(alive)setLoading(false);}
    }
    setLoading(true);load();
    // A booking completed by Admin may update while the client is on Home.
    const channel=supabase.channel('home-maintenance-'+userId)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'appointments',
        filter:'client_id=eq.'+userId,
      },()=>load()).subscribe();
    return()=>{alive=false;supabase.removeChannel(channel);};
  },[userId,refreshSignal]);

  if(!userId||!suggestion)return null;
  return <View style={s.card}>
    <View style={s.heading}>
      <View style={s.iconBox}>
        <Ionicons name="sparkles-outline" size={22} color={C.gold}/>
      </View>
      <View style={{flex:1,minWidth:0}}>
        <Text style={s.title}>Que tal cuidar das unhas novamente?</Text>
        <Text style={s.subtitle}>Sugestão de manutenção do estúdio</Text>
      </View>
    </View>
    <Text style={s.body}>
      Depois de {suggestion.serviceName}, o estúdio sugere considerar um
      retorno por volta de <Text style={s.bold}>{dateLabel.format(new Date(suggestion.due))}</Text>.
    </Text>
    <Text style={s.note}>É apenas uma sugestão, baseada no intervalo definido
      pelo estúdio. A escolha do serviço, do horário e da reserva é sua.</Text>
    <TouchableOpacity accessibilityRole="button"
      accessibilityLabel="Escolher serviço e horário de manutenção"
      style={s.button} onPress={onStartBooking}>
      <Text style={s.buttonText}>Ver serviços e horários</Text>
      <Ionicons name="arrow-forward-outline" color={C.white} size={18}/>
    </TouchableOpacity>
  </View>;
}
const s=StyleSheet.create({
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:17,
    padding:17,marginBottom:18,gap:11},
  heading:{flexDirection:'row',alignItems:'center',gap:11},
  iconBox:{width:44,height:44,backgroundColor:C.nude,borderRadius:13,
    justifyContent:'center',alignItems:'center'},
  title:{fontSize:15,color:C.ink,fontWeight:'700'},
  subtitle:{fontSize:12,color:C.mocha,marginTop:3},
  body:{fontSize:13,lineHeight:21,color:C.ink},
  bold:{fontWeight:'700'},
  note:{fontSize:11,lineHeight:18,color:C.muted},
  button:{backgroundColor:C.mocha,borderRadius:12,minHeight:44,
    paddingHorizontal:15,paddingVertical:11,flexDirection:'row',
    alignItems:'center',justifyContent:'space-between',gap:12},
  buttonText:{fontSize:13,fontWeight:'700',color:C.white}
});
