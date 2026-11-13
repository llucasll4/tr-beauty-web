import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import VipClub from './VipClub';
import { getVipProgress } from './vipProgress';

const C = {
  bg: '#FDFBF7', white: '#FFFFFF', ink: '#2C2C2C', muted: '#766B65',
  mocha: '#7A655B', border: '#EAE2DB', soft: '#F3EDE7',
  green: '#26734D', red: '#B24149',
};
const money = value => Number(value || 0).toLocaleString('pt-BR', {
  style:'currency', currency:'BRL',
});
const digits = value => Number(value || 0).toLocaleString('pt-BR');
const formatDate = value => {
  if (!value) return 'Data indisponível';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric',
  });
};
function getServiceName(service) {
  if (Array.isArray(service)) return service[0]?.name?.trim() || 'Serviço';
  return service?.name?.trim() || 'Serviço indisponível';
}
const emptyTotals = {total_earned:0,total_spent:0,net_points:0,movements:0,service_movements:0};
const LABELS = {
  earned:'Pontos recebidos', redeemed:'Resgate de pontos',
  reversal:'Estorno de pontos', adjustment:'Ajuste de pontuação',
};
const PAGE = 30;
function Item({icon,label,value,detail,positive}) {
  return <View style={s.metric}>
    <View style={s.metricTitleRow}>
      <Ionicons name={icon} color={positive === false ? C.red : C.mocha} size={19}/>
      <Text style={s.metricName}>{label}</Text>
    </View>
    <Text style={[s.metricValue,positive===true&&{color:C.green},positive===false&&{color:C.red}]}>
      {digits(value)}
    </Text>
    <Text style={s.metricSub}>{detail}</Text>
  </View>;
}

export default function TRPointsDashboard({userId,onBack,onRedeem=()=>{},initialTab='ledger'}) {
  const {width} = useWindowDimensions();
  const [overview,setOverview] = useState(null);
  const [vipSummary,setVipSummary] = useState(null);
  const [vipSettings,setVipSettings] = useState(null);
  const [totals,setTotals] = useState(emptyTotals);
  const [entries,setEntries] = useState([]);
  const [services,setServices] = useState([]);
  const [tab,setTab] = useState(initialTab);
  const [loading,setLoading] = useState(true);
  const [moreLoading,setMoreLoading] = useState(false);
  const [error,setError] = useState('');
  const [loadError,setLoadError] = useState('');
  const [moreLedger,setMoreLedger] = useState(false);
  const [moreServices,setMoreServices] = useState(false);

  const fetchLedger = useCallback(async (offset) => {
    return supabase.from('points_ledger')
      .select('id,points,event_type,description,appointment_id,created_at,appointments(starts_at,services(name))')
      .eq('client_id',userId)
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .range(offset,offset+PAGE-1);
  },[userId]);

  const fetchServices = useCallback(async (offset) => {
    return supabase.from('appointments')
      .select('id,starts_at,price_at_booking,services(name),points_ledger(points,event_type)')
      .eq('client_id',userId).eq('status','completed')
      .order('starts_at',{ascending:false})
      .order('id',{ascending:false})
      .range(offset,offset+PAGE-1);
  },[userId]);

  const refresh = useCallback(async () => {
    if(!userId)return;
    setLoading(true);setError('');setLoadError('');
    try {
      const [summary,stats,ledger,appointments,vip,thresholds]=await Promise.all([
        supabase.rpc('get_my_loyalty'),
        supabase.rpc('get_my_points_totals'),
        fetchLedger(0), fetchServices(0),
        supabase.rpc('get_my_vip_summary'),
        supabase.from('vip_settings').select('silver_points,gold_points').eq('id',1).maybeSingle(),
      ]);
      for(const result of [summary,stats,ledger,appointments,vip,thresholds]) {
        if(result.error) throw result.error;
      }
      setOverview(summary.data || null);
      setVipSummary(vip.data || null);
      setVipSettings(thresholds.data || null);
      setTotals(stats.data || emptyTotals);
      setEntries(ledger.data || []);
      setServices(appointments.data || []);
      setMoreLedger((ledger.data || []).length===PAGE);
      setMoreServices((appointments.data || []).length===PAGE);
    } catch(err) {
      setError('Não foi possível consultar TR Points: '+(err?.message||'erro desconhecido'));
    } finally {setLoading(false);}
  },[userId,fetchLedger,fetchServices]);

  useEffect(()=>{refresh();},[refresh]);

  async function loadMore() {
    if(loading||moreLoading)return;
    setMoreLoading(true);setLoadError('');
    try {
      if(tab==='ledger') {
        const {data,error:err}=await fetchLedger(entries.length);
        if(err)throw err;
        const rows=data||[];
        setEntries(prev=>{
          const ids=new Set(prev.map(e=>e.id));
          return [...prev,...rows.filter(e=>!ids.has(e.id))];
        });
        setMoreLedger(rows.length===PAGE);
      } else {
        const {data,error:err}=await fetchServices(services.length);
        if(err)throw err;
        const rows=data||[];
        setServices(prev=>{
          const ids=new Set(prev.map(e=>e.id));
          return [...prev,...rows.filter(e=>!ids.has(e.id))];
        });
        setMoreServices(rows.length===PAGE);
      }
    } catch(err){setLoadError('Não foi possível carregar mais registros: '+(err?.message||'erro desconhecido'));}
    finally{setMoreLoading(false);}
  }

  const balance=Math.max(0,Number(overview?.balance||0));
  const vipProgress=getVipProgress(vipSummary,vipSettings);
  const twoCols=width>=650;

  return <View style={s.root}>
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar ao Início"
        onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back-outline" size={23} color={C.ink}/>
      </TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={s.headTitle}>Meus TR Points</Text>
        <Text style={s.headSubtitle}>Saldo, extrato e histórico de serviços</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar TR Points"
        onPress={refresh} disabled={loading||moreLoading} style={s.back}>
        <Ionicons name="refresh-outline" size={22} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      {loading && <View style={s.loading}>
        <ActivityIndicator color={C.mocha}/>
        <Text style={s.help}>Consultando seus pontos e atendimentos...</Text>
      </View>}
      {!!error&&<View style={s.errorBox}>
        <Text style={s.error}>{error}</Text>
        <TouchableOpacity style={s.retry} onPress={refresh}>
          <Text style={s.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>}
      {!loading&&!error&&<>
        <View style={s.hero}>
          <View style={s.heroTop}>
            <Text style={s.brand}>TR BEAUTY CONCEPT</Text>
            <Ionicons name="diamond-outline" color={C.ink} size={22}/>
          </View>
          <Text style={s.heroNumber}>{digits(balance)}</Text>
          <Text style={s.heroCaption}>Pontos disponíveis para resgate</Text>
          {overview?.enabled && vipProgress && <>
            <View style={s.levelRow}>
              <Text style={s.levelLabel}>Nível {vipProgress.tier}</Text>
              <Text style={s.levelNext}>
                {vipProgress.nextTier ? 'Próximo: '+vipProgress.nextTier : 'Nível máximo'}
              </Text>
            </View>
            <View style={s.progressTrack} accessibilityRole="progressbar"
              accessibilityValue={{min:0,max:100,now:Math.round(vipProgress.progress)}}>
              <View style={[s.progressFill,{width:vipProgress.progress+'%'}]}/>
            </View>
            <Text style={s.heroHelp}>
              {vipProgress.nextTier
                ? 'Meta do nível '+vipProgress.nextTier+': '+digits(vipProgress.goal)+
                  ' pontos acumulados. Faltam '+digits(vipProgress.remaining)+' pontos.'
                : 'Você já alcançou o nível Ouro, o mais alto do Clube VIP!'}
            </Text>
            <Text style={s.heroNote}>
              {digits(vipProgress.lifetime)} pontos acumulados. Resgatar pontos não reduz seu nível.
            </Text>
          </>}
          {overview?.enabled && !vipProgress &&
            <Text style={s.heroHelp}>Meta VIP indisponível. Toque em atualizar para consultar novamente.</Text>}
          {!overview?.enabled &&
            <Text style={s.heroHelp}>O programa de pontos está pausado no momento.</Text>}
        </View>
        <TouchableOpacity onPress={onRedeem} accessibilityRole="button"
          accessibilityLabel="Usar TR Points para agendar um serviço" style={s.redeemCta}>
          <Ionicons name="gift-outline" size={22} color="#FFFFFF"/>
          <Text style={s.redeemCtaText}>Usar meus pontos para agendar</Text>
          <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF"/>
        </TouchableOpacity>
        <View style={[s.metrics,{flexDirection:twoCols?'row':'column'}]}>
          <Item icon="arrow-up-circle-outline" label="Pontos ganhos" value={totals.total_earned}
            positive detail="Todos os créditos do extrato"/>
          <Item icon="arrow-down-circle-outline" label="Pontos descontados" value={totals.total_spent}
            positive={false} detail="Resgates, estornos e ajustes negativos"/>
        </View>
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab,tab==='ledger'&&s.activeTab]}
            accessibilityRole="button" accessibilityState={{selected:tab==='ledger'}}
            onPress={()=>setTab('ledger')}>
            <Text style={[s.tabText,tab==='ledger'&&s.activeTabText]}>Extrato</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab,tab==='services'&&s.activeTab]}
            accessibilityRole="button" accessibilityState={{selected:tab==='services'}}
            onPress={()=>setTab('services')}>
            <Text style={[s.tabText,tab==='services'&&s.activeTabText]}>Serviços</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab,tab==='vip'&&s.activeTab]}
            accessibilityRole="button" accessibilityState={{selected:tab==='vip'}}
            onPress={()=>setTab('vip')}>
            <Text style={[s.tabText,tab==='vip'&&s.activeTabText]}>Clube VIP</Text>
          </TouchableOpacity>
        </View>
        {tab==='vip'?<VipClub/>:tab==='ledger'?<>
          <Text style={s.sectionTitle}>Movimentações de pontos</Text>
          <Text style={s.sectionCaption}>
            Histórico de créditos e descontos · {digits(totals.movements)} movimentos registrados
          </Text>
          {entries.length===0&&<View style={s.empty}>
            <Ionicons name="receipt-outline" size={36} color={C.mocha}/>
            <Text style={s.emptyTitle}>Ainda não há pontos movimentados</Text>
            <Text style={s.help}>Os créditos e descontos vão aparecer aqui quando ocorrerem.</Text>
          </View>}
          {entries.map(row=>{
            const pts=Number(row.points||0);
            const appointment=Array.isArray(row.appointments)?row.appointments[0]:row.appointments;
            const title=appointment?.services ? getServiceName(appointment.services)
              : (row.description?.trim() || LABELS[row.event_type] || 'Movimentação');
            return <View style={s.entry} key={row.id}>
              <View style={s.entryMain}>
                <View style={{flex:1}}>
                  <Text style={s.entryTitle}>{title}</Text>
                  <Text style={s.entryDate}>{formatDate(row.created_at)}</Text>
                  <Text style={s.entryType}>{LABELS[row.event_type]||'Movimentação'}
                    {appointment?.starts_at ? ' · Atendimento em '+formatDate(appointment.starts_at):''}
                  </Text>
                  {!!row.description&&!!appointment?.services&&<Text style={s.entryDescription}>{row.description}</Text>}
                </View>
                <Text style={[s.entryPoints,{color:pts>=0?C.green:C.red}]}>
                  {pts>0?'+':''}{digits(pts)} pts
                </Text>
              </View>
            </View>;
          })}
        </>:<>
          <Text style={s.sectionTitle}>Serviços concluídos</Text>
          <Text style={s.sectionCaption}>
            Cada atendimento realizado e os pontos vinculados a ele.
          </Text>
          {services.length===0&&<View style={s.empty}>
            <Ionicons name="sparkles-outline" size={36} color={C.mocha}/>
            <Text style={s.emptyTitle}>Nenhum atendimento concluído</Text>
            <Text style={s.help}>Seu histórico de serviços aparecerá aqui após a conclusão dos atendimentos.</Text>
          </View>}
          {services.map(item=>{
            const lines=Array.isArray(item.points_ledger)?item.points_ledger:[];
            const gains=lines.reduce((sum,l)=>sum+Math.max(0,Number(l.points||0)),0);
            const losses=lines.reduce((sum,l)=>sum+Math.max(0,-Number(l.points||0)),0);
            return <View style={s.entry} key={item.id}>
              <View style={s.serviceHeader}>
                <Text style={s.entryTitle}>{getServiceName(item.services)}</Text>
                <Text style={s.serviceDate}>{formatDate(item.starts_at)}</Text>
              </View>
              <Text style={s.serviceValue}>Valor do atendimento: {money(item.price_at_booking)}</Text>
              <View style={s.servicePoints}>
                <Text style={{color:C.green,fontWeight:'700'}}>+{digits(gains)} pts</Text>
                {losses>0&&<Text style={{color:C.red,fontWeight:'700'}}>−{digits(losses)} pts</Text>}
              </View>
              {lines.length===0&&<Text style={s.help}>Este atendimento não possui movimentação de pontos registrada.</Text>}
            </View>;
          })}
        </>}
        {!!loadError&&<Text style={s.error}>{loadError}</Text>}
        {((tab==='ledger'&&moreLedger)||(tab==='services'&&moreServices))&&
          <TouchableOpacity disabled={moreLoading} onPress={loadMore} style={s.loadMore}>
            {moreLoading?<ActivityIndicator color={C.mocha}/>:
              <Text style={s.loadMoreLabel}>Carregar mais registros</Text>}
          </TouchableOpacity>}
        <View style={s.info}>
          <View style={s.infoHeader}>
            <Ionicons name="information-circle-outline" size={21} color={C.mocha}/>
            <Text style={s.infoTitle}>Sobre o TR Points</Text>
          </View>
          <Text style={s.infoText}>
            {overview?.enabled
              ? 'Os pontos são creditados após a conclusão do atendimento. Atualmente, você ganha '+
                digits(overview.points_per_real)+' '+(Number(overview.points_per_real)===1?'ponto':'pontos')+' a cada R$ 1,00.'
              : 'O programa de pontos está pausado. Seu histórico continua disponível.'}
          </Text>
          <Text style={s.infoText}>
            No extrato, você encontra os pontos ganhos e utilizados, além de possíveis ajustes.
            A pontuação pode variar conforme as regras válidas na data de cada atendimento.
          </Text>
          <Text style={s.infoText}>Consulte o Clube VIP para conhecer os benefícios disponíveis.</Text>
        </View>
      </>}
    </ScrollView>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{backgroundColor:C.white,borderBottomWidth:1,borderColor:C.border,paddingHorizontal:22,paddingVertical:17,flexDirection:'row',alignItems:'center',gap:13},
  back:{padding:9,borderWidth:1,borderColor:C.border,borderRadius:10},
  headTitle:{fontSize:21,fontWeight:'700',color:C.ink},
  headSubtitle:{fontSize:12,color:C.muted,marginTop:3},
  content:{padding:23,paddingBottom:48,maxWidth:780,width:'100%',alignSelf:'center'},
  hero:{backgroundColor:'#EAE2DA',padding:24,borderRadius:19,marginBottom:14},
  heroTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{fontWeight:'700',fontSize:12,color:C.mocha,letterSpacing:1.6},
  heroNumber:{fontSize:48,fontWeight:'700',color:C.ink,marginTop:20},
  heroCaption:{color:C.mocha,fontSize:15,marginTop:2},
  levelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,
    flexWrap:'wrap',marginTop:20},
  levelLabel:{fontSize:14,fontWeight:'700',color:C.ink},
  levelNext:{fontSize:12,color:C.mocha,fontWeight:'600'},
  progressTrack:{height:9,borderRadius:6,backgroundColor:'#D6CBC1',marginTop:22,overflow:'hidden'},
  progressFill:{backgroundColor:C.ink,height:9,borderRadius:6},
  heroHelp:{color:C.mocha,fontSize:12,lineHeight:19,marginTop:12},
  heroNote:{color:C.muted,fontSize:11,lineHeight:18,marginTop:8},
  redeemCta:{backgroundColor:C.ink,borderRadius:13,padding:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,marginBottom:18},
  redeemCtaText:{fontWeight:'700',fontSize:14,color:'#FFFFFF',flexShrink:1},
  metrics:{gap:12,marginBottom:19},
  metric:{flex:1,backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:15,padding:17},
  metricTitleRow:{flexDirection:'row',alignItems:'center',gap:8},
  metricName:{color:C.muted,fontSize:13,fontWeight:'600'},
  metricValue:{color:C.ink,fontSize:30,fontWeight:'700',marginTop:13},
  metricSub:{fontSize:11,color:C.muted,marginTop:7},
  tabs:{flexDirection:'row',backgroundColor:C.soft,padding:4,borderRadius:12,marginBottom:22},
  tab:{flex:1,paddingVertical:13,borderRadius:9,alignItems:'center'},
  activeTab:{backgroundColor:C.white},
  tabText:{color:C.mocha,fontSize:13,fontWeight:'600',textAlign:'center'},
  activeTabText:{color:C.ink,fontWeight:'700'},
  sectionTitle:{color:C.ink,fontWeight:'700',fontSize:18,marginBottom:5},
  sectionCaption:{fontSize:12,color:C.muted,lineHeight:18,marginBottom:19},
  entry:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,padding:17,borderRadius:13,marginBottom:12},
  entryMain:{flexDirection:'row',alignItems:'flex-start',gap:13},
  entryTitle:{color:C.ink,fontWeight:'700',fontSize:15,flexShrink:1},
  entryDate:{color:C.muted,fontSize:12,marginTop:7},
  entryType:{color:C.mocha,fontSize:11,marginTop:7,lineHeight:17},
  entryDescription:{color:C.muted,fontSize:11,marginTop:6},
  entryPoints:{fontSize:17,fontWeight:'700',flexShrink:0},
  serviceHeader:{flexDirection:'row',justifyContent:'space-between',gap:10,flexWrap:'wrap'},
  serviceDate:{color:C.muted,fontSize:12},
  serviceValue:{marginTop:12,color:C.muted,fontSize:13},
  servicePoints:{flexDirection:'row',gap:19,marginTop:12},
  info:{backgroundColor:C.soft,borderRadius:15,padding:20,marginTop:23},
  infoHeader:{flexDirection:'row',gap:9,alignItems:'center',marginBottom:13},
  infoTitle:{fontSize:15,fontWeight:'700',color:C.ink},
  infoText:{fontSize:12,lineHeight:19,color:C.mocha,marginBottom:10},
  empty:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,borderRadius:14,padding:30,alignItems:'center'},
  emptyTitle:{color:C.ink,fontWeight:'700',fontSize:15,marginTop:12,textAlign:'center'},
  help:{fontSize:12,color:C.muted,lineHeight:18,marginTop:8,textAlign:'center'},
  loading:{alignItems:'center',padding:45,gap:14},
  error:{fontSize:12,color:C.red,lineHeight:19,marginBottom:15},
  errorBox:{backgroundColor:C.white,borderRadius:14,padding:20},
  retry:{alignSelf:'flex-start',backgroundColor:C.soft,padding:12,borderRadius:10},
  retryText:{color:C.mocha,fontWeight:'700'},
  loadMore:{backgroundColor:C.soft,padding:15,borderRadius:12,alignItems:'center',marginTop:11},
  loadMoreLabel:{color:C.mocha,fontWeight:'700'},
});
