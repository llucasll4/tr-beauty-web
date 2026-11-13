import React, {useEffect,useMemo,useRef,useState} from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';
import { palette } from './theme/tokens';

// Mesma linguagem de composição das quatro telas de referência,
// usando a paleta creme, nude e café da TR Beauty Concept.
const C={
  bg:palette.cream, paper:palette.paper, white:palette.paper, ink:palette.ink,
  mocha:palette.mocha, secondary:'#856F63', subtle:'#B0A196',
  border:palette.nude, nude:palette.nude, nudeLight:palette.softNude,
  green:'#27734D', danger:'#A73546',
};
const clock=new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false,
});
const dateFull=new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'long',year:'numeric',
});
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pts=v=>Number(v||0).toLocaleString('pt-BR');
const weekdays=['S','T','Q','Q','S','S','D'];
const monthName=key=>{
  const [year,month]=key.split('-').map(Number);
  const value=new Date(Date.UTC(year,month-1,1)).toLocaleDateString('pt-BR',
    {timeZone:'UTC',month:'long',year:'numeric'});
  return value.charAt(0).toUpperCase()+value.slice(1);
};
function categoryFor(s){
  if(s.category?.trim())return s.category.trim();
  const n=String(s.name||'').toLowerCase();
  if(n.includes('esmalta'))return 'Esmaltação';
  if(n.includes('banho de gel'))return 'Banho de gel';
  if(n.includes('alongamento'))return 'Alongamento';
  if(n.includes('manuten'))return 'Manutenção';
  if(n.includes('nail art'))return 'Nail art';
  if(n.includes('pedic'))return 'Pedicure';
  return 'Unhas';
}
function ServicePhoto({serviceId, photos, large=false}){
  const uri=photos[serviceId];
  return (
    <View style={[s.photo,large&&s.photoLarge]}>
      {uri?<Image source={{uri}} style={s.photoImage} resizeMode="cover"
        accessibilityLabel="Foto do trabalho do serviço"/>:
        <View style={s.photoFallback}>
          <Ionicons name="sparkles-outline" size={large?29:23} color={C.mocha}/>
        </View>}
    </View>
  );
}
function DetailRow({icon,children}){
  return <View style={s.detailRow}>
    <View style={s.detailIcon}><Ionicons name={icon} size={20} color={C.mocha}/></View>
    <Text style={s.detailValue}>{children}</Text>
  </View>;
}

export default function BookingWizard({
  user,services=[],servicesLoading=false,serviceError='',
  selectedServiceId,setSelectedServiceId,selectedDate,setSelectedDate,
  selectedTime,setSelectedTime,slots=[],slotsLoading=false,
  error='',onClearError=()=>{},
  paymentMethod='cash',setPaymentMethod,pointsBalance=0,pointsEnabled=false,
  pointsLoading=false,pointsError='',
  calendarMonth,setCalendarMonth,calendarCells=[],firstCalendarMonth,lastCalendarMonth,
  onConfirm,onExit,onHome,onReservations,onRequireAuth,initialStep=1,saving=false,
}){
  const [step,setStep]=useState(initialStep);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('Todos');
  const [photos,setPhotos]=useState({});
  const [receipt,setReceipt]=useState(null);
  const submitting=useRef(false);
  const active=useMemo(()=>services.filter(x=>x.active),[services]);
  const service=active.find(x=>x.id===selectedServiceId);
  const categories=useMemo(()=>['Todos',...new Set(active.map(categoryFor))],[active]);
  const filtered=useMemo(()=>active.filter(item=>
    (filter==='Todos'||categoryFor(item)===filter) &&
    item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  ),[active,filter,search]);

  useEffect(()=>{
    let mounted=true;
    if(!active.length)return()=>{mounted=false;};
    (async()=>{
      const {data,error:err}=await supabase.from('portfolio_photos')
        .select('service_id,image_path,created_at')
        .in('service_id',active.map(x=>x.id))
        .order('created_at',{ascending:false});
      if(err||!mounted)return;
      const mapped={};
      for(const photo of data||[]){
        if(!photo.service_id||!photo.image_path||mapped[photo.service_id])continue;
        mapped[photo.service_id]=supabase.storage.from('portfolio')
          .getPublicUrl(photo.image_path).data.publicUrl;
      }
      setPhotos(mapped);
    })();
    return()=>{mounted=false;};
  },[active.map(x=>x.id).join(',')]);

  // Se outro pedido ocupou o horário durante a confirmação,
  // volte à seleção para mostrar os horários recém-consultados.
  useEffect(() => {
    if(step === 3 && !selectedTime &&
       /horário (indisponível|acabou de ser reservado)/i.test(error || '')) {
      setStep(2);
    }
  }, [step, selectedTime, error]);

  function back(){
    onClearError();
    if(step===1){onExit();return;}
    if(step===4){onHome();return;}
    setStep(step-1);
  }
  function chooseService(item){
    setSelectedTime(null);
    setSelectedServiceId(item.id);
    onClearError();
    if(!user){onRequireAuth(item.id);return;}
    setStep(2);
  }
  function goToReview(){
    if(!selectedTime||!service||slotsLoading)return;
    onClearError();
    setStep(3);
  }
  const redeemCost=Number(service?.redeem_points||0);
  const pointsUnavailable=paymentMethod==='points' &&
    (pointsLoading||!pointsEnabled||redeemCost<1||pointsBalance<redeemCost||!!pointsError);

  async function submit(){
    if(submitting.current||saving||!user||!service||!selectedTime||pointsUnavailable)return;
    submitting.current=true;
    const snapshot={
      name:service.name.trim(),serviceId:service.id,price:service.price,
      duration:service.duration_minutes,when:selectedTime,
      usedPoints:paymentMethod==='points',points:redeemCost,
    };
    try{
      const ok=await onConfirm();
      if(ok){
        setReceipt(snapshot);
        setStep(4);
      }
    }finally{submitting.current=false;}
  }
  const mainTitle=step===1?'Serviços':step===2?'Agendamento':
    step===3?'Confirmar agendamento':'';
  const canReview=!!selectedTime&&!slotsLoading&&!!service;
  const canSubmit=!!user&&!!selectedTime&&!!service&&!pointsUnavailable&&!saving;
  const pickedTime=selectedTime?clock.format(new Date(selectedTime)):null;
  const pickedDate=selectedTime?dateFull.format(new Date(selectedTime)):null;

  if(step===4&&receipt){
    return <View style={s.root}>
      <ScrollView contentContainerStyle={[s.successPage,{flexGrow:1}]}
        showsVerticalScrollIndicator={false}>
        <View style={s.confetti}>
          <Ionicons name="sparkles-outline" size={23} color="#C58B73"/>
          <Ionicons name="heart-outline" size={18} color="#B9A099"/>
          <Ionicons name="star-outline" size={22} color="#967060"/>
        </View>
        <View style={s.bigCheck}>
          <Ionicons name="checkmark" size={46} color={C.white}/>
        </View>
        <Text style={s.successHeading}>Pedido enviado com sucesso!</Text>
        <Text style={s.successSubtitle}>
          Seu agendamento foi registrado. Estamos aguardando a confirmação do estúdio.
        </Text>
        <View style={s.summaryCard}>
          <View style={s.serviceRow}>
            <ServicePhoto serviceId={receipt.serviceId} photos={photos} large/>
            <View style={s.serviceText}>
              <Text style={s.serviceName}>{receipt.name}</Text>
              <Text style={s.serviceMeta}>{receipt.usedPoints?pts(receipt.points)+' TR Points':money(receipt.price)} · {receipt.duration} min</Text>
              <View style={s.pendingBadge}>
                <Text style={s.pendingBadgeText}>Aguardando confirmação</Text>
              </View>
            </View>
          </View>
          <View style={s.line}/>
          <DetailRow icon="calendar-outline">{dateFull.format(new Date(receipt.when))}</DetailRow>
          <DetailRow icon="time-outline">{clock.format(new Date(receipt.when))} · horário de Brasília</DetailRow>
          <DetailRow icon="person-outline">TR Beauty Concept</DetailRow>
          {!!receipt.usedPoints&&<DetailRow icon="diamond-outline">
            {pts(receipt.points)} pontos utilizados no pedido
          </DetailRow>}
        </View>
        <View style={s.successSpacer}/>
        <TouchableOpacity accessibilityRole="button" style={s.primaryButton}
          onPress={onReservations}>
          <Text style={s.primaryText}>Ver meus agendamentos</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={s.outlineButton}
          onPress={onHome}>
          <Text style={s.outlineText}>Ir para o início</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>;
  }

  return <View style={s.root}>
    <View style={s.header}>
      <TouchableOpacity style={s.backArrow} onPress={back}
        accessibilityRole="button" accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={23} color={C.ink}/>
      </TouchableOpacity>
      <Text style={s.headerTitle}>{mainTitle}</Text>
      <View style={s.backArrow}/>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={s.page}>
      {step===1&&<>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.subtle}/>
          <TextInput value={search} onChangeText={setSearch}
            placeholder="Buscar serviço de unhas..." placeholderTextColor={C.subtle}
            style={s.searchInput} accessibilityLabel="Buscar serviço de unhas"
            autoCapitalize="none"/>
          {!!search&&<TouchableOpacity onPress={()=>setSearch('')}
            accessibilityRole="button" accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={17} color={C.subtle}/>
          </TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.categoryScroll} contentContainerStyle={s.chipsContent}>
          {categories.map(cat=><TouchableOpacity key={cat}
            accessibilityRole="button" accessibilityState={{selected:filter===cat}}
            onPress={()=>setFilter(cat)}
            style={[s.chip,cat===filter&&s.chipActive]}>
            <Text style={[s.chipText,cat===filter&&s.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>)}
        </ScrollView>
        {servicesLoading&&<ActivityIndicator style={{marginTop:30}} color={C.mocha}/>}
        {!!serviceError&&<Text style={s.errorText}>{serviceError}</Text>}
        {!servicesLoading&&filtered.length===0&&<View style={s.emptyCard}>
          <Ionicons name="search-outline" size={30} color={C.subtle}/>
          <Text style={s.muted}>Nenhum serviço de unhas encontrado.</Text>
        </View>}
        {filtered.map(item=><TouchableOpacity key={item.id} style={s.serviceTile}
          onPress={()=>chooseService(item)} accessibilityRole="button"
          accessibilityLabel={'Selecionar '+item.name.trim()}>
          <ServicePhoto serviceId={item.id} photos={photos}/>
          <View style={s.serviceText}>
            <Text style={s.serviceName} numberOfLines={2}>{item.name.trim()}</Text>
            <Text style={s.servicePrice}>{money(item.price)}</Text>
            <Text style={s.serviceDuration}>{item.duration_minutes} min</Text>
          </View>
          <Ionicons name="chevron-forward" color={C.mocha} size={19}/>
        </TouchableOpacity>)}
        {!user&&<Text style={s.guide}>
          Você pode conhecer os serviços sem cadastro. Para escolher o horário, entre ou crie sua conta.
        </Text>}
      </>}

      {step===2&&<>
        {service&&<View style={s.serviceTile}>
          <ServicePhoto serviceId={service.id} photos={photos}/>
          <View style={s.serviceText}>
            <Text style={s.serviceName}>{service.name.trim()}</Text>
            <Text style={s.serviceMeta}>{money(service.price)} · {service.duration_minutes} min</Text>
          </View>
        </View>}
        <Text style={s.section}>Data</Text>
        <View style={s.calendar}>
          <View style={s.calendarHeader}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mês anterior"
              disabled={calendarMonth<=firstCalendarMonth}
              style={s.monthArrow}
              onPress={()=>setCalendarMonth(old=>shiftMonth(old,-1))}>
              <Ionicons name="chevron-back" size={20}
                color={calendarMonth<=firstCalendarMonth?C.border:C.ink}/>
            </TouchableOpacity>
            <Text style={s.monthTitle}>{monthName(calendarMonth)}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Próximo mês"
              disabled={calendarMonth>=lastCalendarMonth}
              style={s.monthArrow}
              onPress={()=>setCalendarMonth(old=>shiftMonth(old,1))}>
              <Ionicons name="chevron-forward" size={20}
                color={calendarMonth>=lastCalendarMonth?C.border:C.ink}/>
            </TouchableOpacity>
          </View>
          <View style={s.dayGrid}>
            {weekdays.map((wd,i)=><View key={i} style={s.dayCell}>
              <Text style={s.weekday}>{wd}</Text>
            </View>)}
            {calendarCells.map((cell,i)=><View key={cell?.key||'blank-'+i} style={s.dayCell}>
              {cell&&<TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={'Dia '+cell.day+' de '+monthName(calendarMonth)}
                accessibilityState={{disabled:!cell.enabled,selected:selectedDate===cell.key}}
                disabled={!cell.enabled}
                onPress={()=>{setSelectedTime(null);setSelectedDate(cell.key);onClearError();}}
                style={[s.dayCircle,selectedDate===cell.key&&s.daySelected]}>
                <Text style={[s.dayLabel,
                  !cell.enabled&&s.dayDisabled,
                  selectedDate===cell.key&&s.dayLabelSelected]}>{cell.day}</Text>
              </TouchableOpacity>}
            </View>)}
          </View>
        </View>
        <Text style={s.section}>Horário</Text>
        {slotsLoading&&<ActivityIndicator color={C.mocha} style={{marginVertical:14}}/>}
        {!slotsLoading&&slots.length===0&&!error&&
          <Text style={s.muted}>Não há horários disponíveis nesta data. Escolha outro dia.</Text>}
        <View style={s.timeGrid}>
          {slots.map(item=>{
            const chosen=selectedTime===item.starts_at;
            return <TouchableOpacity accessibilityRole="button"
              accessibilityState={{selected:chosen}} key={item.starts_at}
              onPress={()=>{setSelectedTime(item.starts_at);onClearError();}}
              style={[s.timeChip,chosen&&s.timeChipChosen]}>
              <Text style={[s.timeChipText,chosen&&s.timeChipTextChosen]}>
                {clock.format(new Date(item.starts_at))}
              </Text>
            </TouchableOpacity>;
          })}
        </View>
        <Text style={s.guide}>Terça e quinta: atendimento + preparação até 18h. Quarta, sexta e sábado: último início às 20h. Intervalo de 15 min entre atendimentos · Brasília</Text>
      </>}

      {step===3&&service&&<>
        <View style={s.reviewCard}>
          <View style={s.serviceRow}>
            <ServicePhoto serviceId={service.id} photos={photos} large/>
            <View style={s.serviceText}>
              <Text style={s.serviceName}>{service.name.trim()}</Text>
              <Text style={s.serviceMeta}>{money(service.price)} · {service.duration_minutes} min</Text>
            </View>
          </View>
          <View style={s.line}/>
          <DetailRow icon="calendar-outline">{pickedDate}</DetailRow>
          <DetailRow icon="time-outline">{pickedTime} · horário de Brasília</DetailRow>
          <DetailRow icon="person-outline">TR Beauty Concept</DetailRow>
        </View>
        <Text style={s.section}>Forma de pagamento</Text>
        <View style={s.paymentRow}>
          <TouchableOpacity accessibilityRole="button"
            accessibilityState={{selected:paymentMethod==='cash'}}
            onPress={()=>{setPaymentMethod('cash');onClearError();}}
            style={[s.paymentOption,paymentMethod==='cash'&&s.paymentChosen]}>
            <Ionicons name="wallet-outline" size={20} color={C.mocha}/>
            <Text style={s.paymentLabel}>No atendimento</Text>
            <Text style={s.paymentSub}>{money(service.price)}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            accessibilityState={{selected:paymentMethod==='points'}}
            onPress={()=>{setPaymentMethod('points');onClearError();}}
            style={[s.paymentOption,paymentMethod==='points'&&s.paymentChosen]}>
            <Ionicons name="diamond-outline" size={20} color={C.mocha}/>
            <Text style={s.paymentLabel}>TR Points</Text>
            <Text style={s.paymentSub}>{pts(redeemCost)} pts</Text>
          </TouchableOpacity>
        </View>
        {paymentMethod==='points'&&<View style={s.pointsInfo}>
          {pointsLoading?<ActivityIndicator color={C.mocha}/>:
            <Text style={s.pointsText}>Seu saldo: {pts(pointsBalance)} pontos</Text>}
          {!pointsEnabled&&!pointsLoading&&<Text style={s.errorText}>
            O programa TR Points está indisponível no momento.
          </Text>}
          {pointsEnabled&&!pointsLoading&&pointsBalance<redeemCost&&<Text style={s.errorText}>
            Saldo insuficiente para resgatar este atendimento.
          </Text>}
          {!!pointsError&&<Text style={s.errorText}>{pointsError}</Text>}
        </View>}
        <View style={s.notice}>
          <View style={s.noticeHeading}>
            <Ionicons name="information-circle-outline" size={21} color={C.mocha}/>
            <Text style={s.noticeTitle}>Antes de confirmar</Text>
          </View>
          <Text style={s.noticeBody}>
            Este é um pedido de horário, sujeito à aprovação do estúdio.
            A confirmação aparecerá em Reservas e será enviada pelos canais habilitados.
          </Text>
          {paymentMethod==='points'&&<Text style={[s.noticeBody,{marginTop:9}]}>
            Ao enviar, os pontos serão descontados. Se o estúdio cancelar o pedido antes
            do atendimento, eles serão devolvidos automaticamente.
          </Text>}
        </View>
      </>}

      {!!error&&<View style={s.errorCard}><Ionicons name="alert-circle-outline" size={19}
        color={C.danger}/><Text style={s.errorMessage}>{error}</Text></View>}
    </ScrollView>

    {step===2&&<View style={s.footer}>
      <TouchableOpacity accessibilityRole="button" disabled={!canReview}
        onPress={goToReview} style={[s.primaryButton,!canReview&&s.disabled]}>
        <Text style={s.primaryText}>Avançar</Text>
        <Ionicons name="arrow-forward-outline" size={18} color={C.white}/>
      </TouchableOpacity>
    </View>}
    {step===3&&<View style={s.footer}>
      <TouchableOpacity accessibilityRole="button" disabled={!canSubmit}
        onPress={submit} style={[s.primaryButton,!canSubmit&&s.disabled]}>
        {saving?<ActivityIndicator color={C.white}/>:
          <Text style={s.primaryText}>
            {paymentMethod==='points'?'Resgatar e confirmar pedido':'Confirmar pedido'}
          </Text>}
      </TouchableOpacity>
    </View>}
  </View>;
}
function shiftMonth(current,offset){
  const [y,m]=current.split('-').map(Number);
  return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{height:64,backgroundColor:C.paper,flexDirection:'row',
    alignItems:'center',justifyContent:'space-between',paddingHorizontal:17,
    borderBottomWidth:1,borderBottomColor:C.border},
  backArrow:{width:44,height:44,justifyContent:'center'},
  headerTitle:{fontSize:17,fontWeight:'700',color:C.ink},
  page:{width:'100%',maxWidth:570,alignSelf:'center',
    paddingHorizontal:18,paddingTop:22,paddingBottom:32},
  searchWrap:{backgroundColor:C.nudeLight,borderRadius:15,paddingHorizontal:14,
    height:51,flexDirection:'row',alignItems:'center',gap:8,marginBottom:16},
  searchInput:{flex:1,fontSize:14,color:C.ink,paddingVertical:8},
  categoryScroll:{marginBottom:16},
  chipsContent:{gap:8,paddingVertical:2,paddingRight:16},
  chip:{paddingHorizontal:14,paddingVertical:10,minHeight:44,justifyContent:'center',borderRadius:22,
    backgroundColor:C.white,borderWidth:1,borderColor:C.border},
  chipActive:{backgroundColor:C.mocha,borderColor:C.mocha},
  chipText:{fontSize:12,color:C.mocha,fontWeight:'600'},
  chipTextActive:{color:C.white},
  serviceTile:{backgroundColor:C.white,padding:11,borderRadius:15,
    flexDirection:'row',alignItems:'center',gap:12,marginBottom:10,
    borderWidth:1,borderColor:C.border,minHeight:90},
  photo:{width:68,height:68,borderRadius:13,overflow:'hidden',backgroundColor:C.nude},
  photoLarge:{width:77,height:77},
  photoImage:{width:'100%',height:'100%'},
  photoFallback:{flex:1,justifyContent:'center',alignItems:'center',
    backgroundColor:'#EBDCD4'},
  serviceText:{flex:1,minWidth:0,justifyContent:'center'},
  serviceName:{fontSize:15,fontWeight:'700',color:C.ink,lineHeight:21},
  servicePrice:{fontSize:13,fontWeight:'700',marginTop:4,color:C.mocha},
  serviceDuration:{fontSize:12,color:C.subtle,marginTop:2},
  serviceMeta:{fontSize:12,color:C.secondary,marginTop:7,lineHeight:19},
  section:{fontSize:17,color:C.ink,fontWeight:'700',marginTop:17,marginBottom:12},
  calendar:{backgroundColor:C.white,borderRadius:18,borderWidth:1,
    borderColor:C.border,padding:14,marginBottom:12},
  calendarHeader:{flexDirection:'row',alignItems:'center',
    justifyContent:'space-between',marginBottom:13},
  monthArrow:{width:44,height:44,justifyContent:'center',alignItems:'center'},
  monthTitle:{fontSize:14,fontWeight:'700',color:C.ink},
  dayGrid:{flexDirection:'row',flexWrap:'wrap'},
  dayCell:{width:'14.2857%',height:43,alignItems:'center',justifyContent:'center'},
  weekday:{fontSize:11,color:C.muted,fontWeight:'600'},
  dayCircle:{height:35,width:35,borderRadius:18,justifyContent:'center',alignItems:'center'},
  daySelected:{backgroundColor:C.mocha},
  dayLabel:{fontSize:13,fontWeight:'500',color:C.ink},
  dayDisabled:{color:'#C9C0B8'},
  dayLabelSelected:{color:C.white,fontWeight:'700'},
  timeGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  timeChip:{width:'31.6%',minHeight:44,borderRadius:12,
    borderWidth:1,borderColor:C.border,backgroundColor:C.white,
    justifyContent:'center',alignItems:'center'},
  timeChipChosen:{backgroundColor:C.mocha,borderColor:C.mocha},
  timeChipText:{fontSize:13,fontWeight:'600',color:C.mocha},
  timeChipTextChosen:{color:C.white},
  guide:{color:C.secondary,fontSize:12,lineHeight:19,marginTop:17},
  footer:{backgroundColor:C.paper,borderTopWidth:1,borderTopColor:C.border,
    paddingVertical:15,paddingHorizontal:20,alignItems:'center'},
  primaryButton:{backgroundColor:C.mocha,paddingHorizontal:19,minHeight:51,
    borderRadius:26,justifyContent:'center',alignItems:'center',
    flexDirection:'row',gap:11,width:'100%',maxWidth:550},
  primaryText:{color:C.white,fontSize:15,fontWeight:'700',textAlign:'center'},
  disabled:{opacity:.42},
  reviewCard:{borderRadius:18,backgroundColor:C.white,padding:17,
    borderWidth:1,borderColor:C.border,marginBottom:12},
  serviceRow:{flexDirection:'row',alignItems:'center',gap:13},
  line:{height:1,backgroundColor:C.border,marginVertical:17},
  detailRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:13},
  detailIcon:{width:28,alignItems:'center'},
  detailValue:{color:C.ink,fontSize:13,lineHeight:21,flex:1},
  paymentRow:{flexDirection:'row',gap:10},
  paymentOption:{backgroundColor:C.white,flex:1,paddingVertical:15,
    paddingHorizontal:11,alignItems:'center',borderRadius:14,
    borderWidth:1,borderColor:C.border,gap:6},
  paymentChosen:{borderWidth:2,borderColor:C.mocha,backgroundColor:C.nudeLight},
  paymentLabel:{fontSize:13,fontWeight:'700',color:C.ink,textAlign:'center'},
  paymentSub:{color:C.secondary,fontSize:12},
  pointsInfo:{backgroundColor:C.white,padding:13,borderRadius:12,marginTop:12},
  pointsText:{color:C.mocha,fontWeight:'700',fontSize:13},
  notice:{backgroundColor:C.nudeLight,borderWidth:1,borderColor:C.border,
    padding:17,borderRadius:17,marginTop:24},
  noticeHeading:{flexDirection:'row',gap:8,alignItems:'center',marginBottom:9},
  noticeTitle:{fontWeight:'700',color:C.ink,fontSize:14},
  noticeBody:{color:C.secondary,fontSize:12,lineHeight:21},
  errorText:{color:C.danger,fontSize:12,lineHeight:19,marginTop:10},
  errorCard:{backgroundColor:'#FCEDF0',borderRadius:12,padding:13,
    flexDirection:'row',alignItems:'flex-start',gap:9,marginTop:16},
  errorMessage:{color:C.danger,fontSize:12,lineHeight:19,flex:1},
  emptyCard:{borderRadius:13,borderColor:C.border,borderWidth:1,
    backgroundColor:C.white,padding:26,alignItems:'center',gap:9},
  muted:{color:C.secondary,fontSize:13},
  successPage:{backgroundColor:C.bg,paddingHorizontal:25,paddingTop:40,
    paddingBottom:34,width:'100%',maxWidth:570,alignSelf:'center',alignItems:'center'},
  confetti:{width:180,flexDirection:'row',justifyContent:'space-around',
    alignItems:'center',marginBottom:14},
  bigCheck:{height:96,width:96,borderRadius:48,backgroundColor:C.mocha,
    alignItems:'center',justifyContent:'center',marginBottom:25},
  successHeading:{fontSize:24,fontWeight:'800',color:C.ink,
    textAlign:'center',lineHeight:32,marginBottom:11},
  successSubtitle:{fontSize:14,color:C.secondary,textAlign:'center',
    lineHeight:23,marginBottom:28},
  summaryCard:{width:'100%',backgroundColor:C.white,borderRadius:18,
    borderWidth:1,borderColor:C.border,padding:17},
  pendingBadge:{backgroundColor:C.nudeLight,borderRadius:8,
    paddingVertical:6,paddingHorizontal:8,alignSelf:'flex-start',marginTop:8},
  pendingBadgeText:{fontSize:10,fontWeight:'700',color:C.mocha},
  successSpacer:{minHeight:38,flexGrow:1},
  outlineButton:{width:'100%',borderRadius:26,minHeight:50,
    borderWidth:1,borderColor:C.mocha,justifyContent:'center',
    alignItems:'center',marginTop:11},
  outlineText:{color:C.mocha,fontWeight:'700',fontSize:14},
});