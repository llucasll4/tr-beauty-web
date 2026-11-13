import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  ink: '#2C2C2C', muted: '#6C625C', mocha: '#7A655B',
  nude: '#EBE5DF', white: '#FFFFFF',
};

export default function NotificationPreferences({ userId }) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappConsentedAt, setWhatsappConsentedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from('notification_preferences')
      .select('email_enabled,whatsapp_enabled,whatsapp_consented_at')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setEmailEnabled(!!data?.email_enabled);
        setWhatsappEnabled(!!data?.whatsapp_enabled);
        setWhatsappConsentedAt(data?.whatsapp_consented_at || null);
      })
      .catch(e => {
        if (active) {
          setMessage('Erro ao carregar preferências: ' + e.message);
          setIsError(true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function save() {
    if (saving) return;
    setSaving(true); setMessage(''); setIsError(false);
    try {
      if (whatsappEnabled) {
        // Confirma o telefone salvo no banco, não apenas um campo editado na tela.
        const { data: profile, error: phoneError } = await supabase
          .from('profiles').select('phone').eq('id', userId).single();
        if (phoneError) throw phoneError;
        const digits = String(profile?.phone || '').replace(/\D/g, '');
        if (digits.length < 10) {
          throw new Error('Salve um telefone válido em Meu Perfil antes de ativar o WhatsApp.');
        }
      }
      const { error } = await supabase.from('notification_preferences').upsert({
        user_id: userId,
        email_enabled: emailEnabled,
        whatsapp_enabled: whatsappEnabled,
        whatsapp_consented_at: whatsappEnabled ? (whatsappConsentedAt || new Date().toISOString()) : null,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      if (whatsappEnabled && !whatsappConsentedAt) setWhatsappConsentedAt(new Date().toISOString());
      if (!whatsappEnabled) setWhatsappConsentedAt(null);
      setMessage('Preferências de notificações salvas.');
    } catch (e) {
      setMessage('Não foi possível salvar: ' + (e?.message || 'erro desconhecido'));
      setIsError(true);
    } finally { setSaving(false); }
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="notifications-outline" size={22} color={C.mocha}/>
        <Text style={s.title}>Notificações dos meus agendamentos</Text>
      </View>
      <Text style={s.info}>
        Você escolhe como receber pedidos, confirmações, cancelamentos e lembretes.
        Ambas as opções começam desativadas.
      </Text>
      {loading ? <ActivityIndicator color={C.mocha} style={{ marginTop: 14 }}/> : (
        <>
          <View style={s.row}>
            <View style={s.copy}>
              <Text style={s.label}>Receber por e-mail</Text>
              <Text style={s.small}>Usaremos o e-mail da sua conta.</Text>
            </View>
            <Switch value={emailEnabled} onValueChange={setEmailEnabled}
              trackColor={{ false: '#D1C7C0', true: C.mocha }} disabled={saving}
              accessibilityLabel="Ativar notificações por e-mail"/>
          </View>
          <View style={s.row}>
            <View style={s.copy}>
              <Text style={s.label}>Receber pelo WhatsApp</Text>
              <Text style={s.small}>
                Autorizo a TR Beauty Concept a enviar mensagens de agendamento
                para o telefone cadastrado. Posso cancelar a autorização aqui.
              </Text>
            </View>
            <Switch value={whatsappEnabled} onValueChange={setWhatsappEnabled}
              trackColor={{ false: '#D1C7C0', true: C.mocha }} disabled={saving}
              accessibilityLabel="Autorizar notificações por WhatsApp"/>
          </View>
          <Text style={s.foot}>
            Esses avisos são sobre seus agendamentos, não sobre promoções.
            Para receber pelo WhatsApp, mantenha seu telefone atualizado no perfil.
            O envio depende da disponibilidade desse canal no estúdio.
          </Text>
          {!!message && <Text style={[s.notice, isError && s.error]}>{message}</Text>}
          <TouchableOpacity onPress={save} disabled={saving} style={s.button}>
            <Text style={s.buttonText}>{saving ? 'Salvando...' : 'Salvar preferências de avisos'}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.nude, borderRadius: 15, padding: 16, marginTop: 5, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: C.ink, fontSize: 16, fontWeight: '700', flex: 1 },
  info: { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 14, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.nude },
  copy: { flex: 1 },
  label: { color: C.ink, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  small: { color: C.muted, fontSize: 12, lineHeight: 17 },
  foot: { color: C.muted, fontSize: 11, marginTop: 13, lineHeight: 16 },
  notice: { fontSize: 12, color: '#276749', marginTop: 13 },
  error: { color: '#A63D40' },
  button: { backgroundColor: C.ink, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  buttonText: { color: C.white, fontWeight: '700', fontSize: 13 },
});
