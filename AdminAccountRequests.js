import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C={ink:'#30231E',mocha:'#7A655B',muted:'#756B65',
  white:'#FFFFFF',brown:'#402816',border:'#E8DED4',red:'#AA4A4C',soft:'#F5EFE8'};
const dateLabel=date=>new Date(date).toLocaleDateString('pt-BR',{
  day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo',
});
function whatsAppNumber(phone){
  const numbers=String(phone||'').replace(/\D/g,'');
  if(numbers.startsWith('55')&&numbers.length>=12&&numbers.length<=13)return numbers;
  return(numbers.length===10||numbers.length===11)?'55'+numbers:null;
}
export default function AdminAccountRequests({onBack=()=>{}}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const {data,error:requestError}=await supabase.from('account_deletion_requests')
        .select('id,user_id,created_at,status')
        .eq('status','pending').order('created_at',{ascending:false}).limit(100);
      if(requestError)throw requestError;
      const rows=data||[];
      if(!rows.length){setItems([]);return;}
      const ids=[...new Set(rows.map(r=>r.user_id))];
      const {data:people,error:profileError}=await supabase.from('profiles')
        .select('id,full_name,phone').in('id',ids);
      if(profileError)throw profileError;
      const profileMap=new Map((people||[]).map(p=>[p.id,p]));
      setItems(rows.map(row=>({...row,person:profileMap.get(row.user_id)||null})));
    }catch(e){setError('Não foi possível consultar solicitações: '+(e?.message||'erro desconhecido'));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function contact(phone){
    const destination=whatsAppNumber(phone);
    if(!destination)return;
    const text=encodeURIComponent('Olá! Recebemos sua solicitação de exclusão de conta do TR Beauty Concept e gostaríamos de confirmar alguns detalhes.');
    try{await Linking.openURL('https://wa.me/'+destination+'?text='+text);}
    catch(e){setError('Não foi possível abrir o WhatsApp.');}
  }
  return <View style={s.wrap}>
    <TouchableOpacity onPress={onBack} accessibilityRole="button" style={s.back}>
      <Ionicons name="arrow-back-outline" size={19} color={C.mocha}/>
      <Text style={s.link}>Voltar às configurações</Text>
    </TouchableOpacity>
    <Text style={s.title}>Solicitações de exclusão</Text>
    <Text style={s.help}>
      Pedidos enviados pelas clientes. A exclusão não é automática:
      confira a identidade e processe os pedidos pela administração do Supabase
      conforme os procedimentos do estúdio. Esta lista não apaga contas.
    </Text>
    <TouchableOpacity onPress={load} accessibilityRole="button" style={s.refresh}>
      <Ionicons name="refresh-outline" size={18} color={C.mocha}/>
      <Text style={s.link}>Atualizar solicitações</Text>
    </TouchableOpacity>
    {loading&&<ActivityIndicator color={C.mocha} style={{marginVertical:18}}/>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!loading&&!error&&!items.length&&
      <Text style={s.empty}>Nenhuma solicitação de exclusão pendente.</Text>}
    {items.map(item=><View key={item.id} style={s.card}>
      <View style={s.top}>
        <Ionicons name="trash-outline" size={22} color={C.red}/>
        <Text style={s.name}>{item.person?.full_name||'Cliente'}</Text>
      </View>
      <Text style={s.small}>Solicitado em {dateLabel(item.created_at)}</Text>
      <Text style={s.small}>Status: aguardando análise</Text>
      {!!whatsAppNumber(item.person?.phone)&&
        <TouchableOpacity style={s.action} onPress={()=>contact(item.person.phone)}
          accessibilityRole="button">
          <Ionicons name="logo-whatsapp" size={18} color={C.white}/>
          <Text style={s.actionText}>Contatar cliente</Text>
        </TouchableOpacity>}
    </View>)}
  </View>;
}
const s=StyleSheet.create({
  wrap:{paddingBottom:25},
  back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:14},
  link:{color:C.mocha,fontSize:13,fontWeight:'700'},
  title:{color:C.ink,fontSize:21,fontWeight:'800',marginBottom:11},
  help:{color:C.muted,fontSize:12,lineHeight:19,marginBottom:16},
  refresh:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:13},
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:14,padding:17,marginBottom:11},
  top:{flexDirection:'row',gap:10,alignItems:'center'},
  name:{color:C.ink,fontWeight:'700',fontSize:15,flex:1},
  small:{color:C.muted,fontSize:12,marginTop:9},
  action:{marginTop:14,backgroundColor:C.brown,padding:12,borderRadius:10,
    alignSelf:'flex-start',alignItems:'center',flexDirection:'row',gap:9},
  actionText:{color:C.white,fontWeight:'700',fontSize:12},
  error:{color:C.red,fontSize:13,marginVertical:12},
  empty:{color:C.muted,fontSize:13,backgroundColor:C.white,padding:16,borderRadius:12},
});
