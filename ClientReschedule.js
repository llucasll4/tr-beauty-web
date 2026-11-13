import React, {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';
import {
  brazilClock,buildCalendar,futureDates,monthLabel,offsetMonth,readableDate,
} from './utils/calendar';

const C={
  white:'#FFFFFF',cream:'#FDFBF7',ink:'#30231E',mocha:'#7A655B',
  muted:'#756B65',border:'#E6DDD5',soft:'#F2ECE6',
  green:'#26734D',red:'#A73F46',
};
const NEXT_DATES=futureDates();
const WEEKDAYS=['S','T','Q','Q','S','S','D'];
const WD_ALLOWED=new Set([2,3,4,5,6]);
function weekday(key){return new Date(key+'T12:00:00Z').getUTCDay();}
function accessibleTime(iso){return brazilClock.format(new Date(iso));}

export default function ClientReschedule({appointment,onClose,onSuccess}){
  const days=useMemo(()=>NEXT_DATES.filter(d=>WD_ALLOWED.has(weekday(d.key))),[]);
  const validDays=useMemo(()=>new Set(days.map(d=>d.key)),[days]);
  const [date,setDate]=useState(days[0]?.key||null);
  const [month,setMonth]=useState((days[0]?.key||'').slice(0,7));
  const [slots,setSlots]=useState([]);
  const [chosen,setChosen]=useState(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [slotError,setSlotError]=useState('');
  const [reload,setReload]=useState(0);
  const inFlight=useRef(false);
  const firstMonth=days[0]?.key.slice(0,7);
  const lastMonth=days[days.length-1]?.key.slice(0,7);
  const cells=useMemo(()=>month?buildCalendar(month,validDays,WD_ALLOWED):[],
    [month,validDays]);

  useEffect(()=>{
    let alive=true;
    setChosen(null);setSlots([]);setSlotError('');
    if(!date)return()=>{alive=false;};
    setLoading(true);
    (async()=>{
      try{
        const {data,result,error:rpcError}=await supabase.rpc('available_reschedule_slots',{
          p_appointment_id:appointment.id,p_date:date,
        });
        if(rpcError)throw rpcError;
        if(alive)setSlots(Array.isArray(data)?data:Array.isArray(result)?result:[]);
      }catch(e){
        if(alive)setSlotError('Não conseguimos consultar os horários agora. Escolha outra data ou tente novamente.');
      }finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  },[appointment.id,date,reload]);

  async function confirm(){
    if(inFlight.current||saving||!chosen)return;
    inFlight.current=true;setSaving(true);setError('');
    try{
      const {data:nextId,error:rpcError}=await supabase.rpc('reschedule_appointment',{
        p_appointment_id:appointment.id,p_new_starts_at:chosen,
      });
      if(rpcError)throw rpcError;
      if(!nextId)throw new Error('O servidor não confirmou a nova reserva. Confira seus agendamentos.');
      await onSuccess(chosen);
    }catch(e){
      setError(/TR Points|pontos|saldo/i.test(e?.message||'')
        ? 'Não foi possível manter as condições dos seus TR Points. Fale com o estúdio para reagendar.'
        : 'Não conseguimos mudar o horário. Sua reserva original foi mantida. Tente outra data ou fale com o estúdio.');
      // O horário pode ter sido reservado por outra cliente enquanto era exibido.
      setChosen(null);
      setReload(v=>v+1);
    }finally{inFlight.current=false;setSaving(false);}
  }

  return <View style={s.root}>
    <View style={s.header}>
      <View style={{flex:1}}>
        <Text style={s.title}>Escolha um novo horário</Text>
        <Text style={s.subtitle}>Reserva atual: {readableDate(appointment.starts_at)}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar reagendamento"
        onPress={onClose} disabled={saving} style={s.close}>
        <Ionicons name="close-outline" size={21} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    <Text style={s.note}>Você pode pedir outro horário com pelo menos 24 horas de antecedência.
      O serviço e o valor permanecem os mesmos, e a nova data precisa da confirmação do estúdio.</Text>
    {!!firstMonth&&<View style={s.calendar}>
      <View style={s.monthHead}>
        <TouchableOpacity style={s.arrow} accessibilityRole="button"
          accessibilityLabel="Mês anterior do reagendamento" disabled={month<=firstMonth||saving}
          onPress={()=>setMonth(v=>offsetMonth(v,-1))}>
          <Ionicons name="chevron-back" size={19}
            color={month<=firstMonth?C.border:C.ink}/>
        </TouchableOpacity>
        <Text style={s.monthText}>{monthLabel(month)}</Text>
        <TouchableOpacity style={s.arrow} accessibilityRole="button"
          accessibilityLabel="Próximo mês do reagendamento" disabled={month>=lastMonth||saving}
          onPress={()=>setMonth(v=>offsetMonth(v,1))}>
          <Ionicons name="chevron-forward" size={19}
            color={month>=lastMonth?C.border:C.ink}/>
        </TouchableOpacity>
      </View>
      <View style={s.grid}>
        {WEEKDAYS.map((day,i)=><View key={'wd'+i} style={s.day}>
          <Text style={s.wd}>{day}</Text>
        </View>)}
        {cells.map((cell,i)=><View key={cell?.key||'empty'+i} style={s.day}>
          {cell&&<TouchableOpacity
            style={[s.dayTouch,date===cell.key&&s.dayActive]}
            accessibilityRole="button"
            accessibilityLabel={'Reagendar para dia '+cell.day+' de '+monthLabel(month)}
            accessibilityState={{selected:date===cell.key,disabled:!cell.enabled}}
            disabled={!cell.enabled||saving}
            onPress={()=>{setDate(cell.key);setError('');}}>
            <Text style={[s.dayText,!cell.enabled&&s.dayDisabled,
              date===cell.key&&s.dayTextActive]}>{cell.day}</Text>
          </TouchableOpacity>}
        </View>)}
      </View>
    </View>}
    <Text style={s.section}>Horários disponíveis · Brasília</Text>
    {loading&&<ActivityIndicator color={C.mocha} style={s.loader}/>}
    {!!slotError&&<Text style={s.error}>{slotError}</Text>}
    {!loading&&!slotError&&slots.length===0&&<Text style={s.note}>
      Não há horários livres nesta data. Escolha outro dia.
    </Text>}
    <View style={s.times}>
      {slots.map(slot=><TouchableOpacity key={slot.starts_at}
        accessibilityRole="button"
        accessibilityLabel={'Novo horário '+accessibleTime(slot.starts_at)}
        accessibilityState={{selected:chosen===slot.starts_at}}
        disabled={saving}
        style={[s.time,chosen===slot.starts_at&&s.timeActive]}
        onPress={()=>{setChosen(slot.starts_at);setError('');}}>
        <Text style={[s.timeText,chosen===slot.starts_at&&s.timeTextActive]}>
          {accessibleTime(slot.starts_at)}
        </Text>
      </TouchableOpacity>)}
    </View>
    {chosen&&<View style={s.summary}>
      <Text style={s.summaryText}>Novo horário: {readableDate(chosen)}</Text>
      <Text style={s.note}>Seu horário atual só será substituído se o novo estiver disponível.
        Se você usou TR Points, a pontuação será preservada.</Text>
    </View>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    <View style={s.actions}>
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel="Cancelar escolha de reagendamento"
        onPress={onClose} disabled={saving} style={s.cancel}>
        <Text style={s.cancelText}>Voltar</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button"
        accessibilityLabel="Confirmar reagendamento"
        onPress={confirm} disabled={!chosen||loading||saving}
        style={[s.confirm,(!chosen||loading||saving)&&{opacity:.55}]}>
        {saving?<ActivityIndicator color={C.white}/>:
          <Text style={s.confirmText}>Solicitar novo horário</Text>}
      </TouchableOpacity>
    </View>
  </View>;
}
const s=StyleSheet.create({
  root:{backgroundColor:C.cream,borderWidth:1,borderColor:C.border,
    padding:14,borderRadius:14,marginTop:16,gap:11},
  header:{flexDirection:'row',alignItems:'center',gap:8},
  title:{fontWeight:'700',fontSize:16,color:C.ink},
  subtitle:{fontSize:12,color:C.muted,marginTop:4},
  close:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',
    borderWidth:1,borderColor:C.border,borderRadius:11},
  note:{fontSize:12,lineHeight:19,color:C.muted},
  calendar:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:12,padding:8},
  monthHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    marginBottom:7},
  arrow:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  monthText:{fontSize:14,fontWeight:'700',color:C.ink},
  grid:{flexDirection:'row',flexWrap:'wrap'},
  day:{width:'14.2857%',alignItems:'center',justifyContent:'center',minHeight:44},
  dayTouch:{minWidth:36,minHeight:40,alignItems:'center',justifyContent:'center',
    borderRadius:22},
  dayActive:{backgroundColor:C.mocha},
  dayText:{color:C.ink,fontSize:13},
  dayDisabled:{color:C.border},
  dayTextActive:{color:C.white,fontWeight:'700'},
  wd:{fontSize:11,color:C.muted},
  section:{color:C.ink,fontSize:14,fontWeight:'700',marginTop:3},
  loader:{padding:16},
  times:{flexDirection:'row',flexWrap:'wrap',gap:7},
  time:{minWidth:72,minHeight:44,alignItems:'center',justifyContent:'center',
    backgroundColor:C.white,paddingHorizontal:10,borderWidth:1,borderColor:C.border,
    borderRadius:10},
  timeActive:{backgroundColor:C.mocha,borderColor:C.mocha},
  timeText:{fontSize:13,fontWeight:'700',color:C.mocha},
  timeTextActive:{color:C.white},
  summary:{backgroundColor:C.white,borderRadius:11,padding:12,gap:5},
  summaryText:{fontSize:13,fontWeight:'700',color:C.ink},
  error:{color:C.red,fontSize:12,lineHeight:19},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'flex-end'},
  cancel:{minHeight:44,paddingHorizontal:13,alignItems:'center',justifyContent:'center',
    borderRadius:11,borderWidth:1,borderColor:C.border},
  cancelText:{fontWeight:'700',color:C.mocha,fontSize:13},
  confirm:{minHeight:44,paddingHorizontal:13,alignItems:'center',justifyContent:'center',
    borderRadius:11,backgroundColor:C.mocha},
  confirmText:{fontWeight:'700',color:C.white,fontSize:13}
});
