import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import NotificationPreferences from './NotificationPreferences';
import ProfilePointsBanner from './ProfilePointsBanner';
import { normalizeBrazilMobile, formatBrazilMobile } from './phoneUtils';

const C={ink:'#2C2C2C',muted:'#8E8E93',mocha:'#7A655B',border:'#EBE5DF'};
const SIZE=320;
const OUT_SIZE=420;
const MAX_OUTPUT=2*1024*1024;
function drawCrop(canvas,img,zoom,x,y) {
  if(!canvas || !img)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Editor de imagem indisponível.');
  const n=canvas.width;
  const factor=Math.max(n/img.naturalWidth,n/img.naturalHeight)*zoom;
  const w=img.naturalWidth*factor,h=img.naturalHeight*factor;
  ctx.clearRect(0,0,n,n);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,n,n);
  ctx.drawImage(img,-(w-n)*(x+100)/200,-(h-n)*(y+100)/200,w,h);
}
const jpeg=(canvas,quality)=>new Promise((resolve,reject)=>{
  canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Não foi possível preparar a imagem.')),'image/jpeg',quality);
});
function CropSlider({label,value,min,max,step=1,onChange,disabled}) {
  return <View style={{marginVertical:8}}>
    <Text style={{fontSize:13,fontWeight:'600',color:C.ink}}>{label}</Text>
    {Platform.OS==='web' && React.createElement('input',{
      type:'range',value,min,max,step,disabled,
      onChange:e=>onChange(Number(e.target.value)),
      'aria-label':label,
      style:{width:'100%',accentColor:C.mocha,height:32},
    })}
  </View>;
}
export default function ProfileScreen({user,onLogout,onAvatarChange=()=>{},onNameChange=()=>{},requirePhone=false,showPoints=true,showNotificationPreferences=true,onOpenRules=()=>{}}) {
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState(user?.email||'');
 const [avatarPath,setAvatarPath]=useState(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [error,setError]=useState(false);
 const [avatarVersion,setAvatarVersion]=useState(Date.now());
 const [optimisticAvatar,setOptimisticAvatar]=useState(null);
 const [editorOpen,setEditorOpen]=useState(false);
 const [editorImage,setEditorImage]=useState(null);
 const [editorLoading,setEditorLoading]=useState(false);
 const [editorError,setEditorError]=useState('');
 const [zoom,setZoom]=useState(1);
 const [cropX,setCropX]=useState(0);
 const [cropY,setCropY]=useState(0);
 const [fileKey,setFileKey]=useState(0);
 const photoInputRef=useRef(null);
 const previewCanvas=useRef(null);
 const selectedImageRef=useRef(null);
 const selectionRef=useRef(0);
 const say=(value,isError=false)=>{setMessage(value);setError(isError);};
 useEffect(()=>{let active=true;(async()=>{
   const {data,error:e}=await supabase.from('profiles').select('full_name,phone,avatar_path').eq('id',user.id).single();
   if(!active)return;
   if(e)say('Não conseguimos carregar seu perfil. Tente novamente.',true);
   else{setName(data.full_name||'');setPhone(requirePhone?formatBrazilMobile(data.phone||''):(data.phone||''));setAvatarPath(data.avatar_path||null);}
   setLoading(false);
 })();return()=>{active=false;};},[user.id]);
 const avatarUrl=optimisticAvatar || (avatarPath
   ? supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl+'?v='+avatarVersion
   : null);
 const avatarName=(name.trim() || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'TR').trim();
 const avatarWords=avatarName.split(/\s+/).filter(Boolean);
 const initials=(avatarWords.length>1
   ? (avatarWords[0].charAt(0)+avatarWords[avatarWords.length-1].charAt(0))
   : (avatarWords[0]||'TR').slice(0,2)).toLocaleUpperCase('pt-BR');
 useEffect(()=>{
   if(editorOpen&&editorImage&&previewCanvas.current) {
     try{drawCrop(previewCanvas.current,editorImage,zoom,cropX,cropY);}
     catch(e){setEditorError(e.message);}
   }
 },[editorOpen,editorImage,zoom,cropX,cropY]);
 function closeEditor(){
   if(busy)return;
   selectionRef.current++;
   setEditorOpen(false);setEditorImage(null);selectedImageRef.current=null;
   setEditorLoading(false);setEditorError('');setFileKey(v=>v+1);
 }
 async function saveProfile(){if(busy)return;setBusy(true);say('');try{
   const normalizedPhone = requirePhone ? normalizeBrazilMobile(phone) : (phone.trim() || null);
   if (requirePhone && !normalizedPhone) {
     throw new Error('Informe um celular válido com DDD, como (11) 91234-5678.');
   }
   const {error:e}=await supabase.from('profiles').update({full_name:name.trim(),phone:normalizedPhone}).eq('id',user.id);
   if(e)throw e;
   onNameChange(name.trim());
   if(email.trim().toLowerCase()!== (user.email||'').toLowerCase()){
     const {error:authError}=await supabase.auth.updateUser({email:email.trim().toLowerCase()});
     if(authError)throw authError;
     say('Dados salvos. Confira o e-mail atual e o novo para confirmar a alteração de endereço.');
   }else say('Perfil atualizado com sucesso.');
 }catch(e){say(/^Informe um celular válido/.test(e?.message||'') ? e.message :
      'Não foi possível concluir todas as alterações. Confira seus dados e tente novamente.',true);
    }finally{setBusy(false);}}

 function chooseAvatar(event){
   const file=event?.target?.files?.[0];
   if(!file)return;
   setFileKey(v=>v+1);say('');
   if(!file.type?.startsWith('image/')){
     say('Escolha um arquivo de imagem.',true);return;
   }
   if(Platform.OS!=='web'||typeof window==='undefined')return;
   setEditorError('');setEditorLoading(true);setEditorImage(null);setEditorOpen(true);
   setZoom(1);setCropX(0);setCropY(0);
   const current=++selectionRef.current;
   const tempUrl=window.URL.createObjectURL(file);
   const img=new window.Image();
   img.onload=()=>{
     window.URL.revokeObjectURL(tempUrl);
     if(current!==selectionRef.current)return;
     selectedImageRef.current=img;
     setEditorImage(img);setEditorLoading(false);
   };
   img.onerror=()=>{
     window.URL.revokeObjectURL(tempUrl);
     if(current!==selectionRef.current)return;
     setEditorLoading(false);
     setEditorError('Este formato não pôde ser aberto no navegador. Tente JPG, PNG ou WEBP.');
   };
   img.src=tempUrl;
 }
 async function saveAvatar(){
   if(!selectedImageRef.current||busy)return;
   setBusy(true);setEditorError('');say('');
   const prior=optimisticAvatar;
   try{
     if(Platform.OS!=='web'||typeof document==='undefined')throw new Error('Editor indisponível.');
     const canvas=document.createElement('canvas');
     canvas.width=OUT_SIZE;canvas.height=OUT_SIZE;
     drawCrop(canvas,selectedImageRef.current,zoom,cropX,cropY);
     let blob=await jpeg(canvas,0.88);
     for(const quality of [0.72,0.55,0.38]){
       if(blob.size<=MAX_OUTPUT)break;
       blob=await jpeg(canvas,quality);
     }
     if(blob.size>MAX_OUTPUT)throw new Error('Não foi possível otimizar essa imagem.');
     // A moldura do perfil muda imediatamente enquanto a foto é enviada.
     const preview=canvas.toDataURL('image/jpeg',0.85);
     setOptimisticAvatar(preview);
     const path=user.id+'/avatar.jpg';
     const {error:uploadError}=await supabase.storage.from('avatars').upload(
       path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'}
     );
     if(uploadError)throw uploadError;
     const {error:profileError}=await supabase.from('profiles')
       .update({avatar_path:path}).eq('id',user.id);
     if(profileError)throw profileError;
     // Mantém a prévia local na tela até o próximo carregamento do perfil.
     setAvatarPath(path);setAvatarVersion(Date.now());
     // Compartilha a versão recortada com a Home logo após salvar no Supabase.
     // Evita imagem antiga em cache e dispensa recarregar ou refazer login.
     onAvatarChange(preview);
     setEditorOpen(false);setEditorImage(null);selectedImageRef.current=null;
     setFileKey(v=>v+1);say('Foto de perfil atualizada!');
   }catch(e){
     setOptimisticAvatar(prior);
     setEditorError('Não conseguimos salvar sua foto. Tente novamente com outra imagem.');
   }finally{setBusy(false);}
 }
 if(loading)return <View style={s.center}><ActivityIndicator color={C.mocha}/></View>;
 return <><ScrollView style={s.rootScroll} contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
  <Text style={s.title}>Meu perfil</Text>
  <Text style={s.subtitle}>Seus dados na TR Beauty Concept</Text>

  <View style={s.photoArea}>
    <View style={s.avatarFrame}>
      {avatarUrl
        ? <Image source={{uri:avatarUrl}} style={s.avatar} accessibilityLabel="Minha foto de perfil"/>
        : <View style={[s.avatar,s.emptyAvatar]}><Text style={s.initials}>{initials}</Text></View>}
      {Platform.OS==='web' && <TouchableOpacity style={s.cameraButton}
        accessibilityRole="button" accessibilityLabel="Alterar foto de perfil"
        disabled={busy} onPress={()=>photoInputRef.current?.click()}>
        <Ionicons name="camera" size={21} color="#FFFFFF"/>
      </TouchableOpacity>}
    </View>
    {Platform.OS==='web'
      ? React.createElement('input',{
          ref:photoInputRef,key:fileKey,type:'file',accept:'image/*',
          onChange:chooseAvatar,disabled:busy,'aria-label':'Selecionar nova foto de perfil',
          tabIndex:-1,style:{display:'none'},
        })
      : <Text style={s.photoHelp}>Edição de foto disponível na versão web.</Text>}
  </View>

  {showPoints && <ProfilePointsBanner userId={user.id} onOpenRules={onOpenRules}/>}

  <Text style={s.label}>Nome completo</Text>
  <View style={s.inputShell}>
    <Ionicons name="person-outline" size={22} color={C.muted}/>
    <TextInput style={s.fieldInput} value={name} onChangeText={setName}
      accessibilityLabel="Nome completo" autoComplete="name" placeholder="Nome completo"
      placeholderTextColor={C.muted}/>
  </View>

  <Text style={s.label}>Celular (WhatsApp){requirePhone?' *':''}</Text>
  <View style={s.inputShell}>
    <Ionicons name="phone-portrait-outline" size={22} color={C.muted}/>
    <TextInput style={s.fieldInput} value={phone}
      onChangeText={v=>setPhone(requirePhone?formatBrazilMobile(v):v)}
      keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
      accessibilityLabel="Celular com DDD" placeholder="(11) 91234-5678"
      placeholderTextColor={C.muted} maxLength={requirePhone?15:undefined}/>
  </View>

  <Text style={s.label}>E-mail</Text>
  <View style={s.inputShell}>
    <Ionicons name="mail-outline" size={22} color={C.muted}/>
    <TextInput style={s.fieldInput} value={email} onChangeText={setEmail}
      keyboardType="email-address" autoComplete="email" autoCapitalize="none"
      accessibilityLabel="E-mail" placeholder="seuemail@exemplo.com"
      placeholderTextColor={C.muted}/>
  </View>

  <Text style={s.help}>Ao trocar seu e-mail, você precisará confirmar o novo endereço. Seu celular é usado para contato sobre os atendimentos; mensagens promocionais dependem de autorização.</Text>
  {!!message&&<Text style={{color:error?'#B42318':'#276749',marginVertical:14}}>{message}</Text>}
  <TouchableOpacity accessibilityRole="button" style={s.button} onPress={saveProfile} disabled={busy}>
    <Text style={s.buttonText}>{busy?'Salvando...':'Salvar alterações'}</Text>
  </TouchableOpacity>
  {showNotificationPreferences && <NotificationPreferences userId={user.id}/>}
  <TouchableOpacity style={s.logout} onPress={onLogout} accessibilityRole="button">
    <Ionicons name="log-out-outline" size={18} color={C.mocha}/>
    <Text style={{color:C.mocha,fontWeight:'600'}}>Sair da conta</Text>
  </TouchableOpacity>
 </ScrollView>
 <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={closeEditor}>
  <View style={s.modalBackdrop}>
   <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
    <View style={s.modalCard}>
     <Text style={s.modalTitle}>Recortar foto de perfil</Text>
     <Text style={s.modalSubtitle}>Ajuste o enquadramento para deixar sua foto como preferir.</Text>
     <View style={s.previewOuter}>
      {editorLoading?<ActivityIndicator color={C.mocha}/>:
       <View style={s.previewCircle}>
        {Platform.OS==='web' && React.createElement('canvas',{
          ref:previewCanvas,width:SIZE,height:SIZE,
          'aria-label':'Prévia da foto recortada',
          style:{width:230,height:230,borderRadius:'50%',display:'block'},
        })}
       </View>}
     </View>
     {!!editorError&&<Text style={s.cropError}>{editorError}</Text>}
     {editorImage&&<>
      <CropSlider label={'Zoom: '+Math.round(zoom*100)+'%'} value={zoom}
       min={1} max={3} step={0.05} onChange={setZoom} disabled={busy}/>
      <CropSlider label="Posição horizontal" value={cropX}
       min={-100} max={100} onChange={setCropX} disabled={busy}/>
      <CropSlider label="Posição vertical" value={cropY}
       min={-100} max={100} onChange={setCropY} disabled={busy}/>
      <TouchableOpacity style={s.centerCrop} disabled={busy}
       onPress={()=>{setZoom(1);setCropX(0);setCropY(0);}}>
       <Ionicons name="refresh-outline" size={17} color={C.mocha}/>
       <Text style={{color:C.mocha,fontWeight:'700'}}>Centralizar foto</Text>
      </TouchableOpacity>
     </>}
     <View style={s.modalActions}>
      <TouchableOpacity onPress={closeEditor} disabled={busy} style={s.cancelButton}>
       <Text style={{color:C.mocha,fontWeight:'700'}}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={saveAvatar} disabled={busy||!editorImage}
       style={[s.saveButton,(busy||!editorImage)&&{opacity:0.5}]}>
       {busy?<ActivityIndicator color="#fff"/>:
        <Text style={{color:'#fff',fontWeight:'700'}}>Salvar foto</Text>}
      </TouchableOpacity>
     </View>
     <Text style={s.help}>Confira o enquadramento antes de salvar.</Text>
    </View>
   </ScrollView>
  </View>
 </Modal>
 </>;
}
const s=StyleSheet.create({
 modalBackdrop:{flex:1,backgroundColor:'rgba(15,15,15,0.68)',justifyContent:'center'},
 modalScroll:{flexGrow:1,justifyContent:'center',alignItems:'center',padding:16},
 modalCard:{width:'100%',maxWidth:460,backgroundColor:'#fff',borderRadius:18,padding:23},
 modalTitle:{fontSize:21,fontWeight:'700',color:C.ink,textAlign:'center'},
 modalSubtitle:{fontSize:13,color:C.muted,textAlign:'center',marginTop:6},
 previewOuter:{alignItems:'center',justifyContent:'center',minHeight:245,marginTop:10},
 previewCircle:{width:232,height:232,borderRadius:116,overflow:'hidden',
   borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
 cropError:{color:'#B42318',fontSize:12,marginVertical:10,textAlign:'center'},
 centerCrop:{paddingVertical:12,flexDirection:'row',alignSelf:'center',alignItems:'center',gap:8},
 modalActions:{flexDirection:'row',gap:10,marginTop:14,marginBottom:16},
 cancelButton:{flex:1,borderWidth:1,borderColor:C.border,borderRadius:12,padding:14,alignItems:'center'},
 saveButton:{flex:1,backgroundColor:C.ink,borderRadius:12,padding:14,alignItems:'center'},
 rootScroll:{backgroundColor:'#FAF9F7'},
 wrap:{paddingHorizontal:24,paddingTop:24,paddingBottom:55,maxWidth:620,width:'100%',alignSelf:'center'},
 center:{flex:1,alignItems:'center',justifyContent:'center'},
 title:{fontSize:36,fontWeight:'800',color:'#1E1B19',letterSpacing:-1.1},
 subtitle:{fontSize:15,color:'#707782',marginTop:6,marginBottom:12},
 photoArea:{alignItems:'center',marginTop:33,marginBottom:38},
 avatarFrame:{width:150,height:150,borderRadius:75,backgroundColor:'#FFFFFF',
   padding:5,alignItems:'center',justifyContent:'center',
   shadowColor:'#000000',shadowOpacity:0.10,shadowRadius:18,
   shadowOffset:{width:0,height:8},elevation:4},
 avatar:{height:140,width:140,borderRadius:70},
 emptyAvatar:{backgroundColor:'#1E1B19',alignItems:'center',justifyContent:'center'},
 initials:{color:'#FFFFFF',fontSize:47,fontWeight:'500',letterSpacing:1},
 cameraButton:{position:'absolute',right:-4,bottom:-3,width:49,height:49,borderRadius:25,
   backgroundColor:'#1E1B19',borderWidth:4,borderColor:'#FFFFFF',
   justifyContent:'center',alignItems:'center',elevation:5},
 photoHelp:{fontSize:12,color:C.muted,textAlign:'center',marginTop:14},
 label:{color:'#505B66',fontSize:15,fontWeight:'700',marginBottom:10,marginLeft:4},
 inputShell:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#F4F1EE',
   borderRadius:17,flexDirection:'row',alignItems:'center',
   gap:15,paddingHorizontal:17,marginBottom:25,minHeight:60,
   shadowColor:'#000000',shadowOpacity:0.035,shadowRadius:6,
   shadowOffset:{width:0,height:2},elevation:1},
 fieldInput:{flex:1,minWidth:0,color:'#242B34',fontSize:16,paddingVertical:17},
 help:{color:C.muted,fontSize:12,marginBottom:12,lineHeight:19,textAlign:'center'},
 button:{backgroundColor:C.ink,padding:17,borderRadius:13,alignItems:'center',marginTop:9},
 buttonText:{color:'#FFFFFF',fontWeight:'700'},
 logout:{flexDirection:'row',gap:8,justifyContent:'center',alignItems:'center',marginTop:25,padding:12}
});
