import React, { useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = { bg:'#FDFBF7', ink:'#2C2C2C', mocha:'#7A655B', border:'#EBE5DF', muted:'#8E8E93' };
const cleanPhone = value => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? '+' + digits : '+55' + digits;
};
const redirect = () => Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + '/' : undefined;

export default function AuthScreen({ recovery=false, onRecoveryDone=()=>{} }) {
  const [mode, setMode] = useState(recovery ? 'newPassword' : 'login'); // login | signup | reset | phone | otp
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);
  function notify(value, error=false) { setMessage(value); setFailure(error); }
  function switchMode(next) { setMode(next); notify(''); }

  async function run(fn) {
    if (busy) return;
    setBusy(true); notify('');
    try { await fn(); } catch (e) { notify(e?.message || 'Ocorreu um erro. Tente novamente.', true); }
    finally { setBusy(false); }
  }
  const authEmail = () => run(async () => {
    if (!email.trim() || !password) throw new Error('Informe e-mail e senha.');
    if (mode === 'signup' && !name.trim()) throw new Error('Informe seu nome.');
    const call = mode === 'signup'
      ? supabase.auth.signUp({email: email.trim().toLowerCase(), password, options:{ data:{full_name:name.trim()}, emailRedirectTo:redirect() }})
      : supabase.auth.signInWithPassword({email:email.trim().toLowerCase(), password});
    const {data,error} = await call;
    if (error) throw error;
    if (mode === 'signup' && !data.session) notify('Cadastro recebido. Confira o e-mail de confirmação e depois entre na sua conta.');
    else if (mode === 'signup') notify('Conta criada!');
  });
  const setNewPassword = () => run(async () => {
    if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
    const {error} = await supabase.auth.updateUser({password});
    if (error) throw error;
    onRecoveryDone();
    notify('Senha alterada com sucesso.');
  });
  const resetPassword = () => run(async () => {
    if (!email.trim()) throw new Error('Digite seu e-mail.');
    const {error} = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {redirectTo:redirect()});
    if (error) throw error;
    notify('Se o e-mail estiver cadastrado, você receberá instruções para recuperar o acesso.');
  });
  const sendPhone = () => run(async () => {
    const normalized = cleanPhone(phone);
    if (!/^\+55\d{10,11}$/.test(normalized)) throw new Error('Digite o telefone com DDD (Brasil).');
    const {error} = await supabase.auth.signInWithOtp({phone:normalized});
    if (error) throw error;
    setMode('otp'); notify('Enviamos um código por SMS.');
  });
  const verifyPhone = () => run(async () => {
    if (!/^\d{6}$/.test(otp.trim())) throw new Error('Digite o código de 6 dígitos.');
    const {error} = await supabase.auth.verifyOtp({phone:cleanPhone(phone), token:otp.trim(), type:'sms'});
    if (error) throw error;
  });
  const social = provider => run(async () => {
    if (Platform.OS !== 'web') throw new Error('Este fluxo OAuth está preparado para a versão web.');
    const {error} = await supabase.auth.signInWithOAuth({provider,options:{redirectTo:redirect()}});
    if (error) throw error;
  });
  const Btn = ({title, icon, onPress, outline=false}) => (
    <TouchableOpacity onPress={onPress} disabled={busy} style={[s.button,outline&&s.outline,busy&&{opacity:0.65}]}>
      {icon && <Ionicons name={icon} size={19} color={outline?C.ink:'#FFFFFF'} style={{marginRight:10}}/>}
      <Text style={[s.buttonText,outline&&{color:C.ink}]}>{title}</Text>
    </TouchableOpacity>
  );
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
    <View style={s.logo}><Ionicons name="sparkles-outline" size={30} color={C.mocha}/></View>
    <Text style={s.title}>TR Beauty Concept</Text>
    <Text style={s.subtitle}>{mode === 'signup'?'Crie sua conta e agende seus cuidados':mode === 'phone'||mode==='otp'?'Acesse com seu número de telefone':mode==='reset'?'Recuperar acesso':mode==='newPassword'?'Escolha uma nova senha':'Bem-vinda ao seu espaço de beleza'}</Text>
    {(mode==='login'||mode==='signup'||mode==='reset') && <>
      {mode==='signup' && <><Text style={s.label}>Nome completo</Text><TextInput style={s.input} value={name} onChangeText={setName} autoComplete="name" placeholder="Seu nome"/></>}
      <Text style={s.label}>E-mail</Text><TextInput style={s.input} value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" placeholder="seuemail@exemplo.com"/>
      {mode!=='reset' && <><Text style={s.label}>Senha</Text><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode==='signup'?'new-password':'current-password'} placeholder="Sua senha"/></>}
    </>}
    {mode==='newPassword' && <><Text style={s.label}>Nova senha</Text><TextInput secureTextEntry style={s.input} value={password} onChangeText={setPassword} placeholder="Mínimo de 8 caracteres" /></>}
    {(mode==='phone'||mode==='otp') && <><Text style={s.label}>Celular com DDD</Text><TextInput style={s.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="11 99999-9999" editable={mode==='phone'}/>
      {mode==='otp' && <><Text style={s.label}>Código SMS</Text><TextInput style={s.input} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} placeholder="000000"/></>}</>}
    {!!message && <Text style={[s.message,{color:failure?'#B42318':'#276749'}]}>{message}</Text>}
    {busy && <ActivityIndicator color={C.mocha} style={{marginBottom:12}}/>}
    {mode==='login' && <><Btn title="Entrar" onPress={authEmail}/><Btn title="Criar minha conta" outline onPress={()=>switchMode('signup')}/>
      <TouchableOpacity onPress={()=>switchMode('reset')} style={s.link}><Text style={s.linkText}>Esqueci minha senha</Text></TouchableOpacity>
      <Text style={s.or}>ou continue com</Text><Btn title="Telefone (código SMS)" icon="phone-portrait-outline" outline onPress={()=>switchMode('phone')}/>
      <Btn title="Google" icon="logo-google" outline onPress={()=>social('google')}/><Btn title="Apple" icon="logo-apple" outline onPress={()=>social('apple')}/></>}
    {mode==='signup' && <><Btn title="Cadastrar" onPress={authEmail}/><Btn title="Já tenho conta" outline onPress={()=>switchMode('login')}/></>}
    {mode==='newPassword' && <Btn title="Salvar nova senha" onPress={setNewPassword} />}
    {mode==='reset' && <><Btn title="Enviar recuperação" onPress={resetPassword}/><Btn title="Voltar ao login" outline onPress={()=>switchMode('login')}/></>}
    {mode==='phone' && <><Btn title="Enviar código por SMS" onPress={sendPhone}/><Btn title="Voltar" outline onPress={()=>switchMode('login')}/></>}
    {mode==='otp' && <><Btn title="Validar código" onPress={verifyPhone}/><Btn title="Reenviar código" outline onPress={()=>switchMode('phone')}/></>}
    <Text style={s.foot}>A confirmação de e-mail, SMS e os logins sociais dependem dos provedores ativados no Supabase.</Text>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},wrap:{padding:28,flexGrow:1,justifyContent:'center',maxWidth:520,width:'100%',alignSelf:'center'},logo:{width:64,height:64,borderRadius:32,backgroundColor:C.border,alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:18},title:{textAlign:'center',fontSize:29,fontWeight:'700',color:C.ink},subtitle:{textAlign:'center',fontSize:14,color:C.muted,marginBottom:28,marginTop:8},label:{fontWeight:'600',color:C.ink,marginBottom:8},input:{padding:15,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.border,borderRadius:12,marginBottom:16,fontSize:16},button:{backgroundColor:C.ink,paddingVertical:15,borderRadius:12,flexDirection:'row',justifyContent:'center',alignItems:'center',marginBottom:10},outline:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:C.border},buttonText:{color:'#FFFFFF',fontWeight:'700',fontSize:15},link:{alignSelf:'center',padding:10},linkText:{color:C.mocha,fontWeight:'600'},or:{textAlign:'center',color:C.muted,marginVertical:15},message:{marginBottom:16,textAlign:'center'},foot:{textAlign:'center',color:C.muted,fontSize:11,marginTop:18}});
