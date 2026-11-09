import React,{useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Switch,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#2C2C2C',mocha:'#7A655B',muted:'#766B65',white:'#FFFFFF',border:'#EBE5DF',soft:'#F3EDE7',green:'#26734D',red:'#B24149'};
const fields=[
  ['silver_points','Nível Prata · pontos acumulados'],
  ['gold_points','Nível Ouro · pontos acumulados'],
  ['referral_bonus','Bônus por indicação concluída'],
  ['birthday_bonus','Bônus de aniversário'],
  ['frequency_bonus','Bônus de frequência'],
  ['frequency_every','A cada quantos atendimentos pagos']
];
const toggles=[
  ['referrals_enabled','Ativar bônus por indicação'],
  ['birthday_enabled','Ativar bônus de aniversário'],
  ['frequency_enabled','Ativar bônus por frequência']
];
export default function VipAdminSettings(){
  const [draft,setDraft]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  useEffect(()=>{
    supabase.from('vip_settings').select('*').eq('id',1).single()
      .then(({data,error})=>{
        if(error){setError(error.message);return;}
        setDraft(Object.fromEntries([...fields.map(([key])=>[key,String(data[key]||0)]),
          ...toggles.map(([key])=>[key,!!data[key]])]));
      });
  },[]);
  async function save(){
    if(!draft||busy)return;
    const values={};
    for(const [key] of fields){
      const str=String(draft[key]||'').trim();
      if(!/^\d+$/.test(str)){setError('Preencha todos os valores com números inteiros.');return;}
      values[key]=Number(str);
    }
    if(values.silver_points<1||values.gold_points<=values.silver_points){
      setError('Nível Ouro deve exigir mais pontos que Prata.');return;
    }
    if(values.frequency_every<2||values.frequency_every>30||
       ['referral_bonus','birthday_bonus','frequency_bonus'].some(key=>values[key]>10000)){
      setError('Bônus até 10.000 pontos; frequência de 2 a 30 atendimentos.');return;
    }
    toggles.forEach(([key])=>values[key]=!!draft[key]);
    setBusy(true);setError('');setMessage('');
    try{
      const {data,error}=await supabase.from('vip_settings').update(values)
        .eq('id',1).select('id').single();
      if(error)throw error;
      if(!data)throw new Error('A alteração não foi confirmada.');
      setMessage('Regras do Clube VIP atualizadas.');
    }catch(e){setError('Erro ao salvar: '+e.message);}
    finally{setBusy(false);}
  }
  return <View style={s.wrap}>
    <View style={s.heading}><Ionicons name="ribbon-outline" color={C.mocha} size={24}/>
      <Text style={s.title}>Clube VIP · Regras e recompensas</Text></View>
    <Text style={s.hint}>Defina os níveis e campanhas. Os pontos já existentes continuam válidos.
      Os níveis usam o total histórico de pontos ganhos, mesmo após resgates.</Text>
    {!draft?<ActivityIndicator color={C.mocha} style={{margin:25}}/>:<>
      {fields.map(([key,label])=><View style={s.field} key={key}>
        <Text style={s.label}>{label}</Text>
        <TextInput keyboardType="number-pad" value={draft[key]}
          onChangeText={value=>setDraft(old=>({...old,[key]:value.replace(/\D/g,'')}))}
          maxLength={6} style={s.input}/>
      </View>)}
      <Text style={s.section}>Campanhas automáticas</Text>
      {toggles.map(([key,label])=><View style={s.switchRow} key={key}>
        <Text style={[s.label,{flex:1}]}>{label}</Text>
        <Switch value={draft[key]} onValueChange={val=>setDraft(old=>({...old,[key]:val}))}
          trackColor={{false:'#CBC1B9',true:C.mocha}}/>
      </View>)}
      <Text style={s.hint}>Por segurança, as campanhas começam desativadas. Ao ativar, os bônus são
        concedidos somente em atendimentos pagos e concluídos após a ativação. As regras
        de prevenção de indicações indevidas e prêmios duplicados continuam valendo.</Text>
      {!!error&&<Text style={s.error}>{error}</Text>}
      {!!message&&<Text style={s.success}>{message}</Text>}
      <TouchableOpacity style={[s.button,busy&&{opacity:.5}]} onPress={save} disabled={busy}>
        {busy?<ActivityIndicator color={C.white}/>:<Text style={s.buttonLabel}>Salvar regras do Clube VIP</Text>}
      </TouchableOpacity>
    </>}
  </View>;
}
const s=StyleSheet.create({
  wrap:{backgroundColor:C.white,borderRadius:15,borderWidth:1,borderColor:C.border,padding:18,gap:12,marginTop:20},
  heading:{flexDirection:'row',alignItems:'center',gap:9},
  title:{fontSize:18,fontWeight:'700',color:C.ink,flex:1},
  hint:{fontSize:12,color:C.muted,lineHeight:19},
  field:{gap:5},label:{fontSize:13,fontWeight:'600',color:C.ink},
  input:{borderWidth:1,borderColor:C.border,borderRadius:9,padding:12,color:C.ink},
  section:{fontWeight:'700',fontSize:15,color:C.ink,marginTop:5},
  switchRow:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:5},
  button:{backgroundColor:C.ink,padding:15,alignItems:'center',borderRadius:10},
  buttonLabel:{color:C.white,fontWeight:'700',fontSize:13},
  error:{color:C.red,fontSize:12},success:{color:C.green,fontSize:12}
});
