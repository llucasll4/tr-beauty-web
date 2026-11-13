import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import ClientReschedule from './ClientReschedule';

const C = {
  bg: '#FDFBF7', white: '#FFFFFF', ink: '#2C2C2C',
  mocha: '#7A655B', muted: '#756B65', border: '#E6DDD5',
  soft: '#F2ECE6', green: '#26704B', red: '#A73F46',
};
const LABELS = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
const statusColor = {
  pending: '#966817', confirmed: C.green, completed: C.mocha, cancelled: C.red,
};
const money = value => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
});
function serviceName(value) {
  if (Array.isArray(value)) return value[0]?.name || 'Serviço';
  return value?.name || 'Serviço';
}
function isUpcoming(item, now) {
  return item.starts_at && new Date(item.starts_at).getTime() >= now &&
    (item.status === 'pending' || item.status === 'confirmed');
}

export default function ClientAppointments({ userId, onNewBooking, onRescheduled = () => {}, refreshSignal = 0, notice = '' }) {
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [asOf, setAsOf] = useState(Date.now());
  const [reschedulingId,setReschedulingId] = useState(null);
  const [rescheduleNotice,setRescheduleNotice] = useState('');

  const PAGE_SIZE = 50;
  const getPage = useCallback(async (from) => {
    return await supabase.from('appointments')
      .select('id,starts_at,ends_at,status,price_at_booking,points_redeemed,services(name)')
      .eq('client_id', userId)
      .order('starts_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await getPage(0);
      if (queryError) throw queryError;
      setAppointments(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
      setAsOf(Date.now());
    } catch (err) {
      setError('Não conseguimos carregar suas reservas. Toque em atualizar para tentar novamente.');
    } finally {
      setLoading(false);
    }
  }, [getPage, userId]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true); setError('');
    try {
      const { data, error: queryError } = await getPage(appointments.length);
      if (queryError) throw queryError;
      const page = data || [];
      setAppointments(prev => {
        const known = new Set(prev.map(item => item.id));
        return [...prev, ...page.filter(item => !known.has(item.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
      setAsOf(Date.now());
    } catch (err) {
      setError('Não conseguimos carregar mais reservas. Tente novamente.');
    } finally {
      setLoadingMore(false);
    }
  };

  const upcoming = useMemo(() => appointments
    .filter(item => isUpcoming(item, asOf))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [appointments, asOf]);
  const history = useMemo(() => appointments
    .filter(item => !isUpcoming(item, asOf))
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)), [appointments, asOf]);

  const list = view === 'upcoming' ? upcoming : history;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Meus agendamentos</Text>
          <Text style={s.subtitle}>Seus próximos horários e atendimentos anteriores</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar meus agendamentos"
          style={s.refresh} onPress={load} disabled={loading || loadingMore}>
          <Ionicons name="refresh-outline" size={22} color={C.mocha}/>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.primary} onPress={onNewBooking} accessibilityRole="button"
          accessibilityLabel="Agendar novo horário">
          <Ionicons name="add-circle-outline" size={23} color={C.white}/>
          <Text style={s.primaryText}>Novo agendamento</Text>
        </TouchableOpacity>
        {!!(notice || rescheduleNotice) && (
          <View style={s.notice}>
            <Ionicons name="checkmark-circle-outline" color={C.green} size={22}/>
            <Text style={s.noticeText}>{rescheduleNotice || notice}</Text>
          </View>
        )}
        <View style={s.tabs}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: view === 'upcoming' }}
            style={[s.tab, view === 'upcoming' && s.tabActive]} onPress={() => setView('upcoming')}>
            <Text style={[s.tabText, view === 'upcoming' && s.tabTextActive]}>
              Próximos ({upcoming.length}{hasMore ? '+' : ''})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: view === 'history' }}
            style={[s.tab, view === 'history' && s.tabActive]} onPress={() => setView('history')}>
            <Text style={[s.tabText, view === 'history' && s.tabTextActive]}>
              Histórico ({history.length}{hasMore ? '+' : ''})
            </Text>
          </TouchableOpacity>
        </View>
        {loading && <View style={s.loading}>
          <ActivityIndicator color={C.mocha}/>
          <Text style={s.subtitle}>Buscando seus agendamentos...</Text>
        </View>}
        {!!error && <Text style={s.error}>{error}</Text>}
        {!loading && list.length === 0 && !error && (
          <View style={s.empty}>
            <Ionicons name={view === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              size={43} color={C.mocha}/>
            <Text style={s.emptyTitle}>
              {view === 'upcoming' ? 'Você não tem agendamentos futuros' : 'Seu histórico está vazio'}
            </Text>
            <Text style={s.emptyText}>
              {view === 'upcoming'
                ? 'Escolha um serviço para reservar seu próximo horário.'
                : 'Seus atendimentos anteriores e reservas canceladas aparecerão aqui.'}
            </Text>
            {view === 'upcoming' && (
              <TouchableOpacity onPress={onNewBooking} style={s.emptyButton}>
                <Text style={s.emptyButtonText}>Agendar agora</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!loading && list.map(item => {
          const status = LABELS[item.status] || 'Em análise';
          const color = statusColor[item.status] || C.mocha;
          const start = new Date(item.starts_at);
          const validDate = !Number.isNaN(start.getTime());
          return (
            <View key={item.id} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.service} numberOfLines={2}>{serviceName(item.services)}</Text>
                <View style={[s.pill, { backgroundColor: color + '17' }]}>
                  <Text style={[s.pillText, { color }]}>{status}</Text>
                </View>
              </View>
              <View style={s.detail}>
                <Ionicons name="calendar-outline" size={17} color={C.mocha}/>
                <Text style={s.detailText}>
                  {validDate ? dateFormatter.format(start) : 'Data indisponível'}
                </Text>
              </View>
              <View style={s.detail}>
                <Ionicons name="time-outline" size={17} color={C.mocha}/>
                <Text style={s.detailText}>
                  {validDate ? timeFormatter.format(start) : '—'} (horário de Brasília)
                </Text>
              </View>
              <View style={s.cardFoot}>
                <Text style={s.valueLabel}>{item.points_redeemed ? 'Resgatado com TR Points' : 'Valor do serviço'}</Text>
                <Text style={s.value}>{item.points_redeemed ?
                  Number(item.points_redeemed).toLocaleString('pt-BR')+' pts' : money(item.price_at_booking)}</Text>
              </View>
              {isUpcoming(item,asOf) && new Date(item.starts_at).getTime() > Date.now()+86400000 && <>
                <TouchableOpacity accessibilityRole="button"
                  accessibilityLabel={'Reagendar '+serviceName(item.services)}
                  onPress={()=>{
                    setRescheduleNotice('');
                    setReschedulingId(id=>id===item.id?null:item.id);
                  }} style={s.rescheduleButton}>
                  <Ionicons name="calendar-outline" color={C.mocha} size={17}/>
                  <Text style={s.rescheduleButtonText}>
                    {reschedulingId===item.id?'Fechar reagendamento':'Reagendar horário'}
                  </Text>
                </TouchableOpacity>
                {reschedulingId===item.id&&<ClientReschedule appointment={item}
                  onClose={()=>setReschedulingId(null)}
                  onSuccess={newStart=>{
                    setReschedulingId(null);
                    setRescheduleNotice('Novo horário solicitado: '+new Date(newStart).toLocaleString('pt-BR',{
                      timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',
                      hour:'2-digit',minute:'2-digit'
                    })+'. Aguarde a confirmação do estúdio.');
                    onRescheduled();
                    load();
                  }}/>} 
              </>}
              {item.status === 'pending' && (
                <Text style={s.statusNote}>O estúdio ainda precisa confirmar seu pedido.</Text>
              )}
              {item.status === 'cancelled' && (
                <Text style={s.statusNote}>Esta reserva foi cancelada.</Text>
              )}
            </View>
          );
        })}
        {!loading && hasMore && (
          <TouchableOpacity onPress={loadMore} disabled={loadingMore} style={s.loadMore}>
            {loadingMore ? <ActivityIndicator color={C.mocha}/> :
              <Text style={s.loadMoreText}>Carregar mais agendamentos</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 24, paddingVertical: 19, flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontSize: 21, fontWeight: '700', color: C.ink },
  subtitle: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 5 },
  refresh: { borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 9 },
  container: { padding: 24, paddingBottom: 45, maxWidth: 780, width: '100%', alignSelf: 'center' },
  primary: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.ink, borderRadius: 13, paddingVertical: 17, marginBottom: 18 },
  primaryText: { color: C.white, fontSize: 16, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EDF7F0',
    borderRadius: 12, padding: 14, marginBottom: 16 },
  noticeText: { color: C.green, fontWeight: '600', fontSize: 13, flex: 1, lineHeight: 19 },
  tabs: { flexDirection: 'row', backgroundColor: C.soft, padding: 4, borderRadius: 12, marginBottom: 20 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 13 },
  tabActive: { backgroundColor: C.white },
  tabText: { color: C.mocha, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: C.ink, fontWeight: '700' },
  loading: { alignItems: 'center', gap: 12, marginTop: 30 },
  error: { color: '#A52936', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  empty: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingVertical: 40, paddingHorizontal: 22, alignItems: 'center' },
  emptyTitle: { marginTop: 15, fontWeight: '700', color: C.ink, fontSize: 17, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  emptyButton: { backgroundColor: C.soft, marginTop: 18, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 18 },
  emptyButtonText: { color: C.mocha, fontWeight: '700' },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 18, marginBottom: 14 },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    alignItems: 'center', gap: 10, marginBottom: 15 },
  service: { fontWeight: '700', fontSize: 17, color: C.ink, flexShrink: 1 },
  pill: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  pillText: { fontSize: 11, fontWeight: '700' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  detailText: { fontSize: 13, color: C.muted, flex: 1 },
  cardFoot: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 10, paddingTop: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueLabel: { color: C.muted, fontSize: 12 },
  value: { color: C.ink, fontWeight: '700', fontSize: 15 },
  statusNote: { color: C.muted, marginTop: 12, fontSize: 12, lineHeight: 18 },
  rescheduleButton: { marginTop: 12, borderWidth: 1, borderColor: C.border,
    borderRadius: 11, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.soft },
  rescheduleButtonText: { color: C.mocha, fontSize: 13, fontWeight: '700' },
  loadMore: { marginTop: 8, alignItems: 'center', padding: 15, borderRadius: 11, backgroundColor: C.soft },
  loadMoreText: { color: C.mocha, fontWeight: '700' },
});
