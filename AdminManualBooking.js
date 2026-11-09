import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C={ink:'#2C2C2C',mocha:'#7A655B',muted:'#756B65',white:'#FFFFFF',border:'#E7DDD6',soft:'#F2ECE6',green:'#25714C',red:'#AF3441'};
const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
const timeFormat=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false});
const fullFormat=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'full',timeStyle:'short'});
const brl=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function dateKey(date){
  const p=Object.fromEntries(dateFormat.formatToParts(date).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function labelDate(value){
  const d=new Date(value+'T12:00:00Z');
  return d.toLocaleDateString('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short',weekday:'short'});
}
export default function AdminManualBooking({services=[],onShowAgenda=()=>{}}){
  const [clients,setClients]=useState([]);
  const [search,setSearch]=useState('');
  const [clientQuery,setClientQuery]=useState('');
  const [selectedClient,setSelectedClient]=useState(null);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [clientsError,setClientsError]=useState('');
  const activeServices=useMemo(()=>services.filter(s=>s.active),[services]);
  const [serviceId,setServiceId]=useState(null);
  const [day,setDay]=useState(()=>dateKey(new Date()));
  const [slots,setSlots]=useState([]);
  const [slot,setSlot]=useState(null);
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [slotsError,setSlotsError]=useState('');
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [done,setDone]=useState(null);
  const quickDays=useMemo(()=>{
    const base=new Date(dateKey(new Date())+'T12:00:00Z');
    return Array.from({length:14},(_,i)=>{
      const date=new Date(base.getTime()+i*86400000);
      return date.toISOString().slice(0,10);
    });
  },[]);
  const selectedService=activeServices.find(s=>s.id===serviceId);
  useEffect(()=>{
    if(!activeServices.some(s=>s.id===serviceId))setServiceId(activeServices[0]?.id||null);
  },[activeServices,serviceId]);

  const loadClients=useCallback(async()=>{
    setClientsLoading(true);setClientsError('');
    try{
      // Pesquisa feita no servidor e somente entre perfis de clientes.
      let query=supabase.from('profiles')
        .select('id,full_name,phone,role')
        .eq('role','client')
        .order('full_name',{ascending:true})
        .limit(75);
      if(clientQuery.trim()){
        // Caracteres especiais da busca são usados como texto, não como sintaxe de filtro.
        const escaped=clientQuery.trim().replace(/[\\%_]/g,'\\$&');
        query=query.ilike('full_name','%'+escaped+'%');
      }
      const {data,error}=await query;
      if(error)throw error;
      setClients(data||[]);
    }catch(err){setClientsError('Não foi possível carregar clientes: '+(err?.message||'erro desconhecido'));}
    finally{setClientsLoading(false);}
  },[clientQuery]);
  useEffect(()=>{loadClients();},[loadClients]);

  useEffect(()=>{
    let active=true;
    setSlot(null);setSlots([]);setSlotsError('');
    if(!serviceId||!validDate(day))return()=>{active=false;};
    setSlotsLoading(true);
    supabase.rpc('available_slots',{p_service_id:serviceId,p_date:day})
      .then(({data,error})=>{
        if(!active)return;
        if(error)throw error;
        setSlots(data||[]);
      })
      .catch(err=>{if(active)setSlotsError('Não foi possível carregar horários: '+(err?.message||'erro desconhecido'));})
      .finally(()=>{if(active)setSlotsLoading(false);});
    return()=>{active=false;};
  },[serviceId,day,done]);

  async function save(){
    if(saving||!selectedClient||!selectedService||!slot||slotsLoading)return;
    setSaving(true);setSaveError('');
    try{
      const {data,error}=await supabase.rpc('admin_book_client_appointment',{
        p_client_id:selectedClient.id,
        p_service_id:selectedService.id,
        p_starts_at:slot,
        p_notes:notes.trim()||null,
      });
      if(error)throw error;
      if(!data)throw new Error('A reserva não foi confirmada pelo servidor.');
      setDone({name:selectedClient.full_name||'Cliente',service:selectedService.name,starts_at:slot});
      setSlot(null);
      setNotes('');
    }catch(err){
      setSaveError('Não foi possível agendar: '+(err?.message||'erro desconhecido'));
    }finally{setSaving(false);}
  }

  return <View style={s.root}>
    <View style={s.heading}>
      <Ionicons name="calendar-outline" size={24} color={C.mocha}/>
      <View style={{flex:1}}>
        <Text style={s.title}>Agendamento manual</Text>
        <Text style={s.subtitle}>Reserve um horário em nome de uma cliente cadastrada</Text>
      </View>
    </View>
    {!!done&&<View style={s.success}>
      <Ionicons name="checkmark-circle-outline" size={25} color={C.green}/>
      <View style={{flex:1}}>
        <Text style={{fontWeight:'700',color:C.green}}>Atendimento confirmado na agenda!</Text>
        <Text style={s.successDetail}>{done.name} · {done.service}</Text>
        <Text style={s.successDetail}>{fullFormat.format(new Date(done.starts_at))} (Brasília)</Text>
        <Text style={s.successDetail}>Se a cliente habilitou notificações, receberá o aviso de confirmação.</Text>
        <View style={s.actionRow}>
          <TouchableOpacity onPress={onShowAgenda} style={s.outlineButton}><Text style={s.outlineText}>Ver agenda</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setDone(null)} style={s.outlineButton}><Text style={s.outlineText}>Agendar outro</Text></TouchableOpacity>
        </View>
      </View>
    </View>}
    {!done&&<>
      <Text style={s.step}>1. Selecione a cliente</Text>
      {selectedClient&&<View style={s.selected}>
        <Ionicons name="person-circle-outline" color={C.mocha} size={23}/>
        <View style={{flex:1}}>
          <Text style={s.clientName}>{selectedClient.full_name||'Cliente sem nome'}</Text>
          <Text style={s.helper}>{selectedClient.phone||'Sem telefone'}</Text>
        </View>
        <TouchableOpacity onPress={()=>setSelectedClient(null)} accessibilityRole="button" accessibilityLabel="Trocar cliente">
          <Text style={s.link}>Trocar</Text>
        </TouchableOpacity>
      </View>}
      {!selectedClient&&<>
        <View style={s.searchRow}>
          <TextInput style={s.searchInput} placeholder="Buscar cliente pelo nome" value={search}
            onChangeText={setSearch} onSubmitEditing={()=>setClientQuery(search)} returnKeyType="search"
            accessibilityLabel="Buscar clientes cadastradas"/>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pesquisar cliente" onPress={()=>setClientQuery(search)} style={s.searchBtn}>
            <Ionicons name="search" size={20} color="#fff"/>
          </TouchableOpacity>
        </View>
        {!!clientsError&&<Text style={s.error}>{clientsError}</Text>}
        {clientsLoading&&<ActivityIndicator color={C.mocha} style={{marginVertical:20}}/>}
        {!clientsLoading&&!clientsError&&<View style={s.clientList}>
          {!clients.length?<Text style={s.helper}>Nenhuma cliente encontrada. Cadastre uma conta de cliente antes de agendar.</Text>:
            clients.map(c=><TouchableOpacity key={c.id} style={s.clientOption} accessibilityRole="button"
              onPress={()=>setSelectedClient(c)}>
              <View style={{flex:1}}>
                <Text style={s.clientName}>{c.full_name||'Cliente sem nome'}</Text>
                <Text style={s.helper}>{c.phone||'Sem telefone cadastrado'}</Text>
              </View>
              <Ionicons name="chevron-forward" color={C.mocha} size={17}/>
            </TouchableOpacity>)}
          {clients.length===75&&<Text style={s.helper}>Exibindo até 75 clientes. Use a busca por nome para encontrar outras.</Text>}
        </View>}
      </>}

      <Text style={s.step}>2. Escolha o serviço</Text>
      {activeServices.map(service=><TouchableOpacity key={service.id} style={[s.option,serviceId===service.id&&s.optionSelected]}
        onPress={()=>setServiceId(service.id)} accessibilityRole="button" accessibilityState={{selected:serviceId===service.id}}>
        <View style={{flex:1}}>
          <Text style={s.clientName}>{service.name.trim()}</Text>
          <Text style={s.helper}>{service.duration_minutes} minutos · {brl(service.price)}</Text>
        </View>
        <Ionicons name={serviceId===service.id?'radio-button-on':'radio-button-off'} size={22} color={C.mocha}/>
      </TouchableOpacity>)}
      {!activeServices.length&&<Text style={s.helper}>Não existem serviços ativos para agendar.</Text>}

      <Text style={s.step}>3. Escolha a data (horário de Brasília)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}
        contentContainerStyle={{gap:8,paddingVertical:4}}>
        {quickDays.map(d=><TouchableOpacity key={d} accessibilityRole="button"
          onPress={()=>setDay(d)} style={[s.dayChip,day===d&&s.dayChipActive]}>
          <Text style={[s.dayText,day===d&&s.dayTextActive]}>{labelDate(d)}</Text>
        </TouchableOpacity>)}
      </ScrollView>
      <Text style={s.helper}>Outra data (até 90 dias): digite no formato AAAA-MM-DD</Text>
      <TextInput value={day} onChangeText={setDay} accessibilityLabel="Data do agendamento"
        placeholder="AAAA-MM-DD" maxLength={10} autoCapitalize="none"
        keyboardType="numbers-and-punctuation" style={s.dateInput}/>
      {!validDate(day)&&<Text style={s.error}>Informe uma data válida no formato AAAA-MM-DD.</Text>}

      <Text style={s.step}>4. Selecione o horário</Text>
      {slotsLoading&&<ActivityIndicator color={C.mocha} style={{marginVertical:16}}/>}
      {!!slotsError&&<Text style={s.error}>{slotsError}</Text>}
      {!slotsLoading&&!slotsError&&validDate(day)&&slots.length===0&&
        <Text style={s.helper}>Não há horários disponíveis nesta data. Selecione outro dia.</Text>}
      <View style={s.slots}>
        {slots.map(x=><TouchableOpacity key={x.starts_at} onPress={()=>setSlot(x.starts_at)}
          style={[s.timeChip,slot===x.starts_at&&s.timeChipActive]} accessibilityRole="button"
          accessibilityState={{selected:slot===x.starts_at}}>
          <Text style={[s.timeText,slot===x.starts_at&&s.timeTextActive]}>{timeFormat.format(new Date(x.starts_at))}</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={s.helper}>Horários calculados conforme os atendimentos existentes, com 15 min de preparação após cada serviço.</Text>
      <Text style={s.step}>5. Observações (opcional)</Text>
      <TextInput value={notes} onChangeText={setNotes} multiline maxLength={400}
        placeholder="Informações úteis para a agenda"
        accessibilityLabel="Observações sobre o agendamento" style={s.notes}/>
      <Text style={s.helper}>A reserva será criada como Confirmada, com o preço atual do serviço. Não haverá desconto de TR Points.</Text>
      {!!saveError&&<Text style={s.error}>{saveError}</Text>}
      <TouchableOpacity accessibilityRole="button" onPress={save}
        disabled={saving||!selectedClient||!serviceId||!slot||slotsLoading||!!slotsError}
        style={[s.confirm,(saving||!selectedClient||!serviceId||!slot||slotsLoading||!!slotsError)&&{opacity:.45}]}>
        {saving?<ActivityIndicator color="#fff"/>:<Text style={s.confirmText}>Confirmar agendamento para cliente</Text>}
      </TouchableOpacity>
    </>}
  </View>;
}
const s=StyleSheet.create({
  root:{gap:5,paddingBottom:25},
  heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:18},
  title:{fontSize:21,fontWeight:'700',color:C.ink},
  subtitle:{fontSize:12,color:C.muted,marginTop:4},
  step:{fontSize:16,fontWeight:'700',color:C.ink,marginTop:19,marginBottom:12},
  selected:{backgroundColor:C.soft,borderRadius:13,padding:15,flexDirection:'row',alignItems:'center',gap:12},
  searchRow:{flexDirection:'row',gap:8,marginBottom:8},
  searchInput:{backgroundColor:C.white,flex:1,minWidth:0,borderWidth:1,borderColor:C.border,padding:13,borderRadius:11,fontSize:14},
  searchBtn:{backgroundColor:C.ink,width:49,borderRadius:11,alignItems:'center',justifyContent:'center'},
  clientList:{backgroundColor:C.white,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:12},
  clientOption:{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomColor:C.border,borderBottomWidth:1,gap:8},
  clientName:{color:C.ink,fontWeight:'700',fontSize:14},
  helper:{fontSize:12,color:C.muted,lineHeight:19,marginTop:4},
  link:{fontSize:13,fontWeight:'700',color:C.mocha},
  option:{backgroundColor:C.white,flexDirection:'row',padding:15,marginBottom:8,borderRadius:12,borderWidth:1,borderColor:C.border,alignItems:'center',gap:9},
  optionSelected:{borderColor:C.mocha,borderWidth:2},
  dayChip:{borderRadius:10,paddingHorizontal:13,paddingVertical:12,backgroundColor:C.white,borderWidth:1,borderColor:C.border},
  dayChipActive:{backgroundColor:C.ink,borderColor:C.ink},
  dayText:{fontSize:12,color:C.mocha,fontWeight:'600'},
  dayTextActive:{color:'#fff'},
  dateInput:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:11,padding:13,color:C.ink,fontSize:14,marginTop:9},
  slots:{flexDirection:'row',flexWrap:'wrap',gap:9},
  timeChip:{padding:12,borderColor:C.border,borderWidth:1,borderRadius:10,backgroundColor:C.white},
  timeChipActive:{backgroundColor:C.ink,borderColor:C.ink},
  timeText:{fontSize:13,fontWeight:'700',color:C.mocha},
  timeTextActive:{color:'#fff'},
  notes:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:11,minHeight:86,padding:13,textAlignVertical:'top',fontSize:14},
  confirm:{backgroundColor:C.ink,borderRadius:12,padding:17,alignItems:'center',marginTop:19},
  confirmText:{fontWeight:'700',fontSize:15,color:'#fff',textAlign:'center'},
  error:{fontSize:12,color:C.red,lineHeight:18,marginVertical:6},
  success:{flexDirection:'row',backgroundColor:'#EAF7EF',borderRadius:14,padding:15,gap:11},
  successDetail:{fontSize:12,color:C.ink,marginTop:8,lineHeight:18},
  actionRow:{flexDirection:'row',gap:10,marginTop:15,flexWrap:'wrap'},
  outlineButton:{borderWidth:1,borderColor:C.green,borderRadius:10,paddingHorizontal:14,paddingVertical:12},
  outlineText:{fontWeight:'700',fontSize:13,color:C.green},
});
