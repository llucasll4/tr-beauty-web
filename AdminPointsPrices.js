import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = { ink:'#2C2C2C', mocha:'#7A655B', muted:'#756B65', border:'#EAE2DB', white:'#FFFFFF' };
const points = value => Number(value||0).toLocaleString('pt-BR');

export default function AdminPointsPrices({services=[],onSaved=()=>{}}) {
  const [draft,setDraft]=useState({});
  const [saving,setSaving]=useState(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    setDraft(Object.fromEntries(services.map(s=>[s.id,String(s.redeem_points??'')])));
  },[services]);

  async function save(service){
    if(saving)return;
    const raw=String(draft[service.id]??'').trim();
    const value=Number(raw);
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<100){
      setError('Informe um número inteiro de pelo menos 100 pontos.');
      setMessage('');
      return;
    }
    setSaving(service.id);setError('');setMessage('');
    try {
      const {data,error:e}=await supabase.from('services').update({redeem_points:value})
        .eq('id',service.id).select('id,redeem_points').single();
      if(e)throw e;
      if(data?.redeem_points!==value)throw new Error('A alteração não foi confirmada.');
      await onSaved();
      setMessage('Pontos de '+service.name.trim()+' atualizados.');
    } catch(e){
      setError('Falha ao atualizar a tabela de resgates: '+(e?.message||'erro desconhecido'));
    } finally {setSaving(null);}
  }

  const sorted=[...services].sort((a,b)=>Number(a.price)-Number(b.price)||a.id.localeCompare(b.id));
  return <View style={s.wrap}>
    <View style={s.head}>
      <Ionicons name="diamond-outline" color={C.mocha} size={25}/>
      <View style={{flex:1}}>
        <Text style={s.title}>Tabela de resgates TR Points</Text>
        <Text style={s.note}>Defina exatamente quantos pontos cada serviço custa.</Text>
      </View>
    </View>
    <Text style={s.note}>Base inicial: serviço mais barato por 300 pontos, com acréscimo de 100 pontos conforme o preço. Você pode ajustar cada valor livremente (mínimo: 100).</Text>
    {!!message&&<Text style={s.success}>{message}</Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!sorted.length&&<Text style={s.note}>Nenhum serviço cadastrado.</Text>}
    {sorted.map((service,i)=><View key={service.id} style={s.item}>
      <Text style={s.service}>{service.name}</Text>
      <Text style={s.meta}>
        R$ {Number(service.price||0).toFixed(2).replace('.',',')} · {service.active?'Ativo':'Inativo'} · referência inicial: {points(300+100*i)} pts
      </Text>
      <View style={s.controls}>
        <TextInput value={draft[service.id]??''}
          onChangeText={value=>setDraft(prev=>({...prev,[service.id]:value}))}
          keyboardType="number-pad" placeholder="Pontos necessários"
          accessibilityLabel={'Custo em pontos para '+service.name}
          style={s.input} maxLength={9} editable={!saving}/>
        <TouchableOpacity accessibilityRole="button" disabled={!!saving}
          style={[s.button,!!saving&&{opacity:.5}]} onPress={()=>save(service)}>
          {saving===service.id?<ActivityIndicator color="#fff"/>:
            <Text style={s.buttonText}>Salvar</Text>}
        </TouchableOpacity>
      </View>
    </View>)}
  </View>;
}

const s=StyleSheet.create({
  wrap:{gap:13},
  head:{flexDirection:'row',gap:12,alignItems:'center'},
  title:{fontSize:19,color:C.ink,fontWeight:'700'},
  note:{fontSize:12,color:C.muted,lineHeight:19},
  item:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:13,padding:16},
  service:{fontWeight:'700',fontSize:15,color:C.ink},
  meta:{fontSize:12,color:C.muted,marginTop:7,marginBottom:13},
  controls:{flexDirection:'row',gap:11,alignItems:'center'},
  input:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:9,padding:12,fontSize:15,color:C.ink,minWidth:90},
  button:{backgroundColor:C.ink,paddingVertical:13,paddingHorizontal:21,borderRadius:9,alignItems:'center',justifyContent:'center'},
  buttonText:{color:'#fff',fontWeight:'700'},
  success:{color:'#247047',fontSize:13},
  error:{color:'#B42318',fontSize:13,lineHeight:19},
});
