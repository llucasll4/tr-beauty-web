import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#30231E',mocha:'#7A655B',muted:'#756B65',white:'#FFFFFF',
  border:'#E6DDD5',soft:'#F5EFE8',red:'#AA4348',green:'#26734D'};
const statusName={draft:'Rascunho',published:'Publicada no aplicativo',archived:'Arquivada'};
const formatDate=value=>value?new Date(value).toLocaleDateString('pt-BR',{
  timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
}):'—';
const clean=str=>String(str||'').trim();

export default function AdminCampaigns({onBack}){
  const [campaigns,setCampaigns]=useState([]);
  const [summary,setSummary]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [cta,setCta]=useState('book');
  const [days,setDays]=useState(30);
  const [confirm,setConfirm]=useState(null);
  const inFlight=useRef(false);
  const mounted=useRef(true);

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [campaignResult,summaryResult]=await Promise.all([
        supabase.from('marketing_campaigns')
          .select('id,title,body,cta,status,duration_days,created_at,published_at,expires_at')
          .order('created_at',{ascending:false}).limit(40),
        supabase.rpc('p4_marketing_summary'),
      ]);
      if(campaignResult.error)throw campaignResult.error;
      if(summaryResult.error)throw summaryResult.error;
      if(mounted.current){
        setCampaigns(campaignResult.data||[]);
        setSummary(summaryResult.data||null);
      }
    }catch(e){
      if(mounted.current){
        setCampaigns([]);setSummary(null);
        setError('Não foi possível consultar as campanhas: '+(e?.message||'erro desconhecido'));
      }
    }finally{if(mounted.current)setLoading(false);}
  },[]);
  useEffect(()=>{
    mounted.current=true;refresh();
    return()=>{mounted.current=false;};
  },[refresh]);

  async function saveDraft(){
    if(inFlight.current||saving)return;
    const t=clean(title),b=clean(body);
    if(t.length<5||t.length>90||b.length<15||b.length>550){
      setError('Informe título de 5 a 90 caracteres e texto de 15 a 550 caracteres.');
      return;
    }
    inFlight.current=true;setSaving(true);setError('');setNotice('');
    try{
      const {error:failure}=await supabase.from('marketing_campaigns')
        .insert({title:t,body:b,cta,duration_days:days});
      if(failure)throw failure;
      setTitle('');setBody('');setCta('book');setDays(30);
      setNotice('Rascunho salvo. Nenhuma cliente recebeu uma mensagem.');
      await refresh();
    }catch(e){
      setError('Não foi possível salvar o rascunho: '+(e?.message||'erro desconhecido'));
    }finally{inFlight.current=false;setSaving(false);}
  }

  async function changeStatus(row,next){
    if(inFlight.current||saving)return;
    inFlight.current=true;setSaving(true);setError('');setNotice('');
    try{
      const {data:updated,error:failure}=await supabase.from('marketing_campaigns')
        .update({status:next}).eq('id',row.id).eq('status',row.status)
        .select('id,status').maybeSingle();
      if(failure)throw failure;
      if(!updated)throw new Error('Campanha já foi alterada. Atualize o painel.');
      setConfirm(null);
      setNotice(next==='published'
        ? 'Novidade publicada apenas dentro do aplicativo para quem autorizou.'
        : 'Campanha arquivada. Ela não aparece mais para as clientes.');
      await refresh();
    }catch(e){
      setError('Não foi possível alterar a campanha: '+(e?.message||'erro desconhecido'));
    }finally{inFlight.current=false;setSaving(false);}
  }

  const validDraft=clean(title).length>=5&&clean(title).length<=90&&
    clean(body).length>=15&&clean(body).length<=550;
  return <View style={s.root}>
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar às configurações"
        onPress={onBack} style={s.iconButton}>
        <Ionicons name="arrow-back-outline" size={21} color={C.mocha}/>
      </TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={s.title}>Campanhas de relacionamento</Text>
        <Text style={s.note}>Publicações no aplicativo, mediante consentimento</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar campanhas"
        disabled={loading||saving} onPress={refresh} style={s.iconButton}>
        <Ionicons name="refresh-outline" size={20} color={C.mocha}/>
      </TouchableOpacity>
    </View>

    <View style={s.info}>
      <Ionicons name="shield-checkmark-outline" color={C.mocha} size={22}/>
      <Text style={[s.note,{flex:1}]}>
        Campanhas são exibidas exclusivamente na Home de clientes que ativaram
        “Novidades e promoções”. A autorização pode ser retirada a qualquer momento.
        Nenhum e-mail, WhatsApp, push ou reserva é enviado/criado por este módulo.
      </Text>
    </View>
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!!notice&&<Text style={s.good}>{notice}</Text>}
    {loading&&<View style={s.loading}><ActivityIndicator color={C.mocha}/>
      <Text style={s.note}>Consultando permissões e campanhas...</Text>
    </View>}
    {!loading&&summary&&<View style={s.stats}>
      <View style={s.stat}>
        <Text style={s.statNumber}>{Number(summary.consented||0)}</Text>
        <Text style={s.note}>Clientes com autorização atual</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statNumber}>{Number(summary.published||0)}</Text>
        <Text style={s.note}>Campanhas ativas no aplicativo</Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statNumber}>{Number(summary.drafts||0)}</Text>
        <Text style={s.note}>Rascunhos</Text>
      </View>
    </View>}

    <View style={s.panel}>
      <Text style={s.section}>Criar campanha</Text>
      <Text style={s.note}>
        Salve um rascunho, confira o conteúdo e publique manualmente.
        A campanha não aparece para clientes antes da publicação.
      </Text>
      <TextInput accessibilityLabel="Título da campanha" style={s.input}
        value={title} onChangeText={setTitle} placeholder="Ex.: Um carinho especial para suas unhas"
        maxLength={90} editable={!saving}/>
      <TextInput accessibilityLabel="Texto da campanha" style={[s.input,s.multiline]}
        value={body} onChangeText={setBody} multiline numberOfLines={4}
        placeholder="Descreva a novidade, sem prometer descontos que não foram configurados."
        maxLength={550} editable={!saving}/>
      <Text style={s.inputLabel}>Duração após publicar</Text>
      <View style={s.choices}>
        {[7,14,30,60].map(d=><TouchableOpacity key={d} accessibilityRole="button"
          accessibilityLabel={'Duração de '+d+' dias'}
          accessibilityState={{selected:days===d}}
          disabled={saving} onPress={()=>setDays(d)}
          style={[s.chip,days===d&&s.selected]}>
          <Text style={[s.chipText,days===d&&s.selectedText]}>{d} dias</Text>
        </TouchableOpacity>)}
      </View>
      <Text style={s.inputLabel}>Ação apresentada à cliente</Text>
      <View style={s.choices}>
        {[['book','Ver serviços e horários'],['none','Apenas informativo']].map(([value,label])=>
          <TouchableOpacity key={value} accessibilityRole="button"
            accessibilityLabel={'Ação '+label} accessibilityState={{selected:cta===value}}
            disabled={saving} onPress={()=>setCta(value)}
            style={[s.chip,cta===value&&s.selected]}>
            <Text style={[s.chipText,cta===value&&s.selectedText]}>{label}</Text>
          </TouchableOpacity>)}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Salvar campanha como rascunho"
        disabled={!validDraft||saving} onPress={saveDraft}
        style={[s.primary,(!validDraft||saving)&&s.disabled]}>
        <Text style={s.primaryText}>{saving?'Salvando...':'Salvar rascunho'}</Text>
      </TouchableOpacity>
    </View>

    <View style={s.panel}>
      <Text style={s.section}>Histórico de campanhas</Text>
      <Text style={s.note}>
        Até 40 campanhas recentes. Após publicar, o texto fica congelado;
        para corrigir, arquive e crie outra.
      </Text>
      {!loading&&campaigns.length===0&&<Text style={s.note}>
        Nenhuma campanha cadastrada.
      </Text>}
      {campaigns.map(row=><View key={row.id} style={s.campaign}>
        <Text style={s.campaignTitle}>{row.title}</Text>
        <Text style={s.note}>{statusName[row.status]||row.status} · {row.duration_days} dias</Text>
        <Text style={s.campaignBody}>{row.body}</Text>
        {row.status==='published'&&<Text style={s.note}>
          Visível até {formatDate(row.expires_at)}, para clientes autorizadas.
        </Text>}
        {row.status==='draft'&&<TouchableOpacity accessibilityRole="button"
          accessibilityLabel={'Publicar campanha '+row.title}
          onPress={()=>setConfirm({id:row.id,status:'published'})}
          disabled={saving} style={s.secondary}>
          <Text style={s.secondaryText}>Revisar e publicar</Text>
        </TouchableOpacity>}
        {row.status==='published'&&<TouchableOpacity accessibilityRole="button"
          accessibilityLabel={'Arquivar campanha '+row.title}
          onPress={()=>setConfirm({id:row.id,status:'archived'})}
          disabled={saving} style={s.secondary}>
          <Text style={s.secondaryText}>Arquivar</Text>
        </TouchableOpacity>}
        {confirm?.id===row.id&&<View style={s.confirm}>
          <Text style={s.confirmTitle}>
            {confirm.status==='published'?'Confirmar publicação dentro do aplicativo?'
              :'Arquivar esta campanha agora?'}
          </Text>
          <Text style={s.note}>
            {confirm.status==='published'
              ? 'A novidade aparecerá apenas para clientes que autorizaram. Não haverá envio de mensagens.'
              : 'A novidade deixará de ser mostrada na Home. O histórico será preservado.'}
          </Text>
          <View style={s.actions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancelar ação da campanha"
              style={s.secondary} onPress={()=>setConfirm(null)} disabled={saving}>
              <Text style={s.secondaryText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={confirm.status==='published'?'Confirmar publicação da campanha':'Confirmar arquivamento da campanha'}
              style={s.primary} onPress={()=>changeStatus(row,confirm.status)} disabled={saving}>
              <Text style={s.primaryText}>{saving?'Salvando...':'Confirmar'}</Text>
            </TouchableOpacity>
          </View>
        </View>}
      </View>)}
    </View>
  </View>;
}

const s=StyleSheet.create({
  root:{gap:13,paddingBottom:30},
  header:{flexDirection:'row',alignItems:'center',gap:10},
  iconButton:{width:44,height:44,borderRadius:11,backgroundColor:C.white,
    borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  title:{fontSize:19,fontWeight:'800',color:C.ink},
  section:{fontSize:17,fontWeight:'700',color:C.ink},
  note:{fontSize:11,lineHeight:18,color:C.muted},
  info:{flexDirection:'row',alignItems:'flex-start',gap:11,
    backgroundColor:C.soft,padding:15,borderRadius:12},
  error:{fontSize:12,color:C.red,lineHeight:20,padding:11},
  good:{fontSize:12,color:C.green,lineHeight:20,padding:11},
  loading:{alignItems:'center',padding:18,gap:10},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:8},
  stat:{minWidth:94,flexGrow:1,flexBasis:'27%',padding:12,backgroundColor:C.white,
    borderWidth:1,borderColor:C.border,borderRadius:12},
  statNumber:{fontSize:23,fontWeight:'800',color:C.ink},
  panel:{padding:16,backgroundColor:C.white,borderWidth:1,borderColor:C.border,
    borderRadius:13,gap:12},
  input:{minHeight:44,borderWidth:1,borderColor:C.border,borderRadius:11,
    fontSize:13,color:C.ink,paddingHorizontal:11,paddingVertical:9},
  multiline:{minHeight:96,textAlignVertical:'top'},
  inputLabel:{fontSize:12,fontWeight:'700',color:C.ink},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{minHeight:44,paddingHorizontal:11,paddingVertical:11,borderRadius:11,
    borderWidth:1,borderColor:C.border,justifyContent:'center'},
  selected:{backgroundColor:C.mocha,borderColor:C.mocha},
  chipText:{color:C.mocha,fontSize:12,fontWeight:'700'},
  selectedText:{color:C.white},
  primary:{backgroundColor:C.mocha,borderRadius:11,minHeight:44,
    paddingHorizontal:15,paddingVertical:12,justifyContent:'center',
    alignItems:'center'},
  primaryText:{color:C.white,fontWeight:'700',fontSize:12},
  disabled:{opacity:.5},
  secondary:{minHeight:44,borderWidth:1,borderColor:C.border,borderRadius:11,
    paddingHorizontal:12,paddingVertical:11,alignItems:'center',justifyContent:'center'},
  secondaryText:{color:C.mocha,fontSize:12,fontWeight:'700'},
  campaign:{borderTopWidth:1,borderColor:C.border,gap:8,paddingTop:14},
  campaignTitle:{color:C.ink,fontWeight:'800',fontSize:15},
  campaignBody:{fontSize:13,color:C.ink,lineHeight:20},
  confirm:{backgroundColor:C.soft,borderRadius:12,padding:12,gap:8},
  confirmTitle:{fontSize:13,fontWeight:'700',color:C.ink},
  actions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-end',gap:8},
});
