import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  ink:'#30231E', mocha:'#7A655B', muted:'#756B65', bg:'#FDFBF7',
  soft:'#F3EDE7', border:'#E6DDD5', white:'#FFFFFF', green:'#26734D', red:'#A73F46',
};
const BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money = value => BRL.format(Number(value)||0);
const METHODS = [
  ['pix','Pix'],['cash','Dinheiro'],['debit','Débito'],
  ['credit','Crédito'],['transfer','Transferência'],['other','Outro'],
];
const methodLabel = key => METHODS.find(([value])=>value===key)?.[1]||'Outro';
const dateLabel = value => {
  if(!value)return 'Data indisponível';
  return new Date(value).toLocaleString('pt-BR',{
    timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit',
  });
};
const amountString = value => (Math.max(0,Number(value)||0)).toFixed(2).replace('.',',');
const parseAmount = text => {
  const value=String(text||'').trim();
  if(!/^\d+(?:[,.]\d{1,2})?$/.test(value))return null;
  const number=Number(value.replace(',','.'));
  return Number.isFinite(number)&&number>0?Math.round(number*100)/100:null;
};
const hasMissingRpc = e => e?.code==='PGRST202'||e?.code==='42883'||
  /could not find the function|does not exist/i.test(e?.message||'');

function Stat({label,value,note}) {
  return <View style={s.stat}>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={s.statValue} adjustsFontSizeToFit numberOfLines={1}>{money(value)}</Text>
    <Text style={s.note}>{note}</Text>
  </View>;
}

// Apenas a Admin acessa este componente. O banco valida novamente as permissões.
export default function AdminReceipts({year,month,userId}) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [unavailable,setUnavailable]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState(null);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('pix');
  const [saving,setSaving]=useState(false);
  const operation=useRef(false);
  const [actionError,setActionError]=useState('');
  const [voidId,setVoidId]=useState(null);
  const [voidReason,setVoidReason]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setError('');setUnavailable(false);
    try{
      const {data:result,error:err}=await supabase.rpc('p3_financial_snapshot',{
        p_year:year,p_month:month,
      });
      if(err)throw err;
      if(!result?.metrics||!Array.isArray(result?.appointments)||
         !Array.isArray(result?.receipts))
        throw new Error('Resumo de recebimentos incompleto.');
      setData(result);
    }catch(err){
      setData(null);
      if(hasMissingRpc(err))setUnavailable(true);
      else setError('Não foi possível consultar os recebimentos: '+(err.message||'erro desconhecido'));
    }finally{setLoading(false);}
  },[year,month]);

  useEffect(()=>{
    setSelected(null);setActionError('');setVoidId(null);setVoidReason('');
    load();
  },[load]);

  const openEntry=item=>{
    setVoidId(null);setActionError('');
    setSelected(item.id);
    setAmount(amountString(item.remaining));
    setMethod('pix');
  };
  const submit=async()=>{
    if(!selected||saving||operation.current)return;
    const item=data?.appointments?.find(x=>x.id===selected);
    const value=parseAmount(amount);
    if(!item||value===null||Math.round(value*100)>Math.round(Number(item.remaining||0)*100)){
      setActionError('Informe um valor válido, positivo e dentro do saldo sem registro.');
      return;
    }
    operation.current=true;setSaving(true);setActionError('');
    try{
      const {error:err}=await supabase.from('appointment_payments').insert({
        appointment_id:selected, amount:value,method,received_at:new Date().toISOString(),
      });
      if(err)throw err;
      setSelected(null);setAmount('');
      await load();
    }catch(err){
      setActionError('Não foi possível registrar: '+(err.message||'erro desconhecido')+
        '. Atualize o painel antes de tentar novamente.');
    }finally{operation.current=false;setSaving(false);}
  };
  const voidEntry=async()=>{
    if(!voidId||saving||operation.current)return;
    if(!userId||voidReason.trim().length<5||voidReason.trim().length>300){
      setActionError('Informe o motivo da anulação com 5 a 300 caracteres.');
      return;
    }
    operation.current=true;setSaving(true);setActionError('');
    try{
      const {data:updated,error:err}=await supabase.from('appointment_payments')
        .update({
          voided_at:new Date().toISOString(), voided_by:userId, void_reason:voidReason.trim(),
        }).eq('id',voidId).is('voided_at',null).select('id').maybeSingle();
      if(err)throw err;
      if(!updated)throw new Error('Registro não encontrado ou já anulado');
      setVoidId(null);setVoidReason('');
      await load();
    }catch(err){
      setActionError('Falha ao anular o lançamento: '+(err.message||'erro desconhecido'));
    }finally{operation.current=false;setSaving(false);}
  };

  return <View style={s.root}>
    <View style={s.heading}>
      <View style={{flex:1}}>
        <Text style={s.title}>Controle de recebimentos</Text>
        <Text style={s.subtitle}>Fase 3 · Registros manuais da administradora</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar recebimentos"
        onPress={load} disabled={loading||saving} style={s.iconButton}>
        <Ionicons name="refresh-outline" size={21} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    {loading&&<View style={s.loading}>
      <ActivityIndicator color={C.mocha}/>
      <Text style={s.note}>Consultando lançamentos...</Text>
    </View>}
    {unavailable&&<View style={s.info}>
      <Text style={s.infoTitle}>Registro de recebimentos ainda não habilitado</Text>
      <Text style={s.note}>O painel de atendimentos continua disponível acima. A nova função precisa ser ativada no Supabase após a revisão da migração; nenhum valor será mostrado como recebido sem um lançamento.</Text>
    </View>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!loading&&!unavailable&&!error&&data&&<>
      <View style={s.stats}>
        <Stat label="Serviços concluídos" value={data.metrics.estimated_completed}
          note="Valor estimado pela data do atendimento"/>
        <Stat label="Recebido no período" value={data.metrics.received_in_period}
          note="Somente lançamentos manuais ativos, pela data do recebimento"/>
        <Stat label="Sem registro de recebimento" value={data.metrics.unrecorded}
          note="Saldo dos serviços concluídos no período, não necessariamente inadimplência"/>
      </View>
      <Text style={s.hint}>Dos serviços concluídos neste período, {money(data.metrics.registered_for_services)} já têm recebimentos vinculados. O recebimento pode ter ocorrido em outro mês.</Text>
      <Text style={s.section}>Atendimentos concluídos</Text>
      <Text style={s.note}>Confira o pagamento antes de registrar. Valores resgatados com TR Points não exigem recebimento em reais.</Text>
      {data.appointments.length===0&&<Text style={s.note}>Nenhum atendimento com valor em reais neste período.</Text>}
      {data.appointments.map(item=><View key={item.id} style={s.entry}>
        <View style={s.row}>
          <View style={{flex:1}}>
            <Text style={s.entryTitle}>{item.service}</Text>
            <Text style={s.note}>{item.client} · {dateLabel(item.starts_at)}</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
            <Text style={s.entryTitle}>{money(item.price)}</Text>
            <Text style={s.note}>Registrado: {money(item.registered)}</Text>
          </View>
        </View>
        <View style={s.row}>
          <Text style={[s.note,{color:Number(item.remaining)>0?C.red:C.green}]}>
            {Number(item.remaining)>0
              ? 'Sem registro: '+money(item.remaining)
              : 'Recebimento integral registrado'}
          </Text>
          {Number(item.remaining)>0&&<TouchableOpacity accessibilityRole="button"
            accessibilityLabel={'Registrar recebimento para '+item.service+' em '+dateLabel(item.starts_at)}
            onPress={()=>openEntry(item)} disabled={saving} style={s.smallButton}>
            <Text style={s.smallButtonText}>Registrar recebimento</Text>
          </TouchableOpacity>}
        </View>
        {selected===item.id&&<View style={s.form}>
          <Text style={s.formTitle}>Lançar recebimento manual</Text>
          <Text style={s.note}>Valor em reais (R$), sem separador de milhares</Text>
          <TextInput style={s.input} keyboardType="decimal-pad"
            accessibilityLabel="Valor recebido em reais" value={amount} onChangeText={setAmount}
            placeholder="0,00" editable={!saving}/>
          <Text style={s.note}>Forma de pagamento</Text>
          <View style={s.methods}>
            {METHODS.map(([key,label])=><TouchableOpacity key={key}
              accessibilityRole="button" accessibilityState={{selected:method===key}}
              onPress={()=>setMethod(key)} disabled={saving}
              style={[s.method,method===key&&s.methodSelected]}>
              <Text style={[s.methodText,method===key&&s.methodTextSelected]}>{label}</Text>
            </TouchableOpacity>)}
          </View>
          <Text style={s.note}>O lançamento registra o recebimento informado pela administradora, não uma confirmação do banco.</Text>
          <View style={s.actions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancelar lançamento"
              onPress={()=>{setSelected(null);setActionError('');}} disabled={saving} style={s.outline}>
              <Text style={s.outlineText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Salvar recebimento"
              onPress={submit} disabled={saving} style={s.primary}>
              <Text style={s.primaryText}>{saving?'Salvando...':'Salvar recebimento'}</Text>
            </TouchableOpacity>
          </View>
        </View>}
      </View>)}
      <Text style={s.note}>Exibindo até {data.appointments_limit||60} atendimentos recentes do período; os totais consideram todos.</Text>

      <Text style={s.section}>Recebimentos registrados no período</Text>
      {data.receipts.length===0&&<Text style={s.note}>Nenhum recebimento foi lançado neste período.</Text>}
      {data.receipts.map(item=><View key={item.id} style={s.entry}>
        <View style={s.row}>
          <View style={{flex:1}}>
            <Text style={s.entryTitle}>{money(item.amount)} · {methodLabel(item.method)}</Text>
            <Text style={s.note}>{item.client} · {item.service}</Text>
            <Text style={s.note}>{dateLabel(item.received_at)}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel={'Anular lançamento de '+money(item.amount)}
            disabled={saving} onPress={()=>{setSelected(null);setVoidId(item.id);setVoidReason('');setActionError('');}}>
            <Text style={s.linkDanger}>Anular</Text>
          </TouchableOpacity>
        </View>
        {voidId===item.id&&<View style={s.form}>
          <Text style={s.formTitle}>Anular lançamento incorreto?</Text>
          <Text style={s.note}>A anulação mantém o histórico para auditoria. Não representa reembolso nem devolução de dinheiro.</Text>
          <TextInput accessibilityLabel="Motivo da anulação" style={s.input}
            placeholder="Explique o motivo da correção" value={voidReason}
            onChangeText={setVoidReason} maxLength={300} editable={!saving}/>
          <View style={s.actions}>
            <TouchableOpacity accessibilityRole="button" onPress={()=>{setVoidId(null);setActionError('');}}
              disabled={saving} style={s.outline}><Text style={s.outlineText}>Voltar</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Confirmar anulação do lançamento"
              onPress={voidEntry} disabled={saving} style={[s.primary,{backgroundColor:C.red}]}>
              <Text style={s.primaryText}>{saving?'Anulando...':'Confirmar anulação'}</Text>
            </TouchableOpacity>
          </View>
        </View>}
      </View>)}
      <Text style={s.note}>Exibindo até {data.receipts_limit||40} lançamentos mais recentes do período. Os registros anulados são preservados no banco para auditoria e excluídos dos totais.</Text>
    </>}
    {!!actionError&&<Text style={s.error}>{actionError}</Text>}
  </View>;
}
const s=StyleSheet.create({
  root:{marginTop:22,paddingTop:20,borderTopWidth:1,borderColor:C.border},
  heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:15},
  title:{fontSize:20,fontWeight:'700',color:C.ink},subtitle:{color:C.muted,fontSize:12,marginTop:4},
  iconButton:{padding:10,borderRadius:12,borderWidth:1,borderColor:C.border},
  loading:{alignItems:'center',paddingVertical:25,gap:12},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:9,marginVertical:10},
  stat:{minWidth:185,flexGrow:1,flexBasis:'28%',padding:14,borderRadius:14,backgroundColor:C.white,borderWidth:1,borderColor:C.border},
  statLabel:{fontSize:12,color:C.muted},statValue:{fontSize:21,fontWeight:'800',color:C.ink,marginTop:9},
  note:{fontSize:11,lineHeight:17,color:C.muted,marginTop:5},
  hint:{fontSize:12,color:C.ink,lineHeight:18,marginVertical:9},
  section:{fontSize:17,fontWeight:'700',color:C.ink,marginTop:20,marginBottom:8},
  info:{padding:15,backgroundColor:C.soft,borderRadius:12},infoTitle:{fontSize:14,fontWeight:'700',color:C.ink},
  error:{color:C.red,marginTop:12,lineHeight:19},
  entry:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:14,padding:14,marginTop:10},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:4},
  entryTitle:{fontSize:13,fontWeight:'700',color:C.ink},
  smallButton:{borderColor:C.mocha,borderWidth:1,paddingVertical:9,paddingHorizontal:10,borderRadius:9},
  smallButtonText:{fontWeight:'700',fontSize:11,color:C.mocha},
  form:{backgroundColor:C.bg,padding:13,borderRadius:11,marginTop:14,gap:9},
  formTitle:{fontSize:14,fontWeight:'700',color:C.ink},
  input:{padding:12,backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:9,fontSize:15,color:C.ink,minHeight:43},
  methods:{flexDirection:'row',flexWrap:'wrap',gap:7},
  method:{paddingVertical:8,paddingHorizontal:10,borderRadius:9,borderWidth:1,borderColor:C.border},
  methodSelected:{backgroundColor:C.soft,borderColor:C.mocha},
  methodText:{fontSize:11,color:C.muted},methodTextSelected:{fontWeight:'700',color:C.ink},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'flex-end',marginTop:7},
  outline:{paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderColor:C.border,borderRadius:10},
  outlineText:{fontSize:12,fontWeight:'700',color:C.mocha},
  primary:{paddingHorizontal:14,paddingVertical:12,backgroundColor:C.mocha,borderRadius:10},
  primaryText:{fontSize:12,fontWeight:'700',color:C.white},
  linkDanger:{color:C.red,fontWeight:'700',fontSize:12,padding:7},
});
