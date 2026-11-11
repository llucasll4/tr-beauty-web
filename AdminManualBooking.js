import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  ink:'#30231E', brown:'#402816', mocha:'#7A655B', muted:'#756B65',
  white:'#FFFFFF', border:'#E8DED4', soft:'#F5EFE8', nude:'#EBE3D9',
  green:'#26714A', greenBg:'#ECF7EF', red:'#B42336', gold:'#B88C59',
};
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', hour12:false,
});
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit',
});
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone:'America/Sao_Paulo', dateStyle:'full', timeStyle:'short',
});
const money = value => Number(value||0).toLocaleString('pt-BR', {
  style:'currency', currency:'BRL',
});
const pad = value => String(value).padStart(2,'0');
function dateKey(date) {
  const p=Object.fromEntries(dateParts.formatToParts(date).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T12:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function dayLabel(value) {
  const d=new Date(value+'T12:00:00Z');
  return d.toLocaleDateString('pt-BR', {timeZone:'UTC',day:'2-digit',month:'short',weekday:'short'});
}
const STEPS = ['Cliente','Serviço','Data e hora','Confirmar'];
const WEEKDAYS = ['S','T','Q','Q','S','S','D']; // Seg → Dom, igual ao calendário de reservas
function monthName(monthKey) {
  const [year,month]=monthKey.split('-').map(Number);
  const label=new Date(Date.UTC(year,month-1,1)).toLocaleDateString('pt-BR',{
    timeZone:'UTC',month:'long',year:'numeric',
  });
  return label.charAt(0).toUpperCase()+label.slice(1);
}
function shiftMonth(monthKey,offset) {
  const [year,month]=monthKey.split('-').map(Number);
  return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,7);
}
function getMonthCells(monthKey,today,maxDay,openWeekdays) {
  const [year,month]=monthKey.split('-').map(Number);
  const startOffset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const cells=Array.from({length:startOffset},()=>null);
  for(let number=1;number<=daysInMonth;number++){
    const key=year+'-'+pad(month)+'-'+pad(number);
    const weekday=new Date(Date.UTC(year,month-1,number)).getUTCDay();
    cells.push({key,day:number,enabled:key>=today&&key<=maxDay&&openWeekdays.has(weekday)});
  }
  while(cells.length%7)cells.push(null);
  return cells;
}

export default function AdminManualBooking({
  services=[], visible=true, onClose=()=>{}, onShowAgenda=()=>{}, onBooked=()=>{},
}) {
  const [step,setStep]=useState(0);
  const [clients,setClients]=useState([]);
  const [search,setSearch]=useState('');
  const [clientQuery,setClientQuery]=useState('');
  const [selectedClient,setSelectedClient]=useState(null);
  const [clientsLoading,setClientsLoading]=useState(true);
  const [clientsError,setClientsError]=useState('');
  const activeServices=useMemo(()=>services.filter(s=>s.active),[services]);
  const [serviceId,setServiceId]=useState(null);
  const [day,setDay]=useState(()=>dateKey(new Date()));
  const [calendarMonth,setCalendarMonth]=useState(()=>dateKey(new Date()).slice(0,7));
  const [openWeekdays,setOpenWeekdays]=useState(()=>new Set([2,3,4,5,6]));
  const [slots,setSlots]=useState([]);
  const [slot,setSlot]=useState(null);
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [slotsError,setSlotsError]=useState('');
  const [slotRefresh,setSlotRefresh]=useState(0);
  const [notes,setNotes]=useState('');
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [done,setDone]=useState(null);
  const [confirmClose,setConfirmClose]=useState(false);

  const today=useMemo(()=>dateKey(new Date()),[]);
  const maxDay=useMemo(()=>{
    const d=new Date(today+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+89);
    return d.toISOString().slice(0,10);
  },[today]);
  const firstCalendarMonth=today.slice(0,7);
  const lastCalendarMonth=maxDay.slice(0,7);
  const calendarCells=useMemo(
    ()=>getMonthCells(calendarMonth,today,maxDay,openWeekdays),
    [calendarMonth,today,maxDay,openWeekdays]
  );
  useEffect(()=>{
    if(!visible)return;
    let active=true;
    supabase.from('business_hours').select('weekday,enabled').eq('enabled',true)
      .then(({data,error})=>{
        if(active&&!error&&data?.length){
          setOpenWeekdays(new Set(data.map(row=>Number(row.weekday))));
        }
      });
    return()=>{active=false;};
  },[visible]);
  useEffect(()=>{
    if(openWeekdays.has(new Date(day+'T12:00:00Z').getUTCDay()))return;
    const start=new Date(today+'T12:00:00Z');
    for(let i=0;i<90;i++){
      const candidate=new Date(start.getTime()+i*86400000);
      const key=candidate.toISOString().slice(0,10);
      if(key<=maxDay&&openWeekdays.has(candidate.getUTCDay())){
        setDay(key);
        setCalendarMonth(key.slice(0,7));
        return;
      }
    }
  },[day,today,maxDay,openWeekdays]);
  const selectedService=activeServices.find(s=>s.id===serviceId);
  const dayValid=validDate(day)&&day>=today&&day<=maxDay;

  const loadClients=useCallback(async()=>{
    setClientsLoading(true);setClientsError('');
    try{
      let query=supabase.from('profiles').select('id,full_name,phone,role')
        .eq('role','client').order('full_name',{ascending:true}).limit(75);
      if(clientQuery.trim()){
        const escaped=clientQuery.trim().replace(/[\%_]/g,'\\$&');
        query=query.ilike('full_name','%'+escaped+'%');
      }
      const {data,error}=await query;
      if(error)throw error;
      setClients(data||[]);
    }catch(err){
      setClientsError('Não foi possível carregar clientes: '+(err?.message||'erro desconhecido'));
    }finally{setClientsLoading(false);}
  },[clientQuery]);
  useEffect(()=>{if(visible)loadClients();},[loadClients,visible]);

  useEffect(()=>{
    let active=true;
    setSlot(null);setSlots([]);setSlotsError('');
    if(!visible||!serviceId||!dayValid)return()=>{active=false;};
    setSlotsLoading(true);
    supabase.rpc('available_slots',{p_service_id:serviceId,p_date:day})
      .then(({data,error})=>{
        if(!active)return;
        if(error)throw error;
        setSlots(data||[]);
      }).catch(error=>{
        if(active)setSlotsError('Não foi possível carregar horários: '+(error?.message||'erro desconhecido'));
      }).finally(()=>{if(active)setSlotsLoading(false);});
    return()=>{active=false;};
  },[visible,serviceId,day,dayValid,slotRefresh,done]);

  function restart(){
    setDone(null);
    setStep(0);
    setSearch('');setClientQuery('');
    setSelectedClient(null);setServiceId(null);setSlot(null);
    const current=dateKey(new Date());
    setDay(current);setCalendarMonth(current.slice(0,7));
    setNotes('');setSaveError('');
  }
  function close(){
    if(saving)return;
    setConfirmClose(false);
    onClose();
  }
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
      setDone({
        client:selectedClient.full_name||'Cliente',service:selectedService.name,
        startsAt:slot,id:data,
      });
      setSlot(null);
      onBooked();
    }catch(error){
      const message=error?.message||'erro desconhecido';
      setSaveError('Não foi possível agendar: '+message);
      if(error?.code==='23P01'||
         /horário|reservado|bloqueado|indisponível/i.test(message)){
        setSlot(null);
        setStep(2);
        setSlotRefresh(v=>v+1);
      }
    }finally{setSaving(false);}
  }

  const continueEnabled=step===0?!!selectedClient:
    step===1?!!selectedService:
    step===2?!!slot&&!slotsLoading&&!slotsError&&dayValid:
    !!slot&&!saving;
  const heading=done?'Agendamento confirmado':confirmClose?'Sair do agendamento?':'Agendar cliente';

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={s.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} accessibilityRole="button"
        accessibilityLabel="Fechar agendamento" activeOpacity={1} onPress={close}
        disabled={saving}/>
      <View style={s.dialog} accessibilityViewIsModal>
        <View style={s.header}>
          <View style={s.iconCircle}>
            <Ionicons name="calendar-outline" size={23} color={C.gold}/>
          </View>
          <View style={{flex:1,minWidth:0}}>
            <Text style={s.title}>{heading}</Text>
            <Text style={s.subtitle}>Novo atendimento · TR Beauty Concept</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar pop-up"
            onPress={close} disabled={saving} style={s.closeButton}>
            <Ionicons name="close" size={23} color={C.mocha}/>
          </TouchableOpacity>
        </View>

        {!done&&!confirmClose&&<View style={s.stepsRow}>
          {STEPS.map((label,i)=><View key={label} style={s.stepColumn}>
            <View style={[s.stepNumber,i<=step&&s.stepNumberActive]}>
              {i<step?<Ionicons name="checkmark" size={13} color={C.white}/>:
                <Text style={[s.stepNumberText,i<=step&&s.stepNumberTextActive]}>{i+1}</Text>}
            </View>
            <Text numberOfLines={1} style={[s.stepLabel,i===step&&s.stepLabelActive]}>{label}</Text>
          </View>)}
        </View>}

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          {done?<View style={s.successContent}>
            <View style={s.successIcon}><Ionicons name="checkmark" size={38} color={C.white}/></View>
            <Text style={s.successTitle}>Reserva realizada!</Text>
            <Text style={s.successInfo}>{done.client}</Text>
            <Text style={s.successMeta}>{done.service}</Text>
            <Text style={s.successMeta}>{fullDate.format(new Date(done.startsAt))} · Brasília</Text>
            <Text style={s.successHint}>O horário foi confirmado na agenda do estúdio. As notificações seguem as preferências da cliente.</Text>
          </View>:
          confirmClose?<View style={s.confirmExit}>
            <Text style={s.sectionTitle}>Descartar agendamento?</Text>
            <Text style={s.helper}>Os dados escolhidos serão perdidos. Nenhuma reserva foi registrada.</Text>
          </View>:
          <>
            {step===0&&<>
              <View style={s.sectionHeading}>
                <Ionicons name="person-outline" size={21} color={C.mocha}/>
                <View style={{flex:1}}>
                  <Text style={s.sectionTitle}>Escolha a cliente</Text>
                  <Text style={s.helper}>Busque pelo nome da cliente cadastrada.</Text>
                </View>
              </View>
              <View style={s.searchRow}>
                <TextInput style={s.searchInput} placeholder="Nome da cliente"
                  placeholderTextColor={C.muted} value={search}
                  onChangeText={setSearch} onSubmitEditing={()=>setClientQuery(search)}
                  returnKeyType="search" accessibilityLabel="Buscar cliente por nome"/>
                <TouchableOpacity style={s.searchButton} onPress={()=>setClientQuery(search)}
                  accessibilityRole="button" accessibilityLabel="Pesquisar clientes">
                  <Ionicons name="search" size={19} color={C.white}/>
                </TouchableOpacity>
              </View>
              {selectedClient&&<View style={s.selectedSummary}>
                <Ionicons name="checkmark-circle" size={20} color={C.green}/>
                <Text style={s.selectedSummaryText}>Selecionada: {selectedClient.full_name||'Cliente'}</Text>
              </View>}
              {!!clientsError&&<Text style={s.error}>{clientsError}</Text>}
              {clientsLoading&&<ActivityIndicator color={C.mocha} style={{marginVertical:16}}/>}
              {!clientsLoading&&!clientsError&&!clients.length&&
                <Text style={s.helper}>Nenhuma cliente encontrada. Cadastre a cliente antes de reservar.</Text>}
              {!clientsLoading&&!clientsError&&clients.map(client=>
                <TouchableOpacity key={client.id} accessibilityRole="button"
                  accessibilityState={{selected:selectedClient?.id===client.id}}
                  onPress={()=>{setSelectedClient(client);setSaveError('');}}
                  style={[s.clientRow,selectedClient?.id===client.id&&s.chosenRow]}>
                  <View style={s.avatar}><Ionicons name="person-outline" size={20} color={C.mocha}/></View>
                  <View style={{flex:1,minWidth:0}}>
                    <Text style={s.clientName}>{client.full_name||'Cliente sem nome'}</Text>
                    <Text style={s.clientSub}>{client.phone||'Sem telefone cadastrado'}</Text>
                  </View>
                  <Ionicons name={selectedClient?.id===client.id?'checkmark-circle':'ellipse-outline'}
                    color={selectedClient?.id===client.id?C.green:C.border} size={23}/>
                </TouchableOpacity>)}
              {clients.length===75&&<Text style={s.smallHint}>Exibindo até 75 clientes. Refine a busca para outras.</Text>}
            </>}
            {step===1&&<>
              <View style={s.sectionHeading}>
                <Ionicons name="sparkles-outline" size={21} color={C.mocha}/>
                <View style={{flex:1}}>
                  <Text style={s.sectionTitle}>Selecione o serviço</Text>
                  <Text style={s.helper}>Valores e durações do cadastro do estúdio.</Text>
                </View>
              </View>
              {!activeServices.length&&<Text style={s.error}>Não há serviços ativos para agendar.</Text>}
              {activeServices.map(service=><TouchableOpacity key={service.id}
                accessibilityRole="button" accessibilityState={{selected:serviceId===service.id}}
                onPress={()=>{setServiceId(service.id);setSlot(null);setSaveError('');}}
                style={[s.serviceRow,serviceId===service.id&&s.chosenRow]}>
                <View style={s.serviceIcon}><Text style={s.serviceEmoji}>💅</Text></View>
                <View style={{flex:1,minWidth:0}}>
                  <Text style={s.clientName}>{service.name}</Text>
                  <Text style={s.clientSub}>{service.duration_minutes} min · {money(service.price)}</Text>
                </View>
                <Ionicons name={serviceId===service.id?'checkmark-circle':'ellipse-outline'}
                  color={serviceId===service.id?C.green:C.border} size={23}/>
              </TouchableOpacity>)}
            </>}
            {step===2&&<>
              <View style={s.sectionHeading}>
                <Ionicons name="time-outline" size={21} color={C.mocha}/>
                <View style={{flex:1}}>
                  <Text style={s.sectionTitle}>Data e horário</Text>
                  <Text style={s.helper}>Horários disponíveis conforme a agenda real.</Text>
                </View>
              </View>
              <Text style={s.inputLabel}>Escolha o dia no calendário</Text>
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
                  {WEEKDAYS.map((weekday,index)=><View key={index} style={s.dayCell}>
                    <Text style={s.weekday}>{weekday}</Text>
                  </View>)}
                  {calendarCells.map((cell,index)=>
                    <View key={cell?.key||'blank-'+index} style={s.dayCell}>
                      {cell&&<TouchableOpacity accessibilityRole="button"
                        accessibilityLabel={'Dia '+cell.day+' de '+monthName(calendarMonth)}
                        accessibilityState={{disabled:!cell.enabled,selected:day===cell.key}}
                        disabled={!cell.enabled}
                        onPress={()=>{
                          setDay(cell.key);
                          setSlot(null);
                          setSaveError('');
                        }}
                        style={[s.dayCircle,day===cell.key&&s.daySelected]}>
                        <Text style={[s.dayLabel,!cell.enabled&&s.dayDisabled,
                          day===cell.key&&s.dayLabelSelected]}>{cell.day}</Text>
                      </TouchableOpacity>}
                    </View>)}
                </View>
              </View>
              <View style={s.chosenDateRow}>
                <Ionicons name="calendar-outline" size={17} color={C.mocha}/>
                <Text style={s.chosenDateText}>
                  {dayValid?'Data selecionada: '+dayLabel(day):'Selecione uma data válida'}
                </Text>
              </View>
              {!dayValid&&<Text style={s.error}>Escolha uma data válida nos próximos 90 dias.</Text>}
              <View style={s.availabilityHeader}>
                <Text style={s.inputLabel}>Horários disponíveis</Text>
                <TouchableOpacity accessibilityRole="button" onPress={()=>setSlotRefresh(v=>v+1)}
                  disabled={slotsLoading} accessibilityLabel="Atualizar horários">
                  <Ionicons name="refresh-outline" size={20} color={C.mocha}/>
                </TouchableOpacity>
              </View>
              {slotsLoading&&<ActivityIndicator color={C.mocha} style={{marginVertical:15}}/>}
              {!!slotsError&&<Text style={s.error}>{slotsError}</Text>}
              {!slotsLoading&&!slotsError&&dayValid&&!slots.length&&
                <Text style={s.emptyTimes}>Nenhum horário livre neste dia. Experimente outra data.</Text>}
              <View style={s.slots}>
                {slots.map(time=><TouchableOpacity key={time.starts_at}
                  accessibilityRole="button" accessibilityState={{selected:slot===time.starts_at}}
                  style={[s.timeChip,slot===time.starts_at&&s.timeChipActive]}
                  onPress={()=>{setSlot(time.starts_at);setSaveError('');}}>
                  <Text style={[s.timeText,slot===time.starts_at&&s.selectedText]}>
                    {clock.format(new Date(time.starts_at))}
                  </Text>
                </TouchableOpacity>)}
              </View>
              <View style={s.noteBox}>
                <Ionicons name="information-circle-outline" size={18} color={C.mocha}/>
                <Text style={s.helper}>
                  Respeita o buffer de 15 minutos. Terça e quinta: até 18h.
                  Quarta, sexta e sábado: último início às 20h. Horário de Brasília.
                </Text>
              </View>
              {!!saveError&&<Text style={s.error}>{saveError}</Text>}
            </>}
            {step===3&&<>
              <View style={s.sectionHeading}>
                <Ionicons name="checkmark-circle-outline" size={23} color={C.mocha}/>
                <View style={{flex:1}}>
                  <Text style={s.sectionTitle}>Confira a reserva</Text>
                  <Text style={s.helper}>Confirme os dados antes de registrar.</Text>
                </View>
              </View>
              <View style={s.reviewCard}>
                {[
                  ['person-outline','Cliente',selectedClient?.full_name||'—'],
                  ['sparkles-outline','Serviço',selectedService?.name||'—'],
                  ['time-outline','Data e horário',slot?fullDate.format(new Date(slot))+' · Brasília':'—'],
                  ['cash-outline','Valor',money(selectedService?.price)],
                  ['hourglass-outline','Duração',selectedService?.duration_minutes+' minutos'],
                ].map(([icon,label,value])=><View key={label} style={s.reviewRow}>
                  <Ionicons name={icon} size={20} color={C.mocha}/>
                  <View style={{flex:1,minWidth:0}}>
                    <Text style={s.reviewLabel}>{label}</Text>
                    <Text style={s.reviewValue}>{value}</Text>
                  </View>
                </View>)}
              </View>
              <Text style={s.inputLabel}>Observações (opcional)</Text>
              <TextInput multiline maxLength={400} style={s.notes}
                value={notes} onChangeText={setNotes}
                textAlignVertical="top" placeholder="Ex.: preferência da cliente"
                placeholderTextColor={C.muted}
                accessibilityLabel="Observações do agendamento"/>
              <Text style={s.smallHint}>
                Agendamento manual será confirmado com o preço atual do serviço,
                sem desconto de TR Points.
              </Text>
              {!!saveError&&<Text style={s.error}>{saveError}</Text>}
            </>}
          </>}
        </ScrollView>

        <View style={s.footer}>
          {done?<>
            <TouchableOpacity onPress={restart} accessibilityRole="button"
              style={s.secondaryButton}>
              <Text style={s.secondaryButtonText}>Agendar outra</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{onShowAgenda();close();}}
              accessibilityRole="button" style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Ver agenda</Text>
              <Ionicons name="arrow-forward" size={18} color={C.white}/>
            </TouchableOpacity>
          </>:confirmClose?<>
            <TouchableOpacity onPress={()=>setConfirmClose(false)}
              style={s.secondaryButton} accessibilityRole="button">
              <Text style={s.secondaryButtonText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} style={s.primaryButton}
              accessibilityRole="button">
              <Text style={s.primaryButtonText}>Descartar</Text>
            </TouchableOpacity>
          </>:<>
            <TouchableOpacity accessibilityRole="button"
              onPress={()=>step===0?setConfirmClose(true):setStep(step-1)}
              disabled={saving} style={s.secondaryButton}>
              <Text style={s.secondaryButtonText}>{step===0?'Cancelar':'Voltar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              disabled={!continueEnabled||saving}
              onPress={()=>step===3?save():setStep(step+1)}
              style={[s.primaryButton,(!continueEnabled||saving)&&s.disabled]}>
              {saving?<ActivityIndicator color={C.white}/>:
                <Text style={s.primaryButtonText}>{step===3?'Confirmar reserva':'Continuar'}</Text>}
              {!saving&&<Ionicons name={step===3?'checkmark':'arrow-forward'}
                size={19} color={C.white}/>}
            </TouchableOpacity>
          </>}
        </View>
      </View>
    </View>
  </Modal>;
}

const s=StyleSheet.create({
  overlay:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(27,20,17,0.62)',padding:14},
  dialog:{width:'100%',maxWidth:560,height:'89%',maxHeight:760,backgroundColor:C.white,
    borderRadius:22,overflow:'hidden',shadowColor:'#2B1C17',shadowOpacity:0.19,
    shadowRadius:22,elevation:12},
  header:{flexDirection:'row',alignItems:'center',padding:18,gap:12,
    borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:'#FDFBF8'},
  iconCircle:{width:43,height:43,backgroundColor:C.nude,borderRadius:13,
    alignItems:'center',justifyContent:'center'},
  title:{fontSize:20,fontWeight:'800',color:C.ink},
  subtitle:{fontSize:11,color:C.mocha,marginTop:4},
  closeButton:{width:37,height:37,alignItems:'center',justifyContent:'center',
    borderRadius:19,backgroundColor:C.soft},
  stepsRow:{flexDirection:'row',justifyContent:'space-between',gap:5,paddingVertical:12,
    paddingHorizontal:13,borderBottomWidth:1,borderBottomColor:C.border},
  stepColumn:{flex:1,alignItems:'center',gap:6},
  stepNumber:{width:27,height:27,borderRadius:14,backgroundColor:C.soft,
    alignItems:'center',justifyContent:'center',borderColor:C.border,borderWidth:1},
  stepNumberActive:{backgroundColor:C.brown,borderColor:C.brown},
  stepNumberText:{fontSize:12,fontWeight:'700',color:C.muted},
  stepNumberTextActive:{color:C.white},
  stepLabel:{fontSize:10,fontWeight:'600',color:C.muted,textAlign:'center'},
  stepLabelActive:{color:C.ink,fontWeight:'800'},
  body:{flex:1,minHeight:0},
  bodyContent:{padding:20,paddingBottom:25},
  sectionHeading:{flexDirection:'row',alignItems:'flex-start',gap:11,marginBottom:17},
  sectionTitle:{fontSize:18,fontWeight:'800',color:C.ink},
  helper:{fontSize:12,color:C.muted,lineHeight:18,marginTop:5,flexShrink:1},
  searchRow:{flexDirection:'row',gap:9,marginBottom:12},
  searchInput:{flex:1,minWidth:0,borderWidth:1,borderColor:C.border,
    borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:C.ink},
  searchButton:{width:48,borderRadius:12,backgroundColor:C.brown,alignItems:'center',justifyContent:'center'},
  selectedSummary:{flexDirection:'row',alignItems:'center',gap:7,
    padding:11,borderRadius:10,backgroundColor:C.greenBg,marginBottom:12},
  selectedSummaryText:{flex:1,color:C.green,fontSize:12,fontWeight:'700'},
  clientRow:{flexDirection:'row',alignItems:'center',gap:11,padding:12,marginBottom:9,
    backgroundColor:C.white,borderRadius:13,borderWidth:1,borderColor:C.border},
  chosenRow:{borderColor:C.gold,backgroundColor:'#FBF4EB',borderWidth:1.5},
  avatar:{width:39,height:39,borderRadius:20,backgroundColor:C.soft,
    alignItems:'center',justifyContent:'center'},
  serviceRow:{flexDirection:'row',alignItems:'center',gap:12,padding:13,marginBottom:10,
    borderColor:C.border,borderWidth:1,borderRadius:13},
  serviceIcon:{width:43,height:43,borderRadius:12,backgroundColor:C.nude,
    alignItems:'center',justifyContent:'center'},
  serviceEmoji:{fontSize:23},
  clientName:{color:C.ink,fontWeight:'700',fontSize:14},
  clientSub:{color:C.muted,fontSize:12,marginTop:4},
  inputLabel:{fontSize:13,fontWeight:'700',color:C.ink,marginBottom:8},
  calendar:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:18,padding:14,marginBottom:10},
  calendarHeader:{flexDirection:'row',justifyContent:'space-between',
    alignItems:'center',marginBottom:13},
  monthArrow:{width:34,height:34,alignItems:'center',justifyContent:'center'},
  monthTitle:{fontSize:14,fontWeight:'700',color:C.ink},
  dayGrid:{flexDirection:'row',flexWrap:'wrap'},
  dayCell:{width:'14.2857%',height:43,alignItems:'center',justifyContent:'center'},
  weekday:{fontSize:11,fontWeight:'600',color:C.muted},
  dayCircle:{width:35,height:35,borderRadius:18,alignItems:'center',justifyContent:'center'},
  daySelected:{backgroundColor:C.brown},
  dayLabel:{fontSize:13,fontWeight:'500',color:C.ink},
  dayDisabled:{color:'#C9C0B8'},
  dayLabelSelected:{color:C.white,fontWeight:'700'},
  chosenDateRow:{flexDirection:'row',alignItems:'center',gap:8,
    paddingHorizontal:6,marginBottom:19},
  chosenDateText:{fontSize:12,fontWeight:'600',color:C.mocha},
  selectedText:{color:C.white},
  availabilityHeader:{flexDirection:'row',justifyContent:'space-between',
    alignItems:'center',marginBottom:9},
  slots:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16},
  timeChip:{minWidth:69,alignItems:'center',borderWidth:1,borderColor:C.border,
    backgroundColor:C.white,borderRadius:10,paddingVertical:11,paddingHorizontal:12},
  timeChipActive:{backgroundColor:C.brown,borderColor:C.brown},
  timeText:{fontSize:13,fontWeight:'700',color:C.mocha},
  noteBox:{flexDirection:'row',alignItems:'flex-start',gap:9,
    borderRadius:12,padding:12,backgroundColor:C.soft},
  emptyTimes:{fontSize:13,color:C.muted,lineHeight:20,paddingVertical:18},
  reviewCard:{borderWidth:1,borderColor:C.border,borderRadius:16,
    backgroundColor:C.soft,padding:15,marginBottom:20},
  reviewRow:{flexDirection:'row',gap:11,paddingVertical:9},
  reviewLabel:{color:C.muted,fontSize:11,fontWeight:'600'},
  reviewValue:{color:C.ink,fontSize:14,fontWeight:'700',marginTop:4},
  notes:{borderColor:C.border,borderWidth:1,borderRadius:12,padding:13,
    minHeight:88,fontSize:14,color:C.ink},
  smallHint:{fontSize:11,color:C.muted,lineHeight:17,marginTop:12},
  error:{fontSize:12,color:C.red,marginVertical:10,lineHeight:18},
  footer:{paddingHorizontal:17,paddingVertical:15,flexDirection:'row',gap:10,
    borderTopWidth:1,borderTopColor:C.border,backgroundColor:'#FDFBF8'},
  secondaryButton:{flex:1,alignItems:'center',justifyContent:'center',
    borderRadius:11,borderWidth:1,borderColor:C.border,paddingVertical:14},
  secondaryButtonText:{fontWeight:'700',fontSize:13,color:C.mocha},
  primaryButton:{flex:1.45,flexDirection:'row',alignItems:'center',justifyContent:'center',
    gap:8,backgroundColor:C.brown,borderRadius:11,paddingVertical:14},
  primaryButtonText:{color:C.white,fontWeight:'700',fontSize:13},
  disabled:{opacity:.43},
  successContent:{alignItems:'center',paddingVertical:34},
  successIcon:{width:70,height:70,borderRadius:35,backgroundColor:C.green,
    justifyContent:'center',alignItems:'center',marginBottom:16},
  successTitle:{fontSize:21,fontWeight:'800',color:C.ink,marginBottom:12},
  successInfo:{fontSize:16,color:C.ink,fontWeight:'700',textAlign:'center',marginBottom:6},
  successMeta:{fontSize:13,color:C.mocha,textAlign:'center',marginTop:7},
  successHint:{fontSize:12,color:C.muted,textAlign:'center',lineHeight:20,marginTop:19},
  confirmExit:{paddingVertical:24},
});
