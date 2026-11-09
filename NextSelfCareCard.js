import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

// Usa a mesma paleta da Home: fundo claro, nude, mocha e grafite.
const C = {
  white: '#FFFFFF',
  ink: '#2C2C2C',
  mocha: '#7A655B',
  muted: '#756B65',
  nude: '#EBE5DF',
  border: '#E6DDD5',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});
const hourFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function serviceName(services) {
  if (Array.isArray(services)) return services[0]?.name || 'Serviço';
  return services?.name || 'Serviço';
}

// A cliente só vê o próprio próximo horário; a tabela appointments já protege
// a leitura por RLS. Não apresentar reservas canceladas, concluídas ou passadas.
export default function NextSelfCareCard({ userId, onOpenAppointments, refreshSignal = 0 }) {
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setNext(null);
      setLoading(false);
      return;
    }

    let active = true;
    const loadNext = async () => {
      try {
        const { data, error } = await supabase.from('appointments')
          .select('id,starts_at,status,services(name)')
          .eq('client_id', userId)
          .in('status', ['pending', 'confirmed'])
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (active) {
          setNext(data || null);
          setHasError(false);
        }
      } catch (_) {
        if (active) {
          setNext(null);
          setHasError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    loadNext();

    // Atualiza quando o estúdio confirmar/cancelar e quando o horário passar.
    const channel = supabase.channel('home-next-appointment-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
        filter: 'client_id=eq.' + userId,
      }, () => loadNext())
      .subscribe();
    const interval = setInterval(loadNext, 60000);

    return () => {
      active = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, refreshSignal]);

  if (loading) {
    return <View style={s.cardLoading} accessibilityLabel="Consultando próximo agendamento">
      <ActivityIndicator color={C.mocha} size="small" />
    </View>;
  }

  // Sem reserva futura, não ocupa espaço nem exibe informações fictícias.
  if (!next && !hasError) return null;

  if (hasError) {
    return <TouchableOpacity style={s.card} onPress={onOpenAppointments}
      accessibilityRole="button" accessibilityLabel="Consultar meus agendamentos">
      <View style={s.row}>
        <Ionicons name="calendar-outline" size={22} color={C.mocha}/>
        <View style={s.content}>
          <Text style={s.title}>Seu momento de autocuidado</Text>
          <Text style={s.detail}>Não foi possível consultar o próximo horário.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.mocha}/>
      </View>
    </TouchableOpacity>;
  }

  const when = new Date(next.starts_at);
  const date = dateFormatter.format(when);
  const dateLabel = date.charAt(0).toUpperCase() + date.slice(1);
  const status = next.status === 'confirmed' ? 'Agendamento confirmado' : 'Aguardando confirmação';

  return <TouchableOpacity style={s.card} onPress={onOpenAppointments}
    accessibilityRole="button"
    accessibilityLabel={'Seu momento de autocuidado. ' + dateLabel + ' às ' +
      hourFormatter.format(when) + '. ' + serviceName(next.services) + '. ' + status}>
    <View style={s.row}>
      <View style={s.iconBox}>
        <Ionicons name="calendar-outline" size={23} color={C.mocha}/>
      </View>
      <View style={s.content}>
        <Text style={s.title}>Seu momento de autocuidado</Text>
        <Text style={s.date}>{dateLabel} às {hourFormatter.format(when)}</Text>
        <Text style={s.detail} numberOfLines={2}>{serviceName(next.services)}</Text>
        <Text style={s.status}>{status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={C.mocha}/>
    </View>
  </TouchableOpacity>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 17,
    padding: 16,
    marginBottom: 18,
    shadowColor: C.ink,
    shadowOpacity: 0.06,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardLoading: { paddingVertical: 24, alignItems: 'center', marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 43, height: 43, backgroundColor: C.nude,
    borderRadius: 13, justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  title: { color: C.mocha, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  date: { color: C.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  detail: { color: C.muted, fontSize: 13, marginTop: 2, lineHeight: 19 },
  status: { color: C.mocha, fontSize: 11, marginTop: 6, fontWeight: '600' },
});
