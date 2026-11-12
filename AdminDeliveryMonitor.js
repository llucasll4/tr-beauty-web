import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={
  ink:'#30231E', mocha:'#7A655B', muted:'#756B65',
  border:'#E8DED4', soft:'#F5EFE8', white:'#FFFFFF',
  green:'#26734D', red:'#AE3E49', paleRed:'#FFF1F2',
};
const EVENTS={
  booking_requested:'Pedido de agendamento',
  booking_confirmed:'Confirmação de agendamento',
  booking_cancelled:'Cancelamento',
  reminder_24h:'Lembrete',
};
const channelName=key=>key==='email'?'E-mail':key==='whatsapp'?'WhatsApp':'Canal';
const eventName=key=>EVENTS[key]||'Notificação';
const formatDate=value=>{
  if(!value)return '—';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',
    hour:'2-digit',minute:'2-digit',
  });
};
const value=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
const missingFn=err=>err?.code==='PGRST202'||err?.code==='42883'||
  /could not find the function|does not exist/i.test(err?.message||'');

function Count({label,number,critical=false}){
  return <View style={[s.stat,critical&&number>0&&s.statCritical]}>
    <Text style={[s.statValue,critical&&number>0&&{color:C.red}]}>
      {value(number).toLocaleString('pt-BR')}
    </Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>;
}

export default function AdminDeliveryMonitor({onBack}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [unavailable,setUnavailable]=useState(false);
  const mounted=useRef(true);
  const requestId=useRef(0);

  const refresh=useCallback(async()=>{
    const seq=++requestId.current;
    setLoading(true);
    setError('');
    setUnavailable(false);
    try{
      const {data:result,error:rpcError}=await supabase.rpc('p3_delivery_health');
      if(rpcError)throw rpcError;
      if(!result||!Array.isArray(result.channels)||!Array.isArray(result.recent_issues)
          ||typeof result.total_failed!=='number'
          ||typeof result.total_overdue!=='number'){
        throw new Error('O servidor não retornou indicadores válidos.');
      }
      if(mounted.current&&requestId.current===seq)setData(result);
    }catch(e){
      if(mounted.current&&requestId.current===seq){
        setData(null);
        if(missingFn(e))setUnavailable(true);
        else setError('Não foi possível consultar a fila: '+(e?.message||'erro desconhecido'));
      }
    }finally{
      if(mounted.current&&requestId.current===seq)setLoading(false);
    }
  },[]);

  useEffect(()=>{
    mounted.current=true;
    refresh();
    const interval=setInterval(refresh,60000);
    return()=>{mounted.current=false;requestId.current++;clearInterval(interval);};
  },[refresh]);

  const issues=data?.recent_issues||[];
  return <View style={s.root}>
    <View style={s.header}>
      {!!onBack&&<TouchableOpacity accessibilityRole="button" onPress={onBack}
        accessibilityLabel="Voltar às configurações" style={s.back}>
        <Ionicons name="arrow-back-outline" color={C.mocha} size={21}/>
      </TouchableOpacity>}
      <View style={{flex:1}}>
        <Text style={s.title}>Monitoramento de entregas</Text>
        <Text style={s.subtitle}>Situação da fila de e-mails e WhatsApp</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar monitoramento"
        onPress={refresh} disabled={loading} style={s.back}>
        <Ionicons name="refresh-outline" color={C.mocha} size={20}/>
      </TouchableOpacity>
    </View>
    <View style={s.info}>
      <Ionicons name="information-circle-outline" size={20} color={C.mocha}/>
      <Text style={[s.note,{flex:1}]}>
        “Enviado” significa aceito pelo provedor de envio, não necessariamente entregue
        ou lido pela cliente. O monitoramento não reenvia mensagens e não habilita
        automaticamente a integração WhatsApp.
      </Text>
    </View>
    {loading&&<View style={s.loader}>
      <ActivityIndicator color={C.mocha}/>
      <Text style={s.note}>Consultando os indicadores...</Text>
    </View>}
    {unavailable&&<Text style={s.error}>
      Monitoramento ainda não habilitado neste banco de dados.
      A Central de Controle continua disponível para avisos operacionais.
    </Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!loading&&!error&&!unavailable&&data&&<>
      <View style={s.overview}>
        <Count label="Falhas registradas" number={data.total_failed} critical/>
        <Count label="Pendências atrasadas" number={data.total_overdue} critical/>
      </View>
      <Text style={s.note}>
        Uma pendência é classificada como atrasada após
        {Number(data.overdue_threshold_minutes)||15} minutos do horário programado.
        Itens futuros não entram nessa contagem.
      </Text>
      {(data.channels||[]).map(channel=><View key={channel.channel} style={s.card}>
        <View style={s.channelHeader}>
          <Ionicons name={channel.channel==='email'?'mail-outline':'logo-whatsapp'}
            color={C.mocha} size={22}/>
          <Text style={s.channelTitle}>{channelName(channel.channel)}</Text>
        </View>
        <View style={s.grid}>
          <Count label="Na fila" number={channel.pending}/>
          <Count label="Atrasadas" number={channel.overdue} critical/>
          <Count label="Em processamento" number={channel.processing}/>
          <Count label="Aceitas pelo provedor" number={channel.sent}/>
          <Count label="Falhas" number={channel.failed} critical/>
          <Count label="Ignoradas (sem envio)" number={channel.skipped}/>
        </View>
        <Text style={s.note}>
          Último envio aceito pelo provedor: {formatDate(channel.last_sent_at)}
        </Text>
      </View>)}
      <View style={s.card}>
        <Text style={s.channelTitle}>Falhas e pendências recentes</Text>
        <Text style={s.note}>
          Até {value(data.issues_limit)||20} eventos para diagnóstico, sem exibir
          telefones, mensagens pessoais, chaves ou erros brutos de provedores.
        </Text>
        {issues.length===0?<View style={s.empty}>
          <Ionicons name="checkmark-circle-outline" size={23} color={C.green}/>
          <Text style={s.note}>Nenhuma falha ou pendência atrasada registrada.</Text>
        </View>:
          issues.map((event,i)=><View key={i} style={s.issue}>
            <View style={{flex:1,minWidth:0}}>
              <Text style={s.issueTitle}>
                {eventName(event.event_type)} · {channelName(event.channel)}
              </Text>
              <Text style={s.note}>
                Programada: {formatDate(event.scheduled_for)}
                {event.processed_at?' · Processada: '+formatDate(event.processed_at):''}
              </Text>
              <Text style={s.note}>Tentativas registradas: {value(event.attempts)}</Text>
            </View>
            <Text style={s.issueState}>
              {event.status==='failed'?'Falha':'Atrasada'}
            </Text>
          </View>)}
      </View>
      <Text style={s.footer}>
        Última consulta: {formatDate(data.as_of)} · horário de Brasília. A tela
        atualiza automaticamente a cada 60 segundos enquanto estiver aberta.
        Para os eventos críticos vinculados a uma reserva, consulte também a
        Central de Controle da administração.
      </Text>
    </>}
  </View>;
}

const s=StyleSheet.create({
  root:{gap:12,paddingBottom:26},
  header:{flexDirection:'row',gap:11,alignItems:'center',marginBottom:8},
  title:{fontSize:21,fontWeight:'700',color:C.ink},
  subtitle:{fontSize:12,marginTop:5,color:C.muted},
  back:{padding:10,borderRadius:11,borderWidth:1,borderColor:C.border,
    backgroundColor:C.white},
  info:{flexDirection:'row',gap:11,padding:14,backgroundColor:C.soft,borderRadius:12},
  note:{fontSize:11,lineHeight:18,color:C.muted},
  loader:{alignItems:'center',gap:12,paddingVertical:32},
  error:{color:C.red,padding:14,lineHeight:19,fontSize:12,
    backgroundColor:C.paleRed,borderRadius:10},
  overview:{flexDirection:'row',flexWrap:'wrap',gap:10},
  card:{borderWidth:1,borderColor:C.border,backgroundColor:C.white,
    borderRadius:14,padding:15,gap:12},
  channelHeader:{flexDirection:'row',gap:9,alignItems:'center'},
  channelTitle:{fontSize:16,color:C.ink,fontWeight:'700'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:9},
  stat:{flexGrow:1,flexBasis:'27%',minWidth:90,
    padding:12,borderWidth:1,borderColor:C.border,borderRadius:11},
  statCritical:{borderColor:'#E6B3B6',backgroundColor:C.paleRed},
  statValue:{fontSize:22,fontWeight:'800',color:C.ink},
  statLabel:{fontSize:11,lineHeight:16,color:C.muted,marginTop:6},
  issue:{flexDirection:'row',gap:10,alignItems:'flex-start',paddingVertical:11,
    borderTopWidth:1,borderTopColor:C.border},
  issueTitle:{fontSize:12,fontWeight:'700',color:C.ink},
  issueState:{fontSize:11,color:C.red,fontWeight:'700'},
  empty:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:16},
  footer:{fontSize:11,lineHeight:18,color:C.muted,marginTop:6}
});
