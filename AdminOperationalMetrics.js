import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#30231E',mocha:'#7A655B',muted:'#756B65',border:'#E6DDD5',
  soft:'#F4EEE8',white:'#FFFFFF',red:'#A73F46',green:'#26734D'};
const num=value=>Math.max(0,Number(value)||0);
const percent=(part,whole)=>whole>0 ? Math.min(100,100*num(part)/num(whole)) : null;
const labelPercent=value=>value===null?'—':new Intl.NumberFormat('pt-BR',{
  maximumFractionDigits:1,
}).format(value)+'%';
const dateLabel=value=>value?new Date(value).toLocaleString('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit',
}):'—';
const missingRpc=e=>e?.code==='PGRST202'||e?.code==='42883'||
  /could not find the function|does not exist/i.test(e?.message||'');

function Stat({title,value,detail}){
  return <View style={s.stat}>
    <Text style={s.statName}>{title}</Text>
    <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={s.note}>{detail}</Text>
  </View>;
}
export default function AdminOperationalMetrics({year,month,userId}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [unavailable,setUnavailable]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [actionId,setActionId]=useState(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const seq=useRef(0);
  const mounted=useRef(true);
  const refresh=useCallback(async()=>{
    const token=++seq.current;
    setLoading(true);setUnavailable(false);setError('');
    try{
      const {data:result,error:failure}=await supabase.rpc('p4_operational_metrics',{
        p_year:year,p_month:month,
      });
      if(failure)throw failure;
      if(!result?.metrics||!result?.minutes||!Array.isArray(result.review))
        throw new Error('O servidor não retornou indicadores completos.');
      if(mounted.current&&seq.current===token)setData(result);
    }catch(e){
      if(mounted.current&&seq.current===token){
        setData(null);
        if(missingRpc(e))setUnavailable(true);
        else setError('Falha ao consultar indicadores: '+(e?.message||'erro desconhecido'));
      }
    }finally{
      if(mounted.current&&seq.current===token)setLoading(false);
    }
  },[year,month]);

  useEffect(()=>{
    mounted.current=true;
    setActionId(null);setReason('');setNotice('');
    refresh();
    return()=>{mounted.current=false;seq.current++;};
  },[refresh]);

  const record=async appointment=>{
    if(lock.current||busy)return;
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      const {error:failure}=await supabase.from('appointment_no_shows')
        .insert({appointment_id:appointment.id});
      if(failure)throw failure;
      setActionId(null);
      setNotice('Falta registrada. O histórico foi preservado.');
      await refresh();
    }catch(e){
      setError('Não foi possível registrar a falta: '+(e?.message||'erro desconhecido'));
    }finally{lock.current=false;setBusy(false);}
  };
  const voidRecord=async appointment=>{
    if(lock.current||busy)return;
    if(!userId||reason.trim().length<5||reason.trim().length>300){
      setError('Informe o motivo da correção com 5 a 300 caracteres.');
      return;
    }
    lock.current=true;setBusy(true);setError('');setNotice('');
    try{
      const {data:updated,error:failure}=await supabase
        .from('appointment_no_shows')
        .update({voided_at:new Date().toISOString(),voided_by:userId,
          void_reason:reason.trim()})
        .eq('id',appointment.no_show_id)
        .is('voided_at',null)
        .select('id').maybeSingle();
      if(failure)throw failure;
      if(!updated)throw new Error('O lançamento já foi alterado. Atualize a lista.');
      setActionId(null);setReason('');
      setNotice('Registro de falta anulado, com justificativa auditada.');
      await refresh();
    }catch(e){
      setError('Não foi possível corrigir a falta: '+(e?.message||'erro desconhecido'));
    }finally{lock.current=false;setBusy(false);}
  };

  const m=data?.metrics||{};
  const mins=data?.minutes||{};
  const occupied=percent(mins.booked,mins.capacity);
  const cancellations=percent(m.cancelled,m.bookings);
  const absences=percent(m.confirmed_no_shows,m.attended_or_absent);

  return <View style={s.root}>
    <View style={s.header}>
      <View style={{flex:1}}>
        <Text style={s.heading}>Indicadores de operação</Text>
        <Text style={s.note}>Ocupação, cancelamentos e faltas · horário de Brasília</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar indicadores de operação"
        style={s.refresh} onPress={refresh} disabled={loading||busy}>
        <Ionicons name="refresh-outline" size={20} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    {loading&&<View style={s.loader}>
      <ActivityIndicator color={C.mocha}/>
      <Text style={s.note}>Calculando indicadores operacionais...</Text>
    </View>}
    {unavailable&&<Text style={s.info}>
      O módulo operacional ainda não foi ativado neste banco.
      Nenhuma falta será presumida sem registro administrativo.
    </Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!!notice&&<Text style={s.good}>{notice}</Text>}
    {!loading&&!error&&!unavailable&&data&&<>
      <View style={s.stats}>
        <Stat title="Ocupação da agenda" value={labelPercent(occupied)}
          detail="Tempo reservado ou realizado, incluindo 15 min de intervalo, sobre expediente sem bloqueios."/>
        <Stat title="Cancelamentos" value={labelPercent(cancellations)}
          detail={num(m.cancelled)+' cancelamentos em '+num(m.bookings)+' reservas. Reagendamentos não entram como cancelamento.'}/>
        <Stat title="Faltas registradas" value={String(num(m.confirmed_no_shows))}
          detail={labelPercent(absences)+' entre atendimentos concluídos ou com falta registrada. Somente registros manuais.'}/>
        <Stat title="Pendentes de verificação" value={String(num(m.unreviewed_confirmed))}
          detail="Confirmados com horário encerrado, ainda sem conclusão nem registro de falta."/>
      </View>
      <View style={s.meter}>
        <View style={s.meterHead}>
          <Text style={s.meterTitle}>Uso da capacidade de atendimento</Text>
          <Text style={s.meterTitle}>{labelPercent(occupied)}</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill,{width:(occupied??0)+'%'}]}/>
        </View>
        <Text style={s.note}>
          {Math.round(num(mins.booked))} min ocupados / {Math.round(num(mins.capacity))} min disponíveis.
          {num(mins.blocked)>0?' '+Math.round(num(mins.blocked))+' min de bloqueios descontados.':''}
          {occupied===null?' Sem expediente disponível no período.':''}
        </Text>
      </View>
      <View style={s.breakdown}>
        <Text style={s.breakdownTitle}>Contexto dos indicadores</Text>
        <Text style={s.note}>
          {num(m.completed)} atendimentos concluídos · {num(m.rescheduled)} reagendamentos
          (não contados como cancelamento) · {num(m.unconfirmed_past)}
          pedidos pendentes com horário encerrado.
        </Text>
        <Text style={s.note}>
          Uma ausência nunca é inferida automaticamente. O indicador de
          ocupação considera todo o período selecionado, inclusive reservas futuras,
          e pode mudar após cancelamentos ou alterações no expediente.
        </Text>
      </View>

      <View style={s.review}>
        <Text style={s.headingSmall}>Conferência de comparecimento</Text>
        <Text style={s.note}>
          Até {num(data.review_limit)||40} atendimentos recentes que já terminaram
          e ainda aparecem como confirmados ou pendentes.
          Só uma reserva confirmada pode receber registro de falta.
        </Text>
        {(data.review||[]).length===0&&<Text style={s.note}>
          Nenhum atendimento aguardando verificação neste período.
        </Text>}
        {(data.review||[]).map(item=><View key={item.id} style={s.reviewItem}>
          <Text style={s.reviewTitle}>{item.service} · {item.client}</Text>
          <Text style={s.note}>{dateLabel(item.starts_at)}</Text>
          <Text style={[s.note,item.no_show_id&&{color:C.red,fontWeight:'700'}]}>
            {item.no_show_id?'Falta registrada':
              item.status==='pending'?'Pedido pendente de confirmação':
              'Confirmado, aguardando conferência de comparecimento'}
          </Text>
          {item.status==='confirmed'&&<View style={s.actions}>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={item.no_show_id?'Reverter falta registrada':'Registrar falta confirmada'}
              disabled={busy}
              style={s.secondary}
              onPress={()=>{setActionId(current=>current===item.id?null:item.id);
                setReason('');setError('');}}>
              <Text style={s.secondaryText}>{item.no_show_id?'Corrigir falta':'Registrar falta'}</Text>
            </TouchableOpacity>
          </View>}
          {actionId===item.id&&item.status==='confirmed'&&<View style={s.confirm}>
            {item.no_show_id?<>
              <Text style={s.confirmTitle}>Corrigir registro de falta</Text>
              <Text style={s.note}>A correção preserva o registro original para auditoria.</Text>
              <TextInput style={s.input} accessibilityLabel="Motivo da correção de falta"
                value={reason} onChangeText={setReason}
                placeholder="Explique a correção" maxLength={300} editable={!busy}/>
            </>:<>
              <Text style={s.confirmTitle}>Confirmar que a cliente não compareceu?</Text>
              <Text style={s.note}>Só registre uma ausência verificada após o horário do atendimento.
                Não cancela a reserva nem movimenta TR Points.</Text>
            </>}
            <View style={s.actions}>
              <TouchableOpacity accessibilityRole="button" style={s.secondary}
                disabled={busy} onPress={()=>setActionId(null)}>
                <Text style={s.secondaryText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                accessibilityLabel={item.no_show_id?'Confirmar correção da falta':'Confirmar registro de falta'}
                disabled={busy}
                style={s.primary}
                onPress={()=>item.no_show_id?voidRecord(item):record(item)}>
                <Text style={s.primaryText}>{busy?'Salvando...':item.no_show_id?'Anular falta':'Confirmar falta'}</Text>
              </TouchableOpacity>
            </View>
          </View>}
        </View>)}
      </View>
    </>}
  </View>;
}
const s=StyleSheet.create({
 root:{borderTopWidth:1,borderColor:C.border,marginTop:24,paddingTop:21,gap:14},
 header:{flexDirection:'row',alignItems:'center',gap:10},
 heading:{fontSize:20,fontWeight:'700',color:C.ink},
 headingSmall:{fontSize:17,fontWeight:'700',color:C.ink},
 refresh:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',
   borderWidth:1,borderColor:C.border,borderRadius:11},
 loader:{paddingVertical:24,alignItems:'center',gap:12},
 note:{fontSize:11,color:C.muted,lineHeight:18,marginTop:5},
 info:{fontSize:12,color:C.mocha,lineHeight:20,padding:14,backgroundColor:C.soft,borderRadius:12},
 error:{fontSize:12,color:C.red,lineHeight:19,padding:12},
 good:{fontSize:12,color:C.green,lineHeight:19},
 stats:{flexDirection:'row',flexWrap:'wrap',gap:10},
 stat:{minWidth:155,flexGrow:1,flexBasis:'44%',padding:14,backgroundColor:C.white,
   borderWidth:1,borderColor:C.border,borderRadius:13},
 statName:{fontSize:12,color:C.muted},
 statValue:{fontSize:25,color:C.ink,fontWeight:'800',marginTop:9},
 meter:{padding:15,borderWidth:1,borderColor:C.border,backgroundColor:C.white,borderRadius:13},
 meterHead:{flexDirection:'row',justifyContent:'space-between',gap:12},
 meterTitle:{fontSize:13,fontWeight:'700',color:C.ink},
 track:{height:10,backgroundColor:C.soft,borderRadius:6,overflow:'hidden',marginTop:13},
 fill:{height:10,backgroundColor:C.mocha,borderRadius:6},
 breakdown:{padding:14,backgroundColor:C.soft,borderRadius:13},
 breakdownTitle:{fontSize:13,fontWeight:'700',color:C.ink},
 review:{padding:15,backgroundColor:C.white,borderWidth:1,borderColor:C.border,
   borderRadius:13,gap:11},
 reviewItem:{borderTopWidth:1,borderColor:C.border,paddingTop:12,gap:5},
 reviewTitle:{fontSize:13,fontWeight:'700',color:C.ink},
 actions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:9,marginTop:10},
 secondary:{minHeight:44,paddingHorizontal:13,alignItems:'center',justifyContent:'center',
   borderRadius:10,borderWidth:1,borderColor:C.border},
 secondaryText:{fontSize:12,fontWeight:'700',color:C.mocha},
 primary:{minHeight:44,paddingHorizontal:13,alignItems:'center',justifyContent:'center',
   borderRadius:10,backgroundColor:C.mocha},
 primaryText:{fontSize:12,fontWeight:'700',color:C.white},
 confirm:{padding:12,backgroundColor:C.soft,borderRadius:11,gap:8,marginTop:7},
 confirmTitle:{fontSize:13,fontWeight:'700',color:C.ink},
 input:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
   borderRadius:10,padding:11,fontSize:13,minHeight:44,color:C.ink}
});
