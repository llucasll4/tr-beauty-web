import React,{useEffect,useState} from 'react';
import {StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={white:'#FFFFFF',ink:'#30231E',mocha:'#7A655B',muted:'#756B65',
  border:'#E6DDD5',soft:'#F5EFE8',gold:'#A97D48'};

export default function ClientCampaignCard({userId,onStartBooking}){
  const [campaign,setCampaign]=useState(null);

  useEffect(()=>{
    let alive=true;
    setCampaign(null);
    if(!userId)return()=>{alive=false;};
    (async()=>{
      try{
        // Prefer a fail-closed read, even though the database RLS enforces
        // current consent again on the campaigns query.
        const {data:preferences,error:prefError}=await supabase
          .from('client_care_preferences')
          .select('marketing_opt_in,marketing_consented_at')
          .eq('user_id',userId).maybeSingle();
        if(prefError)throw prefError;
        if(!preferences?.marketing_opt_in||!preferences?.marketing_consented_at){
          if(alive)setCampaign(null);
          return;
        }
        const {data:result,error:campaignError}=await supabase
          .from('marketing_campaigns')
          .select('id,title,body,cta,expires_at')
          .eq('status','published')
          .gt('expires_at',new Date().toISOString())
          .order('published_at',{ascending:false}).limit(1).maybeSingle();
        if(campaignError)throw campaignError;
        if(alive)setCampaign(result||null);
      }catch(_){
        // A missing campaign, consent, or a failed request are not permission
        // to display any marketing content. Never fall back to a cached promo.
        if(alive)setCampaign(null);
      }
    })();
    return()=>{alive=false;};
  },[userId]);

  if(!campaign)return null;
  return <View style={s.card}>
    <View style={s.heading}>
      <Ionicons name="heart-outline" size={22} color={C.gold}/>
      <Text style={s.eyebrow}>Novidades do estúdio</Text>
    </View>
    <Text style={s.title}>{campaign.title}</Text>
    <Text style={s.message}>{campaign.body}</Text>
    <Text style={s.note}>
      Você escolheu receber novidades por aqui. Para mudar essa preferência,
      acesse Perfil → Ajustes.
    </Text>
    {campaign.cta==='book'&&<TouchableOpacity accessibilityRole="button"
      accessibilityLabel="Ver serviços disponíveis da campanha"
      onPress={onStartBooking} style={s.action}>
      <Text style={s.actionText}>Ver serviços e horários</Text>
      <Ionicons name="arrow-forward-outline" size={18} color={C.white}/>
    </TouchableOpacity>}
  </View>;
}
const s=StyleSheet.create({
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:16,padding:16,marginBottom:18,gap:10},
  heading:{flexDirection:'row',alignItems:'center',gap:8},
  eyebrow:{fontSize:12,fontWeight:'700',color:C.gold},
  title:{fontSize:17,fontWeight:'800',color:C.ink},
  message:{fontSize:13,lineHeight:21,color:C.ink},
  note:{fontSize:11,color:C.muted,lineHeight:18},
  action:{backgroundColor:C.mocha,borderRadius:12,
    minHeight:44,alignItems:'center',justifyContent:'space-between',
    paddingHorizontal:15,flexDirection:'row'},
  actionText:{color:C.white,fontSize:13,fontWeight:'700'}
});
