import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import { getVipProgress } from './vipProgress';
import ProfileScreen from './ProfileScreen';
import PrivacyNotice from './PrivacyNotice';
import { palette } from './theme/tokens';

const C = {
  background:palette.profileBackground, white:palette.paper,
  ink:palette.warmInk, brown:palette.brown, mocha:palette.mocha,
  muted:palette.profileMuted, nude:palette.warmNude,
  border:palette.warmBorder, gold:palette.gold,
  green:palette.profileGreen, red:palette.profileRed, soft:palette.soft,
};
const stylesOptions = [
  {value:'sem_preferencia',label:'Sem preferência',description:'O atendimento segue naturalmente.'},
  {value:'silencioso',label:'Atendimento silencioso 🤫',description:'Prefiro relaxar e conversar pouco.'},
  {value:'conversar',label:'Gosto de conversar 💬',description:'Prefiro um atendimento com conversa.'},
];
const drinkOptions = [
  {value:'sem_preferencia',label:'Sem preferência'},
  {value:'agua',label:'Água 💧'},
  {value:'cafe',label:'Café expresso ☕'},
  {value:'cha',label:'Chá 🍵'},
];
const choiceLabel = (options,value)=>options.find(option=>option.value===value)?.label || 'Sem preferência';
const digits = value=>String(value||'').replace(/\D/g,'');
const supportUrl = text=>'https://wa.me/5511946901167?text='+encodeURIComponent(text);
const birthdayLabel = data=>data
  ? String(data.birth_day).padStart(2,'0')+'/'+String(data.birth_month).padStart(2,'0')
  : 'Adicionar';
function Section({title,children}) {
  return <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>;
}
function SettingRow({icon,title,subtitle,value,onPress,destructive=false}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title}
    onPress={onPress} style={s.row}>
    <Ionicons name={icon} size={23} color={destructive?C.red:C.mocha}/>
    <View style={{flex:1,minWidth:0}}>
      <Text style={[s.rowTitle,destructive&&{color:C.red}]}>{title}</Text>
      {!!subtitle&&<Text style={s.rowSubtitle}>{subtitle}</Text>}
    </View>
    {!!value&&<Text style={s.rowValue} numberOfLines={1}>{value}</Text>}
    <Ionicons name="chevron-forward" size={19} color={C.mocha}/>
  </TouchableOpacity>;
}
function ToggleRow({icon,label,detail,value,onChange,disabled=false}) {
  return <View style={s.row}>
    <Ionicons name={icon} size={23} color={C.mocha}/>
    <View style={{flex:1,minWidth:0}}>
      <Text style={s.rowTitle}>{label}</Text>
      {!!detail&&<Text style={s.rowSubtitle}>{detail}</Text>}
    </View>
    <Switch accessibilityLabel={label} value={!!value} onValueChange={onChange}
      disabled={disabled} trackColor={{false:'#D7D2CD',true:'#B3957A'}}
      thumbColor={C.white} ios_backgroundColor="#D7D2CD"/>
  </View>;
}

export default function ClientSettings({
  user, onLogout, onAvatarChange=()=>{}, onNameChange=()=>{},
  onBack=()=>{}, onOpenHistory=()=>{}, onOpenRules=()=>{},
  onOpenNotifications=()=>{}, onAppAlertsChange=()=>{},
}) {
  const [editing,setEditing]=useState(false);
  const [avatarPreview,setAvatarPreview]=useState(null);
  const [profile,setProfile]=useState(null);
  const [birthday,setBirthday]=useState(null);
  const [care,setCare]=useState({
    service_style:'sem_preferencia',favorite_drink:'sem_preferencia',
    app_alerts_enabled:true,marketing_opt_in:false,
  });
  const [notice,setNotice]=useState({email_enabled:false,whatsapp_enabled:false,whatsapp_consented_at:null});
  const [vip,setVip]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [message,setMessage]=useState('');
  const [dialog,setDialog]=useState(null);
  const [birthDay,setBirthDay]=useState('');
  const [birthMonth,setBirthMonth]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [passwordConfirm,setPasswordConfirm]=useState('');
  const [deletionRequest,setDeletionRequest]=useState(null);
  const [privacyOpen,setPrivacyOpen]=useState(false);
  const deletionPending=['pending','in_review'].includes(deletionRequest?.status);
  const load = useCallback(async()=>{
    if(!user?.id)return;
    setLoading(true);setLoadError('');
    const [p,b,c,n,v,settings,deleteReq]=await Promise.all([
      supabase.from('profiles').select('full_name,phone,avatar_path,created_at').eq('id',user.id).maybeSingle(),
      supabase.from('customer_birthdays').select('birth_day,birth_month').eq('user_id',user.id).maybeSingle(),
      supabase.from('client_care_preferences')
        .select('service_style,favorite_drink,app_alerts_enabled,marketing_opt_in')
        .eq('user_id',user.id).maybeSingle(),
      supabase.from('notification_preferences')
        .select('email_enabled,whatsapp_enabled,whatsapp_consented_at')
        .eq('user_id',user.id).maybeSingle(),
      supabase.rpc('get_my_vip_summary'),
      supabase.from('vip_settings').select('silver_points,gold_points').eq('id',1).maybeSingle(),
      supabase.from('account_deletion_requests')
        .select('id,status,response_note,created_at')
        .eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(p.error||b.error||c.error||n.error||v.error||settings.error||deleteReq.error){
      setLoadError('Algumas preferências não puderam ser consultadas. Toque em atualizar.');
    }
    if(!p.error)setProfile(p.data||null);
    if(!b.error)setBirthday(b.data||null);
    if(!c.error&&c.data)setCare(prev=>({...prev,...c.data}));
    if(!n.error)setNotice({
      email_enabled:!!n.data?.email_enabled,
      whatsapp_enabled:!!n.data?.whatsapp_enabled,
      whatsapp_consented_at:n.data?.whatsapp_consented_at||null,
    });
    if(!v.error&&!settings.error)setVip(getVipProgress(v.data,settings.data));
    if(!deleteReq.error)setDeletionRequest(deleteReq.data||null);
    setLoading(false);
  },[user?.id]);
  useEffect(()=>{load();},[load]);
  const fullName=(profile?.full_name?.trim()||user?.user_metadata?.full_name||user?.email?.split('@')[0]||'Cliente').trim();
  const initials=fullName.split(/\s+/).filter(Boolean);
  const monogram=initials.length>1
    ? (initials[0][0]+initials[initials.length-1][0]).toUpperCase()
    : fullName.slice(0,2).toUpperCase();
  const avatarUrl=profile?.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl+'?profile=1'
    : null;
  const since=profile?.created_at||user?.created_at;
  const sinceYear=since&&!Number.isNaN(new Date(since).getTime())
    ? new Date(since).getFullYear():null;

  function showDialog(which){setMessage('');setDialog(which);}
  function closeDialog(){if(!busy){setDialog(null);setMessage('');}}
  async function saveCare(fields,closeAfter=false){
    if(busy)return false;
    setBusy(true);setMessage('');
    try{
      const {error}=await supabase.from('client_care_preferences').upsert({
        user_id:user.id,...fields,updated_at:new Date().toISOString(),
      },{onConflict:'user_id'});
      if(error)throw error;
      setCare(old=>({...old,...fields}));
      if(Object.prototype.hasOwnProperty.call(fields,'app_alerts_enabled')){
        onAppAlertsChange(!!fields.app_alerts_enabled);
      }
      if(closeAfter)setDialog(null);
      else setMessage('Preferência salva.');
      return true;
    }catch(err){
      setMessage('Não foi possível salvar: '+(err?.message||'erro desconhecido'));
      return false;
    }finally{setBusy(false);}
  }
  async function saveNotice(field,enabled){
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      if(field==='whatsapp_enabled'&&enabled){
        const phone=digits(profile?.phone);
        if(phone.length<10||phone.length>13){
          throw new Error('Cadastre um número de WhatsApp válido em Editar dados pessoais primeiro.');
        }
      }
      const updated={...notice,[field]:enabled};
      if(field==='whatsapp_enabled'){
        updated.whatsapp_consented_at=enabled
          ? (notice.whatsapp_consented_at||new Date().toISOString()):null;
      }
      const {error}=await supabase.from('notification_preferences').upsert({
        user_id:user.id,
        email_enabled:updated.email_enabled,
        whatsapp_enabled:updated.whatsapp_enabled,
        whatsapp_consented_at:updated.whatsapp_consented_at,
      },{onConflict:'user_id'});
      if(error)throw error;
      setNotice(updated);
      setMessage('Preferência de comunicação salva.');
    }catch(err){setMessage('Não foi possível salvar: '+(err?.message||'erro desconhecido'));}
    finally{setBusy(false);}
  }
  async function saveBirthday(){
    if(busy||birthday)return;
    const day=Number(birthDay),month=Number(birthMonth);
    const date=new Date(2000,month-1,day);
    if(!Number.isInteger(day)||!Number.isInteger(month)||month<1||month>12||
      day<1||day>31||date.getMonth()!==month-1||date.getDate()!==day){
      setMessage('Informe um dia e mês válidos.');return;
    }
    setBusy(true);setMessage('');
    try{
      const {error}=await supabase.from('customer_birthdays')
        .insert({user_id:user.id,birth_day:day,birth_month:month});
      if(error)throw error;
      setBirthday({birth_day:day,birth_month:month});
      setDialog(null);
    }catch(err){setMessage('Não foi possível salvar: '+(err?.message||'erro desconhecido'));}
    finally{setBusy(false);}
  }
  async function updatePassword(){
    if(busy)return;
    if(newPassword.length<8){setMessage('Use uma senha com pelo menos 8 caracteres.');return;}
    if(newPassword!==passwordConfirm){setMessage('As senhas não coincidem.');return;}
    setBusy(true);setMessage('');
    try{
      const {error}=await supabase.auth.updateUser({password:newPassword});
      if(error)throw error;
      setNewPassword('');setPasswordConfirm('');
      setDialog(null);
      setMessage('Senha alterada. Mantenha-a em segurança.');
    }catch(err){setMessage('Não foi possível alterar a senha: '+(err?.message||'erro desconhecido'));}
    finally{setBusy(false);}
  }
  async function requestDeletion(){
    if(busy||deletionPending)return;
    setBusy(true);setMessage('');
    try{
      const {error}=await supabase.from('account_deletion_requests')
        .insert({user_id:user.id});
      if(error){
        if(error.code==='23505'){
          setDeletionRequest({status:'pending'});
          setDialog(null);
          setMessage('Já existe uma solicitação de exclusão pendente.');
          return;
        }
        throw error;
      }
      setDeletionRequest({status:'pending'});
      setDialog(null);
      setMessage('Solicitação registrada. Sua conta permanece ativa até a análise do estúdio.');
    }catch(err){setMessage('Não foi possível solicitar a exclusão: '+(err?.message||'erro desconhecido'));}
    finally{setBusy(false);}
  }
  function openSupport(text='Olá! Preciso de ajuda com minha conta no TR Beauty Concept.'){
    Linking.openURL(supportUrl(text)).catch(()=>{
      setMessage('Não foi possível abrir o WhatsApp. Contato: (11) 94690-1167.');
    });
  }

  if(editing){
    return <View style={{flex:1,backgroundColor:C.background}}>
      <TouchableOpacity onPress={()=>{setEditing(false);load();}} style={s.editBack}
        accessibilityRole="button" accessibilityLabel="Voltar aos ajustes">
        <Ionicons name="chevron-back" size={21} color={C.brown}/>
        <Text style={s.editBackText}>Voltar aos ajustes</Text>
      </TouchableOpacity>
      <ProfileScreen user={user} onLogout={onLogout} showPoints={false}
        requirePhone showNotificationPreferences={false}
        onAvatarChange={preview=>{setAvatarPreview(preview);onAvatarChange(preview);}}
        onNameChange={value=>{onNameChange(value);setProfile(old=>({...old,full_name:value}));}}/>
    </View>;
  }

  return <View style={s.root}>
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar ao início"
          onPress={onBack} style={s.back}>
          <Ionicons name="chevron-back" size={28} color={C.ink}/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ajustes e Preferências</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar preferências"
          onPress={load} style={s.refresh}>
          <Ionicons name="refresh-outline" size={21} color={C.mocha}/>
        </TouchableOpacity>
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={()=>setEditing(true)}
        style={s.identity}>
        <View style={s.avatar}>
          {(avatarPreview||avatarUrl)?<Image source={{uri:avatarPreview||avatarUrl}} style={s.avatarImage}/>:
            <Text style={s.avatarLetters}>{monogram}</Text>}
        </View>
        <View style={{flex:1,minWidth:0}}>
          <Text style={s.name} numberOfLines={2}>{fullName}</Text>
          <Text style={s.identitySub}>
            {sinceYear?'Cliente desde '+sinceYear:'Cliente TR Beauty Concept'}
            {vip?' · Nível '+vip.tier:''}
          </Text>
        </View>
        {vip&&<Ionicons name={vip.tier==='Ouro'?'ribbon':'star'}
          size={23} color={C.gold}/>}
      </TouchableOpacity>

      {loading&&<ActivityIndicator color={C.mocha} style={{padding:18}}/>}
      {!!loadError&&<Text style={s.warning}>{loadError}</Text>}
      {!!message&&<Text style={s.message}>{message}</Text>}

      <Section title="MEU PERFIL">
        <SettingRow icon="create-outline" title="Editar dados pessoais"
          subtitle="Nome, telefone, e-mail e foto" onPress={()=>setEditing(true)}/>
        <SettingRow icon="gift-outline" title="Data de nascimento (Aniversário)"
          value={birthdayLabel(birthday)} onPress={()=>showDialog('birthday')}/>
      </Section>
      <Section title="PREFERÊNCIAS DE ATENDIMENTO">
        <SettingRow icon="chatbubble-ellipses-outline" title="Estilo de atendimento"
          value={choiceLabel(stylesOptions,care.service_style)}
          onPress={()=>showDialog('service_style')}/>
        <SettingRow icon="cafe-outline" title="Bebida favorita"
          value={choiceLabel(drinkOptions,care.favorite_drink)}
          onPress={()=>showDialog('favorite_drink')}/>
      </Section>
      <Section title="NOTIFICAÇÕES E ALERTAS">
        <ToggleRow icon="logo-whatsapp" label="Lembretes pelo WhatsApp"
          detail="Autorização para mensagens de agendamento quando o canal estiver ativo."
          value={notice.whatsapp_enabled} disabled={busy||loading}
          onChange={enabled=>saveNotice('whatsapp_enabled',enabled)}/>
        <ToggleRow icon="mail-outline" label="Avisos por e-mail"
          detail="Confirmações, cancelamentos e lembretes, conforme os envios habilitados."
          value={notice.email_enabled} disabled={busy||loading}
          onChange={enabled=>saveNotice('email_enabled',enabled)}/>
        <ToggleRow icon="notifications-outline" label="Avisos no aplicativo"
          detail="Exibir contador no Início; não ativa push no celular."
          value={care.app_alerts_enabled} disabled={busy||loading}
          onChange={enabled=>saveCare({app_alerts_enabled:enabled})}/>
        <ToggleRow icon="star-outline" label="Novidades e promoções no aplicativo"
          detail="Autorizo ver campanhas na Home. Não autoriza e-mails ou WhatsApp promocionais. Posso desativar quando quiser."
          value={care.marketing_opt_in} disabled={busy||loading}
          onChange={enabled=>saveCare({marketing_opt_in:enabled})}/>
        <TouchableOpacity accessibilityRole="button" onPress={onOpenNotifications}
          style={s.notificationsLink}>
          <Text style={s.notificationsLinkText}>Abrir central de notificações</Text>
          <Ionicons name="arrow-forward" size={17} color={C.mocha}/>
        </TouchableOpacity>
      </Section>
      <Section title="HISTÓRICO E FIDELIDADE">
        <SettingRow icon="calendar-outline" title="Histórico de serviços"
          subtitle="Atendimentos concluídos" onPress={onOpenHistory}/>
        <SettingRow icon="diamond-outline" title="Regras do TR Points 💎"
          subtitle="Níveis, benefícios e pontos" onPress={onOpenRules}/>
      </Section>
      <Section title="AJUDA E SEGURANÇA">
        <SettingRow icon="logo-whatsapp" title="Fale conosco / Suporte"
          onPress={()=>openSupport()}/>
        <SettingRow icon="document-text-outline" title="Política de cancelamento"
          onPress={()=>showDialog('cancellation')}/>
        <SettingRow icon="shield-checkmark-outline" title="Aviso de Privacidade"
          subtitle="Como seus dados são usados e protegidos"
          onPress={()=>setPrivacyOpen(true)}/>
        <SettingRow icon="key-outline" title="Alterar senha"
          onPress={()=>showDialog('password')}/>
        <SettingRow icon="trash-outline"
          title={deletionPending?'Exclusão solicitada':'Solicitar exclusão da conta'}
          destructive onPress={()=>showDialog('deletion')}/>
      </Section>
      <TouchableOpacity style={s.logout} onPress={onLogout} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={20} color={C.brown}/>
        <Text style={s.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>

    <Modal visible={!!dialog} transparent animationType="fade"
      onRequestClose={closeDialog}>
      <View style={s.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject}
          accessibilityRole="button" accessibilityLabel="Fechar janela"
          onPress={closeDialog} disabled={busy}/>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{
              dialog==='birthday'?'Seu aniversário':
              dialog==='service_style'?'Estilo de atendimento':
              dialog==='favorite_drink'?'Bebida favorita':
              dialog==='password'?'Alterar senha':
              dialog==='deletion'?'Exclusão de conta':'Política de cancelamento'
            }</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar"
              onPress={closeDialog} disabled={busy}>
              <Ionicons name="close" size={23} color={C.mocha}/>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {dialog==='service_style'&&stylesOptions.map(option=>
              <TouchableOpacity key={option.value} accessibilityRole="button"
                style={[s.option,care.service_style===option.value&&s.optionSelected]}
                disabled={busy} onPress={()=>saveCare({service_style:option.value},true)}>
                <View style={{flex:1}}>
                  <Text style={s.optionText}>{option.label}</Text>
                  {!!option.description&&<Text style={s.optionSub}>{option.description}</Text>}
                </View>
                <Ionicons name={care.service_style===option.value?'checkmark-circle':'ellipse-outline'}
                  size={23} color={C.mocha}/>
              </TouchableOpacity>)}
            {dialog==='favorite_drink'&&drinkOptions.map(option=>
              <TouchableOpacity key={option.value} accessibilityRole="button"
                style={[s.option,care.favorite_drink===option.value&&s.optionSelected]}
                disabled={busy} onPress={()=>saveCare({favorite_drink:option.value},true)}>
                <Text style={s.optionText}>{option.label}</Text>
                <Ionicons name={care.favorite_drink===option.value?'checkmark-circle':'ellipse-outline'}
                  size={23} color={C.mocha}/>
              </TouchableOpacity>)}
            {dialog==='birthday'&&(birthday?
              <View style={s.infoBox}>
                <Text style={s.text}>Aniversário cadastrado: {birthdayLabel(birthday)}.</Text>
                <Text style={s.small}>Para corrigir a data, fale com o estúdio. O cadastro é feito uma vez por segurança.</Text>
                <TouchableOpacity onPress={()=>openSupport('Olá! Gostaria de corrigir meu aniversário cadastrado.')}
                  style={s.modalButton}><Text style={s.modalButtonText}>Falar com o estúdio</Text></TouchableOpacity>
              </View>:
              <>
                <Text style={s.small}>Informe somente o dia e o mês. O ano de nascimento não é solicitado.</Text>
                <View style={s.inputsRow}>
                  <TextInput value={birthDay} onChangeText={setBirthDay} style={s.shortInput}
                    keyboardType="number-pad" maxLength={2} placeholder="Dia" accessibilityLabel="Dia"/>
                  <TextInput value={birthMonth} onChangeText={setBirthMonth} style={s.shortInput}
                    keyboardType="number-pad" maxLength={2} placeholder="Mês" accessibilityLabel="Mês"/>
                </View>
                <Text style={s.small}>Um possível bônus depende das regras e campanhas do Clube VIP.</Text>
                <TouchableOpacity onPress={saveBirthday} disabled={busy} style={s.modalButton}>
                  <Text style={s.modalButtonText}>Salvar aniversário</Text>
                </TouchableOpacity>
              </>)}
            {dialog==='password'&&<>
              <Text style={s.small}>Defina uma nova senha com pelo menos 8 caracteres.</Text>
              <TextInput style={s.input} secureTextEntry autoCapitalize="none"
                value={newPassword} onChangeText={setNewPassword}
                placeholder="Nova senha" accessibilityLabel="Nova senha"/>
              <TextInput style={s.input} secureTextEntry autoCapitalize="none"
                value={passwordConfirm} onChangeText={setPasswordConfirm}
                placeholder="Confirme a nova senha" accessibilityLabel="Confirmar nova senha"/>
              <TouchableOpacity onPress={updatePassword} disabled={busy} style={s.modalButton}>
                <Text style={s.modalButtonText}>Alterar senha</Text>
              </TouchableOpacity>
            </>}
            {dialog==='cancellation'&&<>
              <Text style={s.text}>As condições específicas de cancelamento são informadas pelo estúdio. Não há uma política publicada no aplicativo para consultar neste momento.</Text>
              <Text style={s.small}>Antes de cancelar um atendimento, solicite os prazos e condições diretamente ao estúdio.</Text>
              <TouchableOpacity onPress={()=>openSupport('Olá! Gostaria de consultar a política de cancelamento dos agendamentos.')}
                style={s.modalButton}><Text style={s.modalButtonText}>Consultar no WhatsApp</Text></TouchableOpacity>
            </>}
            {dialog==='deletion'&&<>
              <Text style={s.text}>
                {deletionPending
                  ? (deletionRequest?.status==='in_review'
                    ? 'Sua solicitação está em análise pelo estúdio.'
                    : 'Sua solicitação foi registrada e aguarda análise.')
                  : 'Ao solicitar a exclusão, o estúdio receberá seu pedido para avaliação. Sua conta e seus agendamentos não serão apagados automaticamente.'}
              </Text>
              {!!deletionRequest?.response_note && <Text style={s.text}>
                Última resposta registrada: {deletionRequest.response_note}
              </Text>}
              <Text style={s.small}>A análise leva em conta eventuais obrigações legais de conservação. Confira o Aviso de Privacidade ou fale com o estúdio.</Text>
              {!deletionPending&&<TouchableOpacity onPress={requestDeletion} disabled={busy}
                style={[s.modalButton,{backgroundColor:C.red}]}>
                <Text style={s.modalButtonText}>Registrar solicitação de exclusão</Text>
              </TouchableOpacity>}
            </>}
            {!!message&&<Text style={s.modalMessage}>{message}</Text>}
            {busy&&<ActivityIndicator color={C.mocha} style={{marginTop:12}}/>}
          </ScrollView>
        </View>
      </View>
    </Modal>
    <PrivacyNotice visible={privacyOpen} onClose={()=>setPrivacyOpen(false)}/>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.background},
  scroll:{paddingBottom:38,paddingHorizontal:17,maxWidth:620,width:'100%',alignSelf:'center'},
  header:{minHeight:73,flexDirection:'row',alignItems:'center',gap:9,
    borderBottomWidth:1,borderBottomColor:C.border,marginBottom:15},
  back:{width:35,alignItems:'flex-start',justifyContent:'center'},
  headerTitle:{color:C.ink,fontSize:21,fontWeight:'800',flex:1,textAlign:'center',letterSpacing:-.4},
  refresh:{width:35,alignItems:'center'},
  identity:{backgroundColor:C.white,borderRadius:17,paddingHorizontal:15,
    paddingVertical:17,flexDirection:'row',alignItems:'center',gap:14,
    marginBottom:17,borderWidth:1,borderColor:C.border},
  avatar:{width:65,height:65,borderRadius:33,backgroundColor:C.brown,
    alignItems:'center',justifyContent:'center',overflow:'hidden'},
  avatarImage:{width:65,height:65,borderRadius:33},
  avatarLetters:{fontSize:23,fontWeight:'700',color:C.white},
  name:{fontSize:18,fontWeight:'800',color:C.ink},
  identitySub:{fontSize:12,color:C.mocha,marginTop:5,lineHeight:18},
  section:{backgroundColor:C.white,borderRadius:18,borderWidth:1,borderColor:C.border,
    paddingHorizontal:17,paddingTop:14,paddingBottom:3,marginBottom:16,
    shadowColor:'#543F34',shadowOpacity:.05,shadowRadius:7,
    shadowOffset:{width:0,height:3},elevation:1},
  sectionTitle:{fontSize:15,fontWeight:'800',color:C.ink,marginBottom:6,letterSpacing:.15},
  row:{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:13,
    borderBottomWidth:1,borderBottomColor:'#F2ECE6',minHeight:60},
  rowTitle:{fontSize:14,fontWeight:'600',color:C.ink},
  rowSubtitle:{fontSize:11,color:C.muted,marginTop:5,lineHeight:16},
  rowValue:{fontSize:11,color:C.mocha,flexShrink:1,maxWidth:120,textAlign:'right'},
  notificationsLink:{flexDirection:'row',alignItems:'center',
    justifyContent:'space-between',paddingVertical:15},
  notificationsLinkText:{fontSize:12,fontWeight:'700',color:C.mocha},
  warning:{color:C.red,fontSize:12,padding:12,marginBottom:10},
  message:{fontSize:12,color:C.green,backgroundColor:'#EDF7EF',
    padding:12,borderRadius:10,marginBottom:12},
  logout:{paddingVertical:16,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:9},
  logoutText:{color:C.brown,fontWeight:'700',fontSize:14},
  editBack:{padding:16,flexDirection:'row',gap:6,alignItems:'center',
    backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border},
  editBackText:{fontWeight:'700',color:C.brown,fontSize:13},
  modalOverlay:{flex:1,backgroundColor:'rgba(31,22,18,.55)',
    justifyContent:'center',alignItems:'center',padding:18},
  modal:{width:'100%',maxWidth:460,maxHeight:'85%',borderRadius:19,
    backgroundColor:C.white,overflow:'hidden'},
  modalHeader:{padding:19,flexDirection:'row',justifyContent:'space-between',
    alignItems:'center',borderBottomWidth:1,borderBottomColor:C.border},
  modalTitle:{fontSize:19,fontWeight:'800',color:C.ink,flex:1},
  modalBody:{padding:19},
  option:{flexDirection:'row',alignItems:'center',gap:10,
    padding:14,borderWidth:1,borderColor:C.border,borderRadius:12,marginBottom:9},
  optionSelected:{backgroundColor:C.soft,borderColor:C.gold},
  optionText:{fontSize:14,fontWeight:'700',color:C.ink},
  optionSub:{fontSize:12,color:C.muted,marginTop:4},
  infoBox:{padding:2},
  text:{color:C.ink,fontSize:14,lineHeight:22,marginBottom:12},
  small:{color:C.muted,fontSize:12,lineHeight:19,marginBottom:14},
  inputsRow:{flexDirection:'row',gap:12,marginBottom:12},
  shortInput:{minWidth:90,flex:1,borderWidth:1,borderColor:C.border,
    borderRadius:11,padding:14,fontSize:15,color:C.ink},
  input:{borderColor:C.border,borderWidth:1,borderRadius:11,
    padding:14,fontSize:14,color:C.ink,marginBottom:13},
  modalButton:{padding:15,borderRadius:12,backgroundColor:C.brown,
    alignItems:'center',marginTop:5},
  modalButtonText:{color:C.white,fontSize:13,fontWeight:'800',textAlign:'center'},
  modalMessage:{color:C.red,fontSize:12,lineHeight:19,marginTop:13},
});
