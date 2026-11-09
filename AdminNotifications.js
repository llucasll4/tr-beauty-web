import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C={ink:'#2C2C2C',mocha:'#7A655B',muted:'#756B65',border:'#E7DDD6',
  soft:'#F3EDE7',red:'#AF3441',redBg:'#FFF0F1',amber:'#98610C',amberBg:'#FFF6E3',
  green:'#207148',white:'#FFFFFF'};
const types={
  client_cancelled:{label:'URGENTE · CANCELAMENTO',icon:'alert-circle-outline',color:C.red,bg:C.redBg,rank:0},
  system_alert:{label:'CRÍTICO · SISTEMA',icon:'warning-outline',color:C.red,bg:C.redBg,rank:1},
  booking_requested:{label:'NOVO PEDIDO',icon:'calendar-outline',color:C.amber,bg:C.amberBg,rank:2}
};
const one=value=>Array.isArray(value)?value[0]:value;
const when=value=>{if(!value)return '—';const d=new Date(value);
 return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',
 {timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function AdminNotifications({
  items=[],unreadCount=0,loading=false,error='',busyId=null,
  onBack,onRefresh,onMarkRead,onMarkAll,onDecide
}){
  const [filter,setFilter]=useState('all');
  const [expanded,setExpanded]=useState(null);
  const [rejectId,setRejectId]=useState(null);
  const [actionError,setActionError]=useState('');
  const [actionSuccess,setActionSuccess]=useState('');
  const visible=useMemo(()=>[...items].filter(n=>{
    const a=one(n.appointments);
    if(filter==='pending')return n.type==='booking_requested'&&a?.status==='pending'&&!n.resolved_at;
    if(filter==='critical')return n.priority==='critical';
    return true;
  }).sort((a,b)=>(types[a.type]?.rank??3)-(types[b.type]?.rank??3)||
    new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),[items,filter]);

  async function decide(item,status){
    if(busyId)return;
    setActionError('');setActionSuccess('');setRejectId(null);
    try {
      await onDecide(item,status);
      setActionSuccess(status==='confirmed'
        ? 'Pedido aprovado. A confirmação seguirá as notificações configuradas.'
        : 'Pedido recusado. O cancelamento foi registrado.');
    }catch(e){setActionError(e?.message||'Não foi possível atualizar o pedido.');}
  }
  function toggleDetails(item){
    const open=expanded!==item.id;
    setExpanded(open?item.id:null);setRejectId(null);
    if(open&&!item.read_at)onMarkRead(item.id);
  }
  return <View style={s.root}>
    <View style={s.header}>
      <TouchableOpacity style={s.back} onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar para Início">
        <Ionicons name="arrow-back-outline" size={22} color={C.ink}/></TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={s.title}>Central de Controle</Text>
        <Text style={s.helper}>{unreadCount?unreadCount+' alertas não lidos':'Sua operação em dia'}</Text>
      </View>
      <TouchableOpacity style={s.back} onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Atualizar alertas">
        <Ionicons name="refresh-outline" size={21} color={C.mocha}/></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.row}>
        <View style={{flex:1}}>
          <Text style={s.section}>Alertas da administração</Text>
          <Text style={s.helper}>Agendamentos, cancelamentos e avisos críticos</Text>
        </View>
        {unreadCount>0&&<TouchableOpacity accessibilityRole="button" onPress={onMarkAll}>
          <Text style={s.link}>Marcar tudo como lido</Text></TouchableOpacity>}
      </View>
      <View style={[s.row,{justifyContent:'flex-start',marginVertical:15}]}>
        {[['all','Todos'],['pending','Aguardando decisão'],['critical','Críticos']].map(([key,label])=>
          <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{selected:key===filter}}
            onPress={()=>setFilter(key)} style={[s.filter,key===filter&&s.filterActive]}>
            <Text style={[s.filterText,key===filter&&{color:C.white}]}>{label}</Text></TouchableOpacity>)}
      </View>
      {!!actionError&&<Text style={s.error}>{actionError}</Text>}
      {!!actionSuccess&&<Text style={s.success}>{actionSuccess}</Text>}
      {!!error&&<View style={s.box}><Text style={s.error}>{error}</Text>
        <TouchableOpacity onPress={onRefresh}><Text style={s.link}>Tentar novamente</Text></TouchableOpacity></View>}
      {loading&&<View style={s.empty}><ActivityIndicator color={C.mocha}/>
        <Text style={s.helper}>Carregando alertas...</Text></View>}
      {!loading&&!error&&!visible.length&&<View style={s.empty}>
        <Ionicons name="checkmark-done-circle-outline" color={C.green} size={41}/>
        <Text style={s.section}>Tudo em dia!</Text>
        <Text style={[s.helper,{textAlign:'center'}]}>
          {filter==='pending'?'Nenhum pedido aguarda decisão.':filter==='critical'
            ?'Nenhum alerta crítico no momento.':'Novos eventos aparecerão aqui automaticamente.'}
        </Text></View>}
      {!loading&&visible.map(item=>{
        const app=one(item.appointments);
        const profile=one(app?.profiles);
        const service=one(app?.services);
        const meta=types[item.type]||types.system_alert;
        const pending=item.type==='booking_requested'&&app?.status==='pending'&&!item.resolved_at;
        const open=item.id===expanded,busy=item.id===busyId;
        const pts=Number(app?.points_redeemed||0);
        return <View key={item.id} style={[s.card,item.priority==='critical'&&s.criticalCard]}>
          <View style={s.row}>
            <View style={[s.pill,{backgroundColor:meta.bg}]}>
              <Ionicons name={meta.icon} color={meta.color} size={17}/>
              <Text style={[s.pillText,{color:meta.color}]}>{meta.label}</Text>
            </View>
            {!item.read_at&&<View style={s.dot}/>}
          </View>
          <Text style={s.cardTitle}>{item.title}</Text>
          <Text style={s.body}>{item.body}</Text>
          <Text style={s.date}>{when(item.created_at)} · Brasília</Text>
          <View style={[s.row,{marginTop:12}]}>
            <Text style={[s.state,{color:pending?C.amber:C.mocha}]}>
              {pending?'Aguardando decisão':app?.status==='confirmed'?'Confirmado':
                app?.status==='cancelled'?'Cancelado':
                app?.status==='completed'?'Concluído':
                item.type==='system_alert'?'Atenção necessária':'Informativo'}
            </Text>
            {!item.read_at&&<TouchableOpacity onPress={()=>onMarkRead(item.id)}>
              <Text style={s.link}>Marcar lido</Text></TouchableOpacity>}
          </View>
          {open&&<View style={s.detail}>
            <Text style={s.detailHeading}>Detalhes</Text>
            {app?<>
              <Text style={s.detailText}>Cliente: {profile?.full_name||'Não informado'}</Text>
              <Text style={s.detailText}>Telefone: {profile?.phone||'Não informado'}</Text>
              <Text style={s.detailText}>Serviço: {service?.name||'Serviço'}</Text>
              <Text style={s.detailText}>Data: {when(app.starts_at)}</Text>
              <Text style={s.detailText}>Pagamento: {pts?pts+' TR Points':money(app.price_at_booking)}</Text>
              <Text style={s.detailText}>Status: {app.status}</Text>
              {!!app.notes&&<Text style={s.detailText}>Observações: {app.notes}</Text>}
            </>:<Text style={s.detailText}>Evento operacional: confira o envio de notificações do estúdio.</Text>}
          </View>}
          {rejectId===item.id&&pending&&<View style={s.rejectConfirm}>
            <Text style={[s.cardTitle,{color:C.red,marginTop:0}]}>Confirmar recusa?</Text>
            <Text style={s.body}>O pedido será cancelado e a cliente receberá a atualização no canal configurado.</Text>
            <View style={s.buttons}>
              <TouchableOpacity onPress={()=>setRejectId(null)} style={s.secondary}>
                <Text style={s.secondaryLabel}>Voltar</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>decide(item,'cancelled')} disabled={!!busyId}
                style={[s.reject,busy&&{opacity:.5}]}>
                {busy?<ActivityIndicator color={C.white}/>:<Text style={s.whiteLabel}>Confirmar recusa</Text>}
              </TouchableOpacity>
            </View></View>}
          <View style={s.buttons}>
            {pending&&rejectId!==item.id&&<>
              <TouchableOpacity style={s.approve} accessibilityRole="button" disabled={!!busyId}
                onPress={()=>decide(item,'confirmed')}>
                {busy?<ActivityIndicator color={C.white}/>:<><Ionicons name="checkmark-outline" size={18} color={C.white}/>
                  <Text style={s.whiteLabel}>Aprovar</Text></>}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondary} accessibilityRole="button" disabled={!!busyId}
                onPress={()=>setRejectId(item.id)}>
                <Ionicons name="close-outline" size={17} color={C.red}/>
                <Text style={[s.secondaryLabel,{color:C.red}]}>Recusar</Text>
              </TouchableOpacity>
            </>}
            <TouchableOpacity style={s.secondary} accessibilityRole="button" onPress={()=>toggleDetails(item)}>
              <Ionicons name={open?'chevron-up-outline':'eye-outline'} size={17} color={C.mocha}/>
              <Text style={s.secondaryLabel}>{open?'Fechar':'Visualizar'}</Text>
            </TouchableOpacity>
          </View>
        </View>;
      })}
      <Text style={s.foot}>Alertas de cancelamento aparecem quando a própria cliente cancela.
        Alertas críticos do sistema representam falhas reais no envio de notificações.</Text>
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#FAF8F5'},
 header:{backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border,
  padding:17,flexDirection:'row',gap:12,alignItems:'center'},
 back:{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:C.border,
  alignItems:'center',justifyContent:'center'},
 title:{fontSize:20,fontWeight:'700',color:C.ink},
 helper:{fontSize:12,color:C.muted,lineHeight:19,marginTop:5},
 content:{padding:20,paddingBottom:55,maxWidth:810,width:'100%',alignSelf:'center'},
 row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},
 section:{fontSize:17,fontWeight:'700',color:C.ink},
 link:{fontSize:12,fontWeight:'700',color:C.mocha},
 filter:{borderRadius:11,paddingHorizontal:13,paddingVertical:10,
  borderWidth:1,borderColor:C.border,backgroundColor:C.white},
 filterActive:{backgroundColor:C.ink,borderColor:C.ink},
 filterText:{fontSize:12,fontWeight:'600',color:C.mocha},
 box:{backgroundColor:C.white,padding:15,borderRadius:12},
 error:{color:C.red,fontSize:12,lineHeight:19,marginBottom:12},
 success:{color:C.green,fontSize:12,marginBottom:12},
 empty:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:14,
  padding:34,alignItems:'center',gap:10},
 card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
  borderRadius:15,padding:17,marginBottom:12},
 criticalCard:{borderColor:'#E6B3B6',borderLeftColor:C.red,borderLeftWidth:5},
 pill:{paddingHorizontal:10,paddingVertical:7,borderRadius:9,
  flexDirection:'row',alignItems:'center',gap:6},
 pillText:{fontSize:10,fontWeight:'800'},
 dot:{height:9,width:9,borderRadius:5,backgroundColor:C.red},
 cardTitle:{fontSize:16,fontWeight:'700',color:C.ink,marginTop:12},
 body:{fontSize:13,lineHeight:20,color:C.muted,marginTop:8},
 date:{fontSize:11,color:C.mocha,marginTop:10},
 state:{fontSize:12,fontWeight:'700'},
 detail:{backgroundColor:C.soft,padding:15,borderRadius:11,marginTop:15},
 detailHeading:{fontSize:13,color:C.ink,fontWeight:'700'},
 detailText:{fontSize:12,color:C.mocha,lineHeight:21,marginTop:5},
 buttons:{flexDirection:'row',gap:9,marginTop:15,flexWrap:'wrap'},
 approve:{backgroundColor:C.green,paddingHorizontal:14,paddingVertical:12,borderRadius:10,
  alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},
 reject:{backgroundColor:C.red,paddingHorizontal:14,paddingVertical:12,borderRadius:10,
  alignItems:'center',justifyContent:'center'},
 secondary:{backgroundColor:C.soft,paddingHorizontal:14,paddingVertical:12,borderRadius:10,
  alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},
 whiteLabel:{color:C.white,fontSize:12,fontWeight:'700'},
 secondaryLabel:{color:C.mocha,fontSize:12,fontWeight:'700'},
 rejectConfirm:{backgroundColor:C.redBg,padding:13,borderRadius:11,marginTop:14},
 foot:{fontSize:11,color:C.muted,lineHeight:18,marginTop:16},
});
