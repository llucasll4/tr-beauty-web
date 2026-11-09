import React,{useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';
const C={ink:'#2C2C2C',mocha:'#7A655B',muted:'#766B65',white:'#FFFFFF',border:'#EBE5DF',soft:'#F3EDE7',green:'#26734D'};
function Stat({icon,label,value}){
  return <View style={s.stat}>
    <Ionicons name={icon} color={C.mocha} size={21}/>
    <Text style={s.number}>{Number(value||0).toLocaleString('pt-BR')}</Text>
    <Text style={s.label}>{label}</Text>
  </View>;
}
export default function AdminWhatsApp(){
  const [stats,setStats]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [checkedAt,setCheckedAt]=useState(null);
  async function refresh(){
    setLoading(true);setError('');
    const {data,error:e}=await supabase.rpc('admin_whatsapp_summary');
    if(e)setError('Não foi possível consultar a operação: '+e.message);
    else{setStats(data);setCheckedAt(new Date());}
    setLoading(false);
  }
  useEffect(()=>{refresh();const clock=setInterval(refresh,60000);return()=>clearInterval(clock);},[]);
  return <View style={s.wrap}>
    <View style={s.heading}>
      <Ionicons name="logo-whatsapp" size={29} color={C.green}/>
      <View style={{flex:1}}>
        <Text style={s.title}>WhatsApp Inteligente</Text>
        <Text style={s.helper}>Mensagens transacionais, presença e entrega</Text>
      </View>
      <TouchableOpacity onPress={refresh} accessibilityRole="button" style={s.reload}>
        <Ionicons name="refresh-outline" size={20} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    <View style={s.info}>
      <Ionicons name="shield-checkmark-outline" size={21} color={C.mocha}/>
      <Text style={[s.helper,{flex:1}]}>
        O site já prepara confirmações de pedidos, aprovações, cancelamentos e lembretes.
        Para entregar WhatsApp automático, é necessário ativar a API oficial da Meta,
        configurar as credenciais privadas e obter aprovação dos modelos de mensagem.
      </Text>
    </View>
    {loading?<ActivityIndicator color={C.mocha} style={{marginVertical:25}}/>:
      stats&&<View style={s.stats}>
        <Stat icon="people-outline" label="Clientes que autorizaram" value={stats.consented_clients}/>
        <Stat icon="time-outline" label="Na fila de envio" value={stats.queued}/>
        <Stat icon="checkmark-circle-outline" label="Envios registrados" value={stats.sent}/>
        <Stat icon="alert-circle-outline" label="Falhas registradas" value={stats.failed}/>
        <Stat icon="chatbubble-outline" label="Presenças confirmadas" value={stats.attendance_confirmed}/>
      </View>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    <View style={s.panel}>
      <Text style={s.panelTitle}>Confirmação inteligente de presença</Text>
      <Text style={s.helper}>Após aprovação dos modelos, as mensagens de confirmação e lembrete
        poderão conter o botão Confirmar presença. A resposta será validada pelo
        webhook da Meta e aparecerá na agenda, sem alterar o status de aprovação.</Text>
      <View style={s.divider}/>
      <Text style={s.panelTitle}>Etapas necessárias na Meta</Text>
      {[
        'Conectar a conta WhatsApp Business e o número do estúdio.',
        'Gerar token de sistema e configurar o Phone Number ID em segredos do Supabase.',
        'Aprovar os modelos transacionais em português com parâmetros de serviço, data e hora.',
        'Configurar o webhook de respostas com verificação de assinatura.',
        'Habilitar os botões de presença somente após a aprovação dos modelos.'
      ].map((value,i)=><View style={s.step} key={i}>
        <View style={s.stepNumber}><Text style={s.stepText}>{i+1}</Text></View>
        <Text style={[s.helper,{flex:1}]}>{value}</Text>
      </View>)}
      <Text style={[s.helper,{marginTop:11}]}>Os dados acima mostram apenas registros reais da
        fila do site. Eles não confirmam, por si só, que as credenciais da Meta já estão ativadas.</Text>
    </View>
    {!!checkedAt&&<Text style={s.foot}>Atualizado às {checkedAt.toLocaleTimeString('pt-BR')}.</Text>}
  </View>;
}
const s=StyleSheet.create({
  wrap:{gap:15},heading:{flexDirection:'row',alignItems:'center',gap:11},
  title:{fontSize:20,fontWeight:'700',color:C.ink},helper:{fontSize:12,color:C.muted,lineHeight:19},
  reload:{padding:10,borderWidth:1,borderColor:C.border,borderRadius:10},
  info:{flexDirection:'row',gap:10,padding:16,borderRadius:13,backgroundColor:C.soft},
  stats:{flexDirection:'row',gap:10,flexWrap:'wrap'},
  stat:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    padding:16,borderRadius:13,flexGrow:1,flexBasis:128,gap:6},
  number:{fontSize:26,fontWeight:'700',color:C.ink},
  label:{fontSize:11,color:C.muted},
  error:{fontSize:12,color:'#B24149'},
  panel:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:15,padding:18},
  panelTitle:{fontSize:15,color:C.ink,fontWeight:'700',marginBottom:11},
  divider:{height:1,backgroundColor:C.border,marginVertical:17},
  step:{flexDirection:'row',gap:10,alignItems:'center',marginBottom:10},
  stepNumber:{height:25,width:25,borderRadius:13,backgroundColor:C.soft,
    justifyContent:'center',alignItems:'center'},
  stepText:{fontSize:11,color:C.mocha,fontWeight:'700'},
  foot:{fontSize:11,color:C.muted}
});
