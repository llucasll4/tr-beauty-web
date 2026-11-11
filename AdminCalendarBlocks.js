import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  white:'#FFFFFF', ink:'#30231E', mocha:'#7A655B',
  muted:'#746B65', border:'#E6DCD3', soft:'#F3EBE4', bg:'#FAF9F5',
  green:'#287451', red:'#A63D40', brown:'#402816',
};
const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
});
const DISPLAY = new Intl.DateTimeFormat('pt-BR', {
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',year:'numeric',
});
const CLOCK = new Intl.DateTimeFormat('pt-BR', {
  timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false,
});
function dateKey(date) {
  const parts = Object.fromEntries(DAY.formatToParts(date).map(x => [x.type,x.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}
function validDate(text) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return false;
  const date=new Date(text+'T12:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===text;
}
const webFieldStyle = {
  width:'100%', boxSizing:'border-box', backgroundColor:'#FFFFFF',
  color:C.ink, border:'1px solid '+C.border, borderRadius:11,
  padding:'12px', minHeight:46, fontSize:16, fontFamily:'inherit', marginBottom:15,
};
function ScheduleInput({type,label,value,onChange,min}) {
  return <View>
    <Text style={s.label}>{label}</Text>
    {Platform.OS==='web'
      ? React.createElement('input',{
          type,value,onChange:e=>onChange(e.target.value),
          min:type==='date'?min:undefined,
          step:type==='time'?60:undefined,
          'aria-label':label,
          style:webFieldStyle,
        })
      : <TextInput style={s.input} value={value} onChangeText={onChange}
          accessibilityLabel={label} placeholder={type==='date'?'AAAA-MM-DD':'HH:MM'}
          autoCapitalize="none" maxLength={type==='date'?10:5}/>}
  </View>;
}
const validClock = text => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
const labelDate = value => DISPLAY.format(new Date(value));
const isFullDay = block => {
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const ms = end.getTime()-1;
  return CLOCK.format(start)==='00:00' &&
    CLOCK.format(end)==='00:00' &&
    (dateKey(new Date(ms))>=dateKey(start));
};
function blockLabel(block) {
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  if(isFullDay(block)){
    const endInclusive=new Date(end.getTime()-1);
    const first=labelDate(start),last=labelDate(endInclusive);
    return first===last?first+' · Dia inteiro':first+' a '+last+' · Dias inteiros';
  }
  return labelDate(start)+' · '+CLOCK.format(start)+' às '+CLOCK.format(end);
}

export default function AdminCalendarBlocks({onBack}) {
  const today=useMemo(()=>dateKey(new Date()),[]);
  const [mode,setMode]=useState('day');
  const [startDate,setStartDate]=useState(today);
  const [endDate,setEndDate]=useState(today);
  const [startTime,setStartTime]=useState('12:00');
  const [endTime,setEndTime]=useState('13:00');
  const [reason,setReason]=useState('');
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [confirmDelete,setConfirmDelete]=useState(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const {data,error:fetchError}=await supabase.from('calendar_blocks')
        .select('id,start_at,end_at,reason')
        .gte('end_at',new Date().toISOString())
        .order('start_at',{ascending:true})
        .limit(75);
      if(fetchError)throw fetchError;
      setRows(data||[]);
    }catch(e){setError('Não foi possível listar bloqueios: '+(e?.message||'erro desconhecido'));}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{refresh();},[refresh]);

  async function createBlock(){
    if(saving)return;
    setError('');setSuccess('');
    if(!validDate(startDate)||!validDate(endDate)||endDate<startDate){
      setError('Informe datas válidas no formato AAAA-MM-DD.');return;
    }
    if(mode==='hours' && (startDate!==endDate||!validClock(startTime)||
        !validClock(endTime)||startTime>=endTime)){
      setError('O bloqueio de horário exige uma data e um intervalo válido, como 12:00–13:00.');return;
    }
    if(reason.length>200){setError('Motivo: limite de 200 caracteres.');return;}
    setSaving(true);
    try {
      const {data,error:rpcError}=await supabase.rpc('admin_create_calendar_block',{
        p_start_date:startDate,
        p_end_date:endDate,
        p_all_day:mode==='day',
        p_start_time:mode==='hours'?startTime:null,
        p_end_time:mode==='hours'?endTime:null,
        p_reason:reason.trim()||null,
      });
      if(rpcError)throw rpcError;
      if(!data)throw new Error('O bloqueio não foi confirmado.');
      setSuccess('Período bloqueado. Nenhuma nova reserva poderá ser criada nesse intervalo.');
      setReason('');
      await refresh();
    }catch(e){
      const message=e?.message||'erro desconhecido';
      setError(/agendamentos ativos|appointments/i.test(message)
        ? 'Há atendimentos agendados neste período. Cancele ou reagende primeiro.'
        : /calendar_blocks_no_overlap|conflicting key|overlap/i.test(message)
          ? 'Esse período já possui um bloqueio. Remova ou escolha outro intervalo.'
          : 'Não foi possível bloquear: '+message);
    }finally{setSaving(false);}
  }
  async function removeBlock(id){
    if(saving)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const {data,error:deleteError}=await supabase.from('calendar_blocks')
        .delete().eq('id',id).select('id');
      if(deleteError)throw deleteError;
      if(!data?.length)throw new Error('Bloqueio não encontrado ou sem autorização.');
      setSuccess('Bloqueio removido. Os horários serão liberados conforme a agenda existente.');
      setConfirmDelete(null);
      await refresh();
    }catch(e){setError('Não foi possível remover: '+(e?.message||'erro desconhecido'));}
    finally{setSaving(false);}
  }

  return <View style={s.wrap}>
    <View style={s.topRow}>
      <TouchableOpacity style={s.backButton} accessibilityRole="button"
        accessibilityLabel="Voltar à agenda" onPress={onBack}>
        <Ionicons name="arrow-back" size={19} color={C.mocha}/>
      </TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={s.heading}>Bloquear dias e horários</Text>
        <Text style={s.subheading}>Períodos indisponíveis para novos agendamentos · Brasília</Text>
      </View>
    </View>
    <View style={s.card}>
      <Text style={s.sectionTitle}>Novo bloqueio</Text>
      <View style={s.modeRow}>
        {[['day','Dia inteiro'],['hours','Horários']].map(([key,label])=>
          <TouchableOpacity key={key} accessibilityRole="button"
            accessibilityState={{selected:mode===key}}
            onPress={()=>{setMode(key);setEndDate(startDate);setError('');}}
            style={[s.modeButton,mode===key&&s.selectedMode]}>
            <Ionicons name={key==='day'?'calendar-outline':'time-outline'}
              color={mode===key?C.white:C.mocha} size={17}/>
            <Text style={[s.modeText,mode===key&&{color:C.white}]}>{label}</Text>
          </TouchableOpacity>)}
      </View>

      <ScheduleInput type="date" label={mode==='day'?'Primeiro dia':'Dia do bloqueio'}
        value={startDate} min={today}
        onChange={value=>{
          setStartDate(value);
          if(mode==='hours'||(!endDate||value>endDate))setEndDate(value);
        }}/>
      {mode==='day'&&<>
        <ScheduleInput type="date" label="Último dia (inclusive)"
          value={endDate} min={startDate} onChange={setEndDate}/>
        <Text style={[s.helper,{marginBottom:13}]}>
          Para bloquear um único dia, deixe as duas datas iguais.
        </Text>
      </>}
      {mode==='hours'&&<View style={s.timesRow}>
        <View style={{flex:1}}>
          <ScheduleInput type="time" label="Início" value={startTime} onChange={setStartTime}/>
        </View>
        <View style={{flex:1}}>
          <ScheduleInput type="time" label="Fim" value={endTime} onChange={setEndTime}/>
        </View>
      </View>
      <Text style={s.label}>Motivo (opcional)</Text>
      <TextInput style={s.input} value={reason} maxLength={200}
        onChangeText={setReason} placeholder="Ex.: folga, manutenção, compromisso"
        accessibilityLabel="Motivo do bloqueio"/>
      <View style={s.warningRow}>
        <Ionicons name="information-circle-outline" size={19} color={C.mocha}/>
        <Text style={s.helper}>
          O bloqueio impede novas reservas, mas não cancela atendimentos já marcados.
          Se houver conflito, será necessário reagendar ou cancelar antes.
        </Text>
      </View>
      <TouchableOpacity style={[s.saveButton,saving&&{opacity:0.6}]} disabled={saving}
        accessibilityRole="button" onPress={createBlock}>
        {saving?<ActivityIndicator color={C.white}/>:
          <Ionicons name="lock-closed-outline" color={C.white} size={18}/>}
        <Text style={s.saveText}>Confirmar bloqueio</Text>
      </TouchableOpacity>
      {!!error&&<Text style={s.error}>{error}</Text>}
      {!!success&&<Text style={s.success}>{success}</Text>}
    </View>
    <View style={s.card}>
      <View style={s.listHeading}>
        <Text style={s.sectionTitle}>Bloqueios futuros</Text>
        <TouchableOpacity onPress={refresh} accessibilityRole="button"
          accessibilityLabel="Atualizar bloqueios">
          <Ionicons name="refresh" size={20} color={C.mocha}/>
        </TouchableOpacity>
      </View>
      {loading&&<ActivityIndicator color={C.mocha} style={{marginVertical:15}}/>}
      {!loading&&!rows.length&&
        <Text style={s.helper}>Ainda não há bloqueios futuros cadastrados.</Text>}
      {rows.map(block=><View key={block.id} style={s.blockRow}>
        <View style={s.blockIcon}>
          <Ionicons name="lock-closed-outline" size={20} color={C.mocha}/>
        </View>
        <View style={{flex:1,minWidth:0}}>
          <Text style={s.blockDate}>{blockLabel(block)}</Text>
          {!!block.reason&&<Text style={s.blockReason}>{block.reason}</Text>}
          {confirmDelete===block.id&&
            <View style={s.confirmRow}>
              <TouchableOpacity onPress={()=>setConfirmDelete(null)} style={s.cancelDelete}>
                <Text style={s.cancelDeleteText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={()=>removeBlock(block.id)}
                style={s.deleteConfirm}>
                <Text style={s.deleteConfirmText}>Liberar período</Text>
              </TouchableOpacity>
            </View>}
        </View>
        {confirmDelete!==block.id&&
          <TouchableOpacity onPress={()=>setConfirmDelete(block.id)}
            accessibilityRole="button" accessibilityLabel="Remover bloqueio"
            style={s.deleteButton}>
            <Ionicons name="trash-outline" color={C.red} size={19}/>
          </TouchableOpacity>}
      </View>)}
    </View>
  </View>;
}

const s=StyleSheet.create({
  wrap:{gap:17,paddingBottom:30},
  topRow:{flexDirection:'row',alignItems:'center',gap:11},
  backButton:{padding:10,backgroundColor:C.white,borderRadius:12,borderColor:C.border,borderWidth:1},
  heading:{fontSize:21,fontWeight:'800',color:C.ink},
  subheading:{fontSize:12,color:C.muted,marginTop:4,lineHeight:17},
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:18,padding:18},
  sectionTitle:{fontSize:17,fontWeight:'700',color:C.ink,marginBottom:15},
  modeRow:{flexDirection:'row',backgroundColor:C.soft,padding:4,borderRadius:13,marginBottom:17,gap:6},
  modeButton:{flex:1,paddingVertical:12,paddingHorizontal:9,borderRadius:10,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  selectedMode:{backgroundColor:C.brown},
  modeText:{fontWeight:'700',fontSize:13,color:C.mocha},
  label:{fontSize:13,fontWeight:'700',color:C.ink,marginBottom:7},
  input:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:11,
    padding:12,color:C.ink,fontSize:15,marginBottom:15,minHeight:46},
  helper:{color:C.muted,fontSize:12,lineHeight:18,flexShrink:1},
  timesRow:{flexDirection:'row',gap:12},
  warningRow:{flexDirection:'row',gap:9,backgroundColor:C.soft,padding:12,borderRadius:12,marginBottom:15},
  saveButton:{backgroundColor:C.brown,paddingVertical:15,borderRadius:12,
    alignItems:'center',justifyContent:'center',gap:10,flexDirection:'row'},
  saveText:{color:C.white,fontWeight:'700',fontSize:14},
  error:{color:C.red,marginTop:13,fontSize:12,lineHeight:18},
  success:{color:C.green,marginTop:13,fontSize:12,lineHeight:18},
  listHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},
  blockRow:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:14,
    flexDirection:'row',alignItems:'flex-start',gap:10},
  blockIcon:{backgroundColor:C.soft,padding:9,borderRadius:10},
  blockDate:{fontSize:13,fontWeight:'700',color:C.ink,lineHeight:19},
  blockReason:{fontSize:12,color:C.muted,marginTop:4},
  deleteButton:{padding:8},
  confirmRow:{flexDirection:'row',gap:9,marginTop:10,flexWrap:'wrap'},
  cancelDelete:{paddingVertical:10,paddingHorizontal:13,backgroundColor:C.soft,borderRadius:9},
  cancelDeleteText:{fontSize:12,color:C.mocha,fontWeight:'700'},
  deleteConfirm:{paddingVertical:10,paddingHorizontal:13,backgroundColor:C.red,borderRadius:9},
  deleteConfirmText:{color:C.white,fontWeight:'700',fontSize:12},
});
