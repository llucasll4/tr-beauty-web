import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import NotificationPreferences from './NotificationPreferences';

const C={ink:'#2C2C2C',muted:'#8E8E93',mocha:'#7A655B',border:'#EBE5DF'};
export default function ProfileScreen({user,onLogout}) {
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [email,setEmail]=useState(user?.email||'');
 const [avatarPath,setAvatarPath]=useState(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [error,setError]=useState(false);
 const [avatarVersion,setAvatarVersion]=useState(0);
 const say=(value,isError=false)=>{setMessage(value);setError(isError);};
 useEffect(()=>{let active=true;(async()=>{
   const {data,error:e}=await supabase.from('profiles').select('full_name,phone,avatar_path').eq('id',user.id).single();
   if(!active)return;
   if(e)say('Erro ao carregar perfil: '+e.message,true);
   else{setName(data.full_name||'');setPhone(data.phone||'');setAvatarPath(data.avatar_path||null);}
   setLoading(false);
 })();return()=>{active=false;};},[user.id]);
 const avatarUrl=avatarPath ? supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl+'?v='+avatarVersion : null;
 async function saveProfile(){if(busy)return;setBusy(true);say('');try{
   const {error:e}=await supabase.from('profiles').update({full_name:name.trim(),phone:phone.trim()||null}).eq('id',user.id);
   if(e)throw e;
   if(email.trim().toLowerCase()!== (user.email||'').toLowerCase()){
     const {error:authError}=await supabase.auth.updateUser({email:email.trim().toLowerCase()});
     if(authError)throw authError;
     say('Dados salvos. Confira o e-mail atual e o novo para confirmar a alteração de endereço.');
   }else say('Perfil atualizado com sucesso.');
 }catch(e){say('Não foi possível salvar: '+e.message,true);}finally{setBusy(false);}}
 async function uploadAvatar(event){const file=event?.target?.files?.[0];if(!file)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)){say('Use uma foto JPG, PNG ou WEBP.',true);return;}
   if(file.size>2*1024*1024){say('A foto precisa ter no máximo 2 MB.',true);return;}
   setBusy(true);say('');try{
     const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
     const path=`${user.id}/avatar.${extension}`;
     const {error:upError}=await supabase.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:true,cacheControl:'60'});
     if(upError)throw upError;
     const {error:profileError}=await supabase.from('profiles').update({avatar_path:path}).eq('id',user.id);
     if(profileError)throw profileError;
     setAvatarPath(path);setAvatarVersion(v=>v+1);say('Foto atualizada!');
   }catch(e){say('Falha ao enviar foto: '+e.message,true);}finally{setBusy(false);event.target.value='';}
 }
 if(loading)return <View style={s.center}><ActivityIndicator color={C.mocha}/></View>;
 return <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
  <Text style={s.title}>Meu perfil</Text><Text style={s.subtitle}>Seus dados na TR Beauty Concept</Text>
  <View style={s.photoArea}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.avatar}/>:<View style={[s.avatar,s.emptyAvatar]}><Ionicons name="person-outline" size={45} color={C.mocha}/></View>}
  {Platform.OS==='web'?<View style={{alignItems:'center',marginTop:10}}>
    {React.createElement('input',{type:'file',accept:'image/jpeg,image/png,image/webp',onChange:uploadAvatar,disabled:busy,style:{maxWidth:240,fontSize:12}})}
    <Text style={s.help}>JPG, PNG ou WEBP • máximo 2 MB</Text>
  </View>:<Text style={s.help}>Upload de foto disponível na versão web.</Text>}</View>
  <Text style={s.label}>Nome</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Nome completo"/>
  <Text style={s.label}>Telefone para contato</Text><TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(11) 99999-9999"/>
  <Text style={s.label}>E-mail</Text><TextInput style={s.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="seuemail@exemplo.com"/>
  <Text style={s.help}>Alterar o e-mail exige confirmação pelo Supabase. Editar o telefone de contato não altera o número usado para login por SMS.</Text>
  {!!message&&<Text style={{color:error?'#B42318':'#276749',marginVertical:14}}>{message}</Text>}
  <TouchableOpacity style={s.button} onPress={saveProfile} disabled={busy}><Text style={s.buttonText}>{busy?'Salvando...':'Salvar alterações'}</Text></TouchableOpacity>
  <NotificationPreferences userId={user.id}/>
  <TouchableOpacity style={s.logout} onPress={onLogout}><Ionicons name="log-out-outline" size={18} color={C.mocha}/><Text style={{color:C.mocha,fontWeight:'600'}}>Sair da conta</Text></TouchableOpacity>
 </ScrollView>;
}
const s=StyleSheet.create({wrap:{padding:24,paddingBottom:55,maxWidth:620,width:'100%',alignSelf:'center'},center:{flex:1,alignItems:'center',justifyContent:'center'},title:{fontSize:24,fontWeight:'700',color:C.ink},subtitle:{fontSize:14,color:C.muted,marginTop:4,marginBottom:22},photoArea:{alignItems:'center',marginBottom:22},avatar:{height:110,width:110,borderRadius:55},emptyAvatar:{backgroundColor:C.border,alignItems:'center',justifyContent:'center'},label:{color:C.ink,fontWeight:'600',marginBottom:8},input:{backgroundColor:'#FFFFFF',padding:15,borderColor:C.border,borderWidth:1,borderRadius:12,marginBottom:16,fontSize:16},help:{color:C.muted,fontSize:12,marginBottom:12,textAlign:'center'},button:{backgroundColor:C.ink,padding:17,borderRadius:13,alignItems:'center'},buttonText:{color:'#FFFFFF',fontWeight:'700'},logout:{flexDirection:'row',gap:8,justifyContent:'center',alignItems:'center',marginTop:25,padding:12}});
