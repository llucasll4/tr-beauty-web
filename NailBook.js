import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Image,Platform,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={bg:'#FDFBF7',white:'#FFFFFF',ink:'#2C2C2C',mocha:'#7A655B',muted:'#766B65',border:'#EBE5DF',soft:'#F3EDE7',red:'#B24149',green:'#26734D'};
const fmt=d=>d?new Date(d).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
const one=x=>Array.isArray(x)?x[0]:x;
function FileChooser({onPick,disabled=false}){
  if(Platform.OS!=='web')return <Text style={s.helper}>O envio de fotos está disponível no site pelo navegador.</Text>;
  return React.createElement('input',{
    type:'file',accept:'image/jpeg,image/png,image/webp',
    disabled,'aria-label':'Escolher uma foto de unhas',
    onChange:event=>{
      const file=event.target?.files?.[0];
      if(file)onPick(file);
      event.target.value='';
    },
    style:{width:'100%',fontSize:13,color:C.mocha,marginTop:7}
  });
}
export default function NailBook({clientId,adminMode=false,onBack=()=>{},onRepeat=()=>{}}){
  const [target,setTarget]=useState(clientId||null);
  const [clients,setClients]=useState([]);
  const [clientSearch,setClientSearch]=useState('');
  const [entries,setEntries]=useState([]);
  const [services,setServices]=useState([]);
  const [appointments,setAppointments]=useState([]);
  const [images,setImages]=useState({});
  const [title,setTitle]=useState('');
  const [notes,setNotes]=useState('');
  const [serviceId,setServiceId]=useState(null);
  const [appointmentId,setAppointmentId]=useState(null);
  const [photo,setPhoto]=useState(null);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [showForm,setShowForm]=useState(false);

  useEffect(()=>{
    if(!adminMode)return;
    let active=true;
    supabase.from('profiles').select('id,full_name').eq('role','client').order('full_name').limit(200)
      .then(({data,error})=>{if(active){if(error)setError('Não conseguimos carregar as clientes agora. Tente novamente.');else setClients(data||[]);}});
    return()=>{active=false;};
  },[adminMode]);

  const refresh=useCallback(async()=>{
    if(!target){setLoading(false);setEntries([]);return;}
    setLoading(true);setError('');
    try{
      const [album,catalog,history]=await Promise.all([
        supabase.from('nail_book_entries')
          .select('id,client_id,appointment_id,service_id,title,notes,photo_path,kind,created_at,services(name),appointments(starts_at)')
          .eq('client_id',target).order('created_at',{ascending:false}).limit(100),
        supabase.from('services').select('id,name').order('name'),
        adminMode?supabase.from('appointments')
          .select('id,starts_at,service_id,services(name)').eq('client_id',target)
          .eq('status','completed').order('starts_at',{ascending:false}).limit(60):
          Promise.resolve({data:[],error:null}),
      ]);
      if(album.error)throw album.error;
      if(catalog.error)throw catalog.error;
      if(history.error)throw history.error;
      const pictures={};
      await Promise.all((album.data||[]).filter(x=>x.photo_path).map(async item=>{
        const {data,error}=await supabase.storage.from('nail-book').createSignedUrl(item.photo_path,3600);
        if(!error&&data?.signedUrl)pictures[item.id]=data.signedUrl;
      }));
      setEntries(album.data||[]);
      setServices(catalog.data||[]);
      setAppointments(history.data||[]);
      setImages(pictures);
    }catch(e){setError('Não conseguimos abrir seu Nail Book. Tente novamente.');}
    finally{setLoading(false);}
  },[target,adminMode]);
  useEffect(()=>{refresh();},[refresh]);

  function resetForm(){
    setTitle('');setNotes('');setServiceId(null);setAppointmentId(null);
    setPhoto(null);setShowForm(false);setError('');
  }
  async function add(){
    if(!target||!title.trim()||busy)return;
    if(adminMode&&!appointmentId){setError('Para registrar um trabalho realizado, selecione um atendimento concluído.');return;}
    if(photo && (!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>5242880)){
      setError('A foto precisa ser JPG, PNG ou WEBP e ter até 5 MB.');return;
    }
    setBusy(true);setError('');setMessage('');
    let path=null;
    try{
      if(photo){
        const ext=photo.type==='image/png'?'png':photo.type==='image/webp'?'webp':'jpg';
        path=target+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,12)+'.'+ext;
        const {error:uploadError}=await supabase.storage.from('nail-book')
          .upload(path,photo,{upsert:false,contentType:photo.type,cacheControl:'3600'});
        if(uploadError)throw uploadError;
      }
      const appointment=appointments.find(a=>a.id===appointmentId);
      const {error:insertError}=await supabase.from('nail_book_entries').insert({
        client_id:target,appointment_id:adminMode?appointmentId:null,
        service_id:adminMode?(appointment?.service_id||null):(serviceId||null),
        kind:adminMode?'completed':'inspiration',
        title:title.trim(),notes:notes.trim(),photo_path:path,
        created_by:(await supabase.auth.getUser()).data.user?.id,
      });
      if(insertError)throw insertError;
      resetForm();
      setMessage(adminMode?'Trabalho adicionado ao álbum da cliente.':'Inspiração salva no seu Nail Book!');
      await refresh();
    }catch(e){
      if(path)await supabase.storage.from('nail-book').remove([path]).catch(()=>{});
      setError('Não conseguimos salvar o registro. Confira as informações e tente novamente.');
    }finally{setBusy(false);}
  }
  async function remove(item){
    if(busy)return;
    if(!adminMode&&item.kind!=='inspiration')return;
    setBusy(true);setError('');
    try{
      const {error}=await supabase.from('nail_book_entries').delete().eq('id',item.id);
      if(error)throw error;
      if(item.photo_path)await supabase.storage.from('nail-book').remove([item.photo_path]);
      setMessage('Registro removido.');await refresh();
    }catch(e){setError('Não conseguimos remover o registro agora. Tente novamente.');}
    finally{setBusy(false);}
  }
  const available=clients.filter(x=>(x.full_name||'').toLocaleLowerCase('pt-BR')
    .includes(clientSearch.toLocaleLowerCase('pt-BR')));
  return <View style={s.root}>
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={s.iconButton}>
        <Ionicons name="arrow-back-outline" size={22} color={C.ink}/>
      </TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={s.heading}>{adminMode?'Nail Book das clientes':'Meu Nail Book 💅'}</Text>
        <Text style={s.helper}>Histórico, inspirações e estilos favoritos em um só lugar</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={refresh} style={s.iconButton}>
        <Ionicons name="refresh-outline" size={21} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      {adminMode&&<View style={s.section}>
        <Text style={s.title}>Selecionar cliente</Text>
        <TextInput value={clientSearch} onChangeText={setClientSearch}
          placeholder="Buscar cliente pelo nome" style={s.input}/>
        <ScrollView horizontal contentContainerStyle={s.clientChips} showsHorizontalScrollIndicator={false}>
          {available.slice(0,50).map(x=><TouchableOpacity key={x.id}
            onPress={()=>{setTarget(x.id);resetForm();setMessage('');}}
            style={[s.chip,target===x.id&&s.chipActive]}>
            <Text style={[s.chipText,target===x.id&&s.chipTextActive]}>{x.full_name||'Cliente'}</Text>
          </TouchableOpacity>)}
        </ScrollView>
      </View>}
      {!target&&<View style={s.section}><Text style={s.helper}>
        Escolha uma cliente cadastrada para visualizar o Nail Book.
      </Text></View>}
      {!!message&&<Text style={s.success}>{message}</Text>}
      {!!error&&<Text style={s.error}>{error}</Text>}
      {target&&<>
        <View style={s.hero}>
          <Ionicons name="images-outline" size={31} color={C.mocha}/>
          <View style={{flex:1}}>
            <Text style={s.heroTitle}>Seu álbum de inspirações</Text>
            <Text style={s.helper}>{entries.length} registro{entries.length===1?'':'s'} · Seus estilos favoritos</Text>
          </View>
          <TouchableOpacity style={s.addButton} onPress={()=>setShowForm(v=>!v)}
            accessibilityRole="button">
            <Ionicons name={showForm?'close':'add'} size={20} color={C.white}/>
          </TouchableOpacity>
        </View>
        {showForm&&<View style={s.section}>
          <Text style={s.title}>{adminMode?'Registrar unhas realizadas':'Salvar nova inspiração'}</Text>
          <TextInput value={title} onChangeText={setTitle} style={s.input}
            placeholder="Título: francesinha rosé, nail art..." maxLength={100}/>
          <TextInput value={notes} onChangeText={setNotes} style={[s.input,{minHeight:84}]}
            multiline maxLength={800} placeholder="Cores favoritas, formato, inspiração, detalhes..."/>
          {adminMode?<>
            <Text style={s.smallHead}>Atendimento concluído</Text>
            {!appointments.length&&<Text style={s.helper}>Esta cliente ainda não tem serviços concluídos.</Text>}
            {appointments.map(a=><TouchableOpacity key={a.id}
              style={[s.rowChoice,appointmentId===a.id&&s.choiceActive]}
              onPress={()=>setAppointmentId(a.id)}>
              <Ionicons name={appointmentId===a.id?'radio-button-on':'radio-button-off'}
                size={19} color={C.mocha}/>
              <Text style={s.helper}>{one(a.services)?.name||'Serviço'} · {fmt(a.starts_at)}</Text>
            </TouchableOpacity>)}
          </>:<>
            <Text style={s.smallHead}>Serviço relacionado (opcional)</Text>
            <ScrollView horizontal contentContainerStyle={s.clientChips}>
              {services.map(a=><TouchableOpacity key={a.id} onPress={()=>setServiceId(a.id)}
                style={[s.chip,serviceId===a.id&&s.chipActive]}>
                <Text style={[s.chipText,serviceId===a.id&&s.chipTextActive]}>{a.name.trim()}</Text>
              </TouchableOpacity>)}
            </ScrollView>
          </>}
          <Text style={s.smallHead}>Foto das unhas (opcional · máx. 5 MB)</Text>
          <FileChooser onPick={setPhoto} disabled={busy}/>
          {!!photo&&<Text style={s.helper}>Selecionada: {photo.name}</Text>}
          <TouchableOpacity style={[s.saveButton,(!title.trim()||busy)&&{opacity:.5}]}
            disabled={!title.trim()||busy} onPress={add}>
            {busy?<ActivityIndicator color={C.white}/>:<Text style={s.saveText}>Salvar no Nail Book</Text>}
          </TouchableOpacity>
        </View>}
        {loading?<ActivityIndicator color={C.mocha} style={{marginTop:35}}/>:
        entries.length===0?<View style={s.empty}>
          <Ionicons name="heart-outline" size={40} color={C.mocha}/>
          <Text style={s.title}>O álbum começa aqui</Text>
          <Text style={s.helper}>Salve suas inspirações e reúna fotos de trabalhos realizados.</Text>
        </View>:
        <View style={s.gallery}>
          {entries.map(item=><View key={item.id} style={s.card}>
            <View style={s.photo}>
              {images[item.id]?<Image style={s.image} source={{uri:images[item.id]}} resizeMode="cover"/>:
                <Ionicons name="sparkles-outline" size={40} color={C.mocha}/>}
            </View>
            <View style={s.cardContent}>
              <Text style={s.cardKind}>{item.kind==='completed'?'TRABALHO REALIZADO':'INSPIRAÇÃO'}</Text>
              <Text style={s.cardTitle}>{item.title}</Text>
              {!!item.notes&&<Text style={s.cardNotes}>{item.notes}</Text>}
              <Text style={s.helper}>{one(item.services)?.name||'Unhas'} · {fmt(item.created_at)}</Text>
              <View style={s.actions}>
                {!adminMode&&item.service_id&&<TouchableOpacity
                  style={s.repeat} onPress={()=>onRepeat(item.service_id)}>
                  <Ionicons name="repeat-outline" size={16} color={C.mocha}/>
                  <Text style={s.repeatText}>Repetir este estilo</Text>
                </TouchableOpacity>}
                {(adminMode||item.kind==='inspiration')&&<TouchableOpacity disabled={busy}
                  style={s.delete} onPress={()=>remove(item)} accessibilityLabel={'Excluir '+item.title}>
                  <Ionicons name="trash-outline" color={C.red} size={19}/>
                </TouchableOpacity>}
              </View>
            </View>
          </View>)}
        </View>}
      </>}
      <Text style={s.foot}>
        Apenas você e a equipe autorizada do estúdio conseguem visualizar este álbum.
        O Nail Book não publica fotos automaticamente no portfólio público.
      </Text>
    </ScrollView>
  </View>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  header:{flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,
    borderBottomColor:C.border,backgroundColor:C.white,padding:17},
  iconButton:{width:39,height:39,borderRadius:10,borderWidth:1,borderColor:C.border,
    alignItems:'center',justifyContent:'center'},
  heading:{fontSize:20,fontWeight:'700',color:C.ink},
  helper:{color:C.muted,fontSize:12,lineHeight:19,marginTop:4},
  content:{width:'100%',maxWidth:850,alignSelf:'center',padding:18,paddingBottom:55},
  hero:{backgroundColor:C.soft,padding:17,borderRadius:16,flexDirection:'row',
    alignItems:'center',gap:12,marginBottom:17},
  heroTitle:{color:C.ink,fontSize:17,fontWeight:'700'},
  addButton:{backgroundColor:C.mocha,width:41,height:41,borderRadius:21,alignItems:'center',justifyContent:'center'},
  title:{color:C.ink,fontSize:17,fontWeight:'700',marginBottom:11},
  section:{backgroundColor:C.white,borderRadius:15,padding:16,borderWidth:1,
    borderColor:C.border,marginBottom:15},
  input:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:12,color:C.ink,
    backgroundColor:C.white,marginBottom:10,fontSize:13},
  smallHead:{color:C.mocha,fontWeight:'700',fontSize:12,marginTop:12,marginBottom:8},
  clientChips:{gap:9,paddingVertical:6},
  chip:{paddingVertical:10,paddingHorizontal:13,borderWidth:1,borderColor:C.border,
    borderRadius:20,backgroundColor:C.white},
  chipActive:{backgroundColor:C.mocha,borderColor:C.mocha},
  chipText:{fontSize:12,fontWeight:'600',color:C.mocha},
  chipTextActive:{color:C.white},
  rowChoice:{flexDirection:'row',alignItems:'center',gap:9,padding:9,borderRadius:10},
  choiceActive:{backgroundColor:C.soft},
  saveButton:{backgroundColor:C.ink,borderRadius:11,padding:14,marginTop:17,alignItems:'center'},
  saveText:{color:C.white,fontWeight:'700'},
  empty:{alignItems:'center',padding:35,backgroundColor:C.white,borderRadius:16,gap:10},
  gallery:{flexDirection:'row',flexWrap:'wrap',gap:13},
  card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:15,
    flexBasis:250,flexGrow:1,overflow:'hidden'},
  photo:{height:177,backgroundColor:C.soft,alignItems:'center',justifyContent:'center'},
  image:{height:'100%',width:'100%'},
  cardContent:{padding:15},
  cardKind:{fontSize:10,color:C.mocha,fontWeight:'700',letterSpacing:.7,marginBottom:8},
  cardTitle:{fontSize:16,fontWeight:'700',color:C.ink},
  cardNotes:{fontSize:12,color:C.muted,lineHeight:18,marginTop:7},
  actions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:7,marginTop:13},
  repeat:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.soft,
    paddingVertical:9,paddingHorizontal:12,borderRadius:9},
  repeatText:{color:C.mocha,fontWeight:'700',fontSize:12},
  delete:{padding:10},
  success:{fontSize:13,color:C.green,marginBottom:12},
  error:{fontSize:13,color:C.red,marginBottom:12,lineHeight:19},
  foot:{fontSize:11,color:C.muted,lineHeight:18,marginTop:20},
});
