import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Linking,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#30231E',mocha:'#7A655B',muted:'#756B65',white:'#FFFFFF',
  brown:'#402816',border:'#E8DED4',red:'#AA4A4C',soft:'#F5EFE8',green:'#287451'};
const dateLabel=date=>new Date(date).toLocaleDateString('pt-BR',{
  day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo',
});
function whatsappNumber(phone){
  const numbers=String(phone||'').replace(/\D/g,'');
  if(numbers.startsWith('55')&&numbers.length>=12&&numbers.length<=13)return numbers;
  return numbers.length===10||numbers.length===11?'55'+numbers:null;
}
const statusLabel={pending:'Aguardando análise',in_review:'Em análise',
  responded:'Resposta registrada',rejected:'Indeferida',processed:'Processada'};
export default function AdminAccountRequests({onBack=()=>{}}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState(null);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [responses,setResponses]=useState({});
  const [view,setView]=useState('open');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const {data,error:requestError}=await supabase.from('account_deletion_requests')
        .select('id,user_id,created_at,status,response_note,handled_at')
        .order('created_at',{ascending:false}).limit(100);
      if(requestError)throw requestError;
      const rows=data||[];
      if(!rows.length){setItems([]);return;}
      const ids=[...new Set(rows.map(row=>row.user_id))];
      const {data:profiles,error:profileError}=await supabase.from('profiles')
        .select('id,full_name,phone').in('id',ids);
      if(profileError)throw profileError;
      const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
      setItems(rows.map(row=>({...row,person:profileMap.get(row.user_id)||null})));
    }catch(e){setError('Não foi possível consultar os pedidos: '+(e?.message||'erro desconhecido'));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function contact(item){
    const number=whatsappNumber(item.person?.phone);
    if(!number){setError('Cliente sem WhatsApp válido no cadastro.');return;}
    const message=encodeURIComponent(
      'Olá! Recebemos sua solicitação de exclusão/privacidade no TR Beauty Concept. '+
      'Podemos confirmar os detalhes do pedido para orientá-la?'
    );
    try{await Linking.openURL('https://wa.me/'+number+'?text='+message);}
    catch(e){setError('Não foi possível abrir o WhatsApp.');}
  }
  async function updateStatus(item,nextStatus){
    if(busyId)return;
    const response=(responses[item.id]||'').trim();
    if(nextStatus==='responded'&&response.length<15){
      setError('Registre a resposta enviada à cliente (mínimo de 15 caracteres).');
      return;
    }
    setBusyId(item.id);setError('');setSuccess('');
    try{
      const {data,error:writeError}=await supabase.from('account_deletion_requests')
        .update({status:nextStatus,
          response_note:nextStatus==='responded'?response:(item.response_note||null)})
        .eq('id',item.id).eq('status',item.status).select('id');
      if(writeError)throw writeError;
      if(!data?.length)throw new Error('Pedido alterado por outra pessoa. Atualize a lista.');
      setSuccess(nextStatus==='in_review'
        ?'Pedido marcado como em análise.':
        'Resposta registrada. Isso NÃO excluiu a conta da cliente.');
      await load();
    }catch(e){setError('Não foi possível atualizar o pedido: '+(e?.message||'erro desconhecido'));}
    finally{setBusyId(null);}
  }
  const visible=items.filter(row=>view==='open'
    ?['pending','in_review'].includes(row.status)
    :!['pending','in_review'].includes(row.status));
  return <View style={s.wrap}>
    <TouchableOpacity accessibilityRole="button" onPress={onBack} style={s.back}>
      <Ionicons name="arrow-back-outline" size={19} color={C.mocha}/>
      <Text style={s.link}>Voltar às configurações</Text>
    </TouchableOpacity>
    <Text style={s.title}>Solicitações de privacidade</Text>
    <Text style={s.help}>
      A cliente pode solicitar a exclusão da conta. Confirme sua identidade,
      verifique as obrigações legais de retenção e responda pelo canal de atendimento.
      Registrar uma resposta NÃO apaga dados e NÃO conclui a exclusão.
    </Text>
    <View style={s.tabs}>
      {[['open','Em aberto'],['history','Respondidos']].map(([key,label])=>
        <TouchableOpacity key={key} accessibilityRole="button"
          accessibilityState={{selected:view===key}}
          style={[s.tab,view===key&&s.tabActive]} onPress={()=>setView(key)}>
          <Text style={[s.tabText,view===key&&{color:C.white}]}>{label}</Text>
        </TouchableOpacity>)}
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={load} style={s.refresh}>
      <Ionicons name="refresh-outline" size={18} color={C.mocha}/>
      <Text style={s.link}>Atualizar solicitações</Text>
    </TouchableOpacity>
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!!success&&<Text style={s.success}>{success}</Text>}
    {loading&&<ActivityIndicator color={C.mocha} style={{marginVertical:18}}/>}
    {!loading&&!error&&!visible.length&&
      <Text style={s.empty}>Nenhuma solicitação nesta categoria.</Text>}
    {visible.map(item=><View key={item.id} style={s.card}>
      <View style={s.top}>
        <Ionicons name="shield-checkmark-outline" size={21} color={C.mocha}/>
        <Text style={s.name}>{item.person?.full_name||'Cliente'}</Text>
      </View>
      <Text style={s.small}>Solicitado em {dateLabel(item.created_at)}</Text>
      <Text style={s.small}>Status: {statusLabel[item.status]||item.status}</Text>
      {!!item.response_note&&<Text style={s.response}>
        Resposta visível à cliente: {item.response_note}
      </Text>}
      {['pending','in_review'].includes(item.status)&&<>
        <TouchableOpacity accessibilityRole="button" style={s.action}
          onPress={()=>contact(item)}>
          <Ionicons name="logo-whatsapp" size={18} color={C.white}/>
          <Text style={s.actionText}>Contatar cliente</Text>
        </TouchableOpacity>
        {item.status==='pending'
          ?<TouchableOpacity accessibilityRole="button"
            disabled={!!busyId} style={s.secondary}
            onPress={()=>updateStatus(item,'in_review')}>
            <Text style={s.secondaryText}>Iniciar análise</Text>
          </TouchableOpacity>
          :<>
            <Text style={s.small}>Após responder à cliente, registre um resumo da resposta.
              O resumo ficará visível para ela em Perfil.</Text>
            <TextInput style={s.note} multiline maxLength={1000}
              placeholder="Ex.: Orientamos a cliente sobre os dados que precisam ser mantidos..."
              placeholderTextColor={C.muted}
              value={responses[item.id]||''}
              onChangeText={value=>setResponses(old=>({...old,[item.id]:value}))}
              accessibilityLabel="Resposta enviada à cliente"/>
            <TouchableOpacity accessibilityRole="button" disabled={!!busyId}
              style={s.action} onPress={()=>updateStatus(item,'responded')}>
              <Ionicons name="checkmark-circle-outline" color={C.white} size={19}/>
              <Text style={s.actionText}>Registrar resposta enviada</Text>
            </TouchableOpacity>
          </>}
      </>}
      {busyId===item.id&&<ActivityIndicator color={C.mocha} style={{marginTop:9}}/>}
    </View>)}
    <Text style={s.footnote}>
      Processamentos que exijam exclusão efetiva, exportação ou retenção legal
      devem ser executados por procedimento específico, fora desta tela.
    </Text>
  </View>;
}
const s=StyleSheet.create({
  wrap:{paddingBottom:25},
  back:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:14},
  link:{color:C.mocha,fontSize:13,fontWeight:'700'},
  title:{color:C.ink,fontSize:21,fontWeight:'800',marginBottom:11},
  help:{color:C.muted,fontSize:12,lineHeight:19,marginBottom:16},
  refresh:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:13},
  tabs:{backgroundColor:C.soft,flexDirection:'row',borderRadius:13,padding:4,
    gap:5,marginBottom:15},
  tab:{flex:1,borderRadius:11,padding:12,alignItems:'center'},
  tabActive:{backgroundColor:C.brown},
  tabText:{color:C.mocha,fontWeight:'700',fontSize:13},
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:14,padding:17,marginBottom:11},
  top:{flexDirection:'row',gap:10,alignItems:'center'},
  name:{color:C.ink,fontWeight:'700',fontSize:15,flex:1},
  small:{color:C.muted,fontSize:12,marginTop:9,lineHeight:19},
  action:{marginTop:14,backgroundColor:C.brown,padding:12,borderRadius:10,
    alignSelf:'flex-start',alignItems:'center',flexDirection:'row',gap:9},
  actionText:{color:C.white,fontWeight:'700',fontSize:12},
  secondary:{borderColor:C.border,borderWidth:1,borderRadius:10,padding:11,
    alignSelf:'flex-start',marginTop:10},
  secondaryText:{color:C.brown,fontWeight:'700',fontSize:12},
  note:{borderColor:C.border,borderWidth:1,padding:12,borderRadius:10,
    backgroundColor:C.white,fontSize:13,minHeight:80,marginTop:10,color:C.ink},
  response:{padding:12,borderRadius:10,backgroundColor:C.soft,marginTop:10,
    color:C.ink,fontSize:12,lineHeight:19},
  error:{color:C.red,fontSize:13,marginVertical:12},
  success:{color:C.green,fontSize:13,marginVertical:12},
  empty:{color:C.muted,fontSize:13,backgroundColor:C.white,padding:16,borderRadius:12},
  footnote:{color:C.muted,fontSize:11,lineHeight:18,marginTop:7},
});
