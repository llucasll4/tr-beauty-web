import React, { useState } from 'react';
import {
  ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import { formatBrazilMobile, normalizeBrazilMobile } from './phoneUtils';

const C = {
  bg:'#FDFBF7', white:'#FFFFFF', ink:'#2C2C2C',
  mocha:'#7A655B', muted:'#766B65', border:'#EBE5DF', red:'#B24149',
};

// Existing accounts (including sign-in through Google) can provide the
// required phone without losing their existing bookings or points.
export default function CompletePhoneScreen({ user, onSaved, onLogout }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function complete() {
    if (busy) return;
    setError('');
    const mobile = normalizeBrazilMobile(phone);
    if (!mobile) {
      setError('Digite um celular válido com DDD, como (11) 91234-5678.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: saveError } = await supabase.from('profiles')
        .update({ phone: mobile }).eq('id', user.id)
        .select('id,phone').single();
      if (saveError) throw saveError;
      if (normalizeBrazilMobile(data?.phone) !== mobile) {
        throw new Error('O telefone não foi confirmado pelo servidor.');
      }
      onSaved();
    } catch (err) {
      setError('Não foi possível salvar seu celular: ' + (err?.message || 'tente novamente.'));
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={s.root}>
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View style={s.iconCircle}>
        <Ionicons name="phone-portrait-outline" size={32} color={C.mocha}/>
      </View>
      <Text style={s.brand}>TR Beauty Concept</Text>
      <Text style={s.title}>Vamos completar seu cadastro</Text>
      <Text style={s.description}>
        Para agendar seus serviços de unhas, precisamos de um número de celular válido
        com DDD. Seus agendamentos, pontos e dados anteriores continuam preservados.
      </Text>
      <View style={s.card}>
        <Text style={s.label}>Celular com DDD *</Text>
        <TextInput
          style={s.input}
          value={phone}
          onChangeText={value => setPhone(formatBrazilMobile(value))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="(11) 91234-5678"
          maxLength={15}
          accessibilityLabel="Celular obrigatório com DDD"
        />
        <Text style={s.helper}>
          O número será salvo no seu perfil. Informá-lo não autoriza mensagens
          promocionais nem ativa o WhatsApp automaticamente.
        </Text>
        {!!error && <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={C.red}/>
          <Text style={s.error}>{error}</Text>
        </View>}
        <TouchableOpacity style={[s.button,busy&&{opacity:.6}]}
          disabled={busy} onPress={complete} accessibilityRole="button">
          {busy?<ActivityIndicator color={C.white}/>:
            <Text style={s.buttonText}>Salvar celular e continuar</Text>}
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.logout} disabled={busy} onPress={onLogout}
        accessibilityRole="button">
        <Ionicons name="log-out-outline" size={18} color={C.mocha}/>
        <Text style={s.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  page:{padding:24,paddingVertical:40,flexGrow:1,justifyContent:'center',
    maxWidth:520,width:'100%',alignSelf:'center'},
  iconCircle:{width:70,height:70,borderRadius:35,backgroundColor:C.border,
    alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:17},
  brand:{fontSize:13,fontWeight:'700',textAlign:'center',color:C.mocha,letterSpacing:1},
  title:{fontSize:24,fontWeight:'700',textAlign:'center',color:C.ink,marginTop:14},
  description:{fontSize:14,color:C.muted,textAlign:'center',lineHeight:23,
    marginTop:12,marginBottom:24},
  card:{padding:22,backgroundColor:C.white,borderRadius:18,
    borderWidth:1,borderColor:C.border},
  label:{color:C.ink,fontWeight:'700',fontSize:14,marginBottom:10},
  input:{backgroundColor:C.white,borderColor:C.border,borderWidth:1,
    padding:16,borderRadius:12,fontSize:17,color:C.ink},
  helper:{color:C.muted,fontSize:12,lineHeight:19,marginTop:12},
  button:{backgroundColor:C.ink,borderRadius:12,alignItems:'center',justifyContent:'center',
    padding:17,marginTop:22,minHeight:54},
  buttonText:{color:C.white,fontWeight:'700',fontSize:14,textAlign:'center'},
  errorBox:{flexDirection:'row',gap:9,alignItems:'flex-start',marginTop:15},
  error:{color:C.red,fontSize:12,lineHeight:19,flex:1},
  logout:{alignSelf:'center',flexDirection:'row',alignItems:'center',gap:8,
    padding:15,marginTop:15},
  logoutText:{color:C.mocha,fontSize:13,fontWeight:'700'},
});
