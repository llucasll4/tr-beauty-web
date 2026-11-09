import React, {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#2C2C2C',mocha:'#7A655B',muted:'#766B65',white:'#FFFFFF',border:'#EBE5DF',soft:'#F3EDE7',green:'#26734D',red:'#B24149'};
const digits=n=>Number(n||0).toLocaleString('pt-BR');
export default function VipClub(){
  const [config,setConfig]=useState(null);
  const [stats,setStats]=useState(null);
  const [myCode,setMyCode]=useState('');
  const [claim,setClaim]=useState('');
  const [birthMonth,setBirthMonth]=useState('');
  const [birthDay,setBirthDay]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  async function load(){
    setError('');setLoading(true);
    try{
      const [settings,overview,code]=await Promise.all([
        supabase.from('vip_settings').select('*').eq('id',1).single(),
        supabase.rpc('get_my_vip_summary'),
        supabase.rpc('my_referral_code')
      ]);
      if(settings.error)throw settings.error;
      if(overview.error)throw overview.error;
      if(code.error)throw code.error;
      setConfig(settings.data);setStats(overview.data);setMyCode(code.data||'');
    }catch(e){setError('Não foi possível abrir o Clube VIP: '+e.message);}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  const lifetime=Number(stats?.lifetime_points||0);
  const silver=Number(config?.silver_points||500),gold=Number(config?.gold_points||1500);
  const tier=lifetime>=gold?'Ouro':lifetime>=silver?'Prata':'Bronze';
  const next=tier==='Bronze'?silver:tier==='Prata'?gold:null;
  const start=tier==='Bronze'?0:tier==='Prata'?silver:gold;
  const pct=next?Math.min(100,(lifetime-start)/(next-start)*100):100;
  async function saveBirthday(){
    const month=Number(birthMonth),day=Number(birthDay);
    if(!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||
      day<1||day>31||!Number.isFinite(new Date(2000,month-1,day).getTime())||
      new Date(2000,month-1,day).getMonth()!==month-1){
      setError('Informe um dia e mês válidos.');return;
    }
    setBusy(true);setError('');setMessage('');
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();
      if(authError||!user)throw authError||new Error('Faça login');
      const {error}=await supabase.from('customer_birthdays').insert({
        user_id:user.id,birth_month:month,birth_day:day
      });
      if(error)throw error;
      setMessage('Aniversário cadastrado. Por segurança, alterações posteriores são feitas pelo estúdio.');
      await load();
    }catch(e){setError('Não foi possível salvar a data: '+e.message);}
    finally{setBusy(false);}
  }
  async function claimReferral(){
    if(busy||!claim.trim())return;
    setBusy(true);setError('');setMessage('');
    try{
      const {data,error}=await supabase.rpc('claim_referral',{p_code:claim.trim().toUpperCase()});
      if(error)throw error;
      setMessage(String(data||'Indicação vinculada!'));setClaim('');await load();
    }catch(e){setError('Não foi possível usar o código: '+e.message);}
    finally{setBusy(false);}
  }
  return <View style={s.wrap}>
    <View style={s.heading}>
      <Ionicons name="diamond-outline" size={24} color={C.mocha}/>
      <Text style={s.title}>Clube TR Points VIP</Text>
    </View>
    {loading?<ActivityIndicator color={C.mocha} style={{padding:22}}/>:config&&stats&&<>
      <View style={s.tierCard}>
        <View style={s.tierTop}>
          <Text style={s.small}>SEU NÍVEL ATUAL</Text>
          <Ionicons name={tier==='Ouro'?'trophy-outline':'ribbon-outline'} size={26} color={C.mocha}/>
        </View>
        <Text style={s.tier}>{tier} {tier==='Ouro'?'🏆':tier==='Prata'?'🌟':'💅'}</Text>
        <Text style={s.text}>{digits(lifetime)} pontos acumulados ao longo do programa</Text>
        <View style={s.bar}><View style={[s.barFill,{width:pct+'%'}]}/></View>
        <Text style={s.small}>{next
          ?'Faltam '+digits(Math.max(0,next-lifetime))+' pontos acumulados para o nível '+(tier==='Bronze'?'Prata':'Ouro')
          :'Você alcançou o nível mais alto do clube!'}</Text>
      </View>
      <View style={s.benefits}>
        <Text style={s.sectionTitle}>Suas vantagens</Text>
        <View style={s.benefitRow}><Ionicons name="gift-outline" size={20} color={C.mocha}/>
          <Text style={s.benefitText}>Aniversário: {config.birthday_enabled?
            '+'+digits(config.birthday_bonus)+' pontos no mês do aniversário, após um atendimento elegível':
            'Campanha aguardando ativação pelo estúdio'}</Text></View>
        <View style={s.benefitRow}><Ionicons name="people-outline" size={20} color={C.mocha}/>
          <Text style={s.benefitText}>Indicações: {config.referrals_enabled?
            '+'+digits(config.referral_bonus)+' pontos quando a indicada conclui o primeiro serviço pago':
            'Campanha aguardando ativação pelo estúdio'}</Text></View>
        <View style={s.benefitRow}><Ionicons name="repeat-outline" size={20} color={C.mocha}/>
          <Text style={s.benefitText}>Frequência: {config.frequency_enabled?
            '+'+digits(config.frequency_bonus)+' pontos a cada '+digits(config.frequency_every)+' atendimentos pagos':
            'Campanha aguardando ativação pelo estúdio'}</Text></View>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Indique e ganhe</Text>
        <Text style={s.text}>Compartilhe seu código com alguém que ainda não realizou um atendimento.</Text>
        <View style={s.code}><Text selectable style={s.codeText}>{myCode||'Indisponível'}</Text></View>
        <Text style={s.small}>Indicações premiadas: {digits(stats.successful_referrals)}. O bônus só é aplicado quando a campanha está ativa e a indicada conclui o primeiro atendimento pago.</Text>
        <Text style={[s.sectionTitle,{marginTop:20}]}>Tenho um código de indicação</Text>
        <View style={s.row}>
          <TextInput value={claim} onChangeText={setClaim} autoCapitalize="characters"
            placeholder="Código de 8 caracteres" maxLength={8} style={[s.input,{flex:1,minWidth:0}]}/>
          <TouchableOpacity onPress={claimReferral} disabled={busy||claim.length!==8} style={s.button}>
            <Text style={s.buttonText}>Aplicar</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.small}>Vincule o código antes do seu primeiro atendimento. Telefones distintos são exigidos para reduzir indicações indevidas.</Text>
      </View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Seu aniversário 🎂</Text>
        {stats.birthday_month?<Text style={s.text}>Registrado: {String(stats.birthday_day).padStart(2,'0')}/{String(stats.birthday_month).padStart(2,'0')}. Para corrigir, procure o estúdio.</Text>:<>
          <Text style={s.text}>Informe apenas dia e mês. A data pode ser registrada uma vez e não fica pública.</Text>
          <View style={s.row}>
            <TextInput keyboardType="number-pad" placeholder="Dia" value={birthDay}
              onChangeText={setBirthDay} maxLength={2} style={[s.input,{width:90}]}/>
            <TextInput keyboardType="number-pad" placeholder="Mês" value={birthMonth}
              onChangeText={setBirthMonth} maxLength={2} style={[s.input,{width:90}]}/>
            <TouchableOpacity style={s.button} onPress={saveBirthday} disabled={busy}>
              <Text style={s.buttonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.small}>Para receber eventual bônus de aniversário, a data deve estar cadastrada há pelo menos 30 dias e a campanha precisa estar ativada.</Text>
        </>}
      </View>
    </>}
    {!!message&&<Text style={s.success}>{message}</Text>}
    {!!error&&<Text style={s.error}>{error}</Text>}
  </View>;
}
const s=StyleSheet.create({
  wrap:{gap:14,marginBottom:10},
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  title:{color:C.ink,fontSize:19,fontWeight:'700'},
  tierCard:{backgroundColor:C.soft,borderRadius:18,padding:22,gap:9},
  tierTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  tier:{color:C.ink,fontSize:32,fontWeight:'700'},
  text:{color:C.muted,fontSize:13,lineHeight:21,marginBottom:7},
  small:{fontSize:11,lineHeight:18,color:C.muted},
  bar:{height:9,borderRadius:5,overflow:'hidden',backgroundColor:'#D8CDC2',marginVertical:12},
  barFill:{backgroundColor:C.mocha,height:9},
  benefits:{backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.border,padding:17,gap:12},
  section:{backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.border,padding:17},
  sectionTitle:{color:C.ink,fontSize:16,fontWeight:'700',marginBottom:12},
  benefitRow:{flexDirection:'row',gap:11,alignItems:'center'},
  benefitText:{fontSize:12,lineHeight:19,color:C.muted,flex:1},
  code:{backgroundColor:C.soft,padding:16,borderRadius:11,alignSelf:'flex-start',marginVertical:10},
  codeText:{fontWeight:'800',letterSpacing:3,color:C.mocha,fontSize:19},
  row:{flexDirection:'row',gap:9,alignItems:'center',flexWrap:'wrap'},
  input:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:12,color:C.ink,fontSize:13},
  button:{backgroundColor:C.ink,paddingVertical:13,paddingHorizontal:17,borderRadius:10},
  buttonText:{fontSize:12,fontWeight:'700',color:C.white},
  error:{color:C.red,fontSize:12,lineHeight:19},
  success:{color:C.green,fontSize:12,lineHeight:19},
});
