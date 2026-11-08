import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  bg: '#FDFBF7', white: '#FFFFFF', ink: '#2C2C2C',
  nude: '#EBE5DF', mocha: '#7A655B', muted: '#8E8E93',
  border: '#EBE5DF', green: '#287451', red: '#A63D40',
};
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const LABELS = {
  pending: 'Pendente', confirmed: 'Confirmado',
  completed: 'Concluído', cancelled: 'Cancelado',
};
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});
function saoPauloDate(isoOrDate) {
  const parts = Object.fromEntries(dateParts.formatToParts(new Date(isoOrDate))
    .map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function moveMonth(value, by) {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + by, 1)).toISOString().slice(0, 7);
}
function monthTitle(value) {
  const [year, month] = value.split('-').map(Number);
  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    'pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }
  );
  return title.charAt(0).toUpperCase() + title.slice(1);
}
function monthCells(value) {
  const [year, month] = value.split('-').map(Number);
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push({ day: d, key: `${value}-${String(d).padStart(2, '0')}` });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
const money = n => Number(n || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});

export default function AdminCalendar() {
  const today = useMemo(() => saoPauloDate(new Date()), []);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // São Paulo usa UTC-03:00, sem horário de verão atualmente.
      const start = `${month}-01T00:00:00-03:00`;
      const nextMonth = moveMonth(month, 1);
      const end = `${nextMonth}-01T00:00:00-03:00`;
      const { data, error: queryError } = await supabase
        .from('appointments')
        .select('id,client_id,starts_at,ends_at,status,price_at_booking,services(name),profiles(full_name,phone)')
        .gte('starts_at', start)
        .lt('starts_at', end)
        .order('starts_at', { ascending: true })
        .limit(1000);
      if (queryError) throw queryError;
      setItems(data || []);
      if ((data || []).length === 1000) {
        setNotice('A lista atingiu o limite de 1.000 atendimentos neste mês.');
      }
    } catch (e) {
      setError('Não foi possível carregar a agenda: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const perDay = useMemo(() => {
    const result = {};
    for (const item of items) {
      const key = saoPauloDate(item.starts_at);
      (result[key] ||= []).push(item);
    }
    return result;
  }, [items]);
  const days = useMemo(() => monthCells(month), [month]);
  const todaysItems = perDay[selectedDate] || [];
  const activeItems = todaysItems.filter(x => x.status !== 'cancelled');
  const pending = activeItems.filter(x => x.status === 'pending').length;
  const confirmed = activeItems.filter(x => x.status === 'confirmed').length;
  const totalCompleted = todaysItems.filter(x => x.status === 'completed')
    .reduce((acc, x) => acc + Number(x.price_at_booking || 0), 0);

  function navigate(by) {
    const next = moveMonth(month, by);
    setMonth(next);
    const newToday = today.startsWith(next) ? today : `${next}-01`;
    setSelectedDate(newToday);
    setNotice('');
  }

  async function updateStatus(item, status) {
    if (savingId || loading) return;
    const permitted = (item.status === 'pending' && ['confirmed', 'cancelled'].includes(status)) ||
      (item.status === 'confirmed' && ['completed', 'cancelled'].includes(status));
    if (!permitted) return;
    setSavingId(item.id);
    setError('');
    setNotice('');
    try {
      const { data, error: updateError } = await supabase.from('appointments')
        .update({ status })
        .eq('id', item.id)
        .eq('status', item.status)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('O atendimento foi alterado por outra sessão. Atualize a agenda.');
      setNotice(`Atendimento ${LABELS[status].toLowerCase()} com sucesso.`);
      await load();
    } catch (e) {
      setError('Não foi possível atualizar: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <View style={s.root}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Agenda do estúdio</Text>
          <Text style={s.subTitle}>Atendimentos por data • horário de Brasília</Text>
        </View>
        <TouchableOpacity accessibilityLabel="Atualizar agenda" onPress={load} disabled={loading} style={s.refresh}>
          <Ionicons name="refresh" color={C.mocha} size={21}/>
        </TouchableOpacity>
      </View>
      <View style={s.calendarCard}>
        <View style={s.monthRow}>
          <TouchableOpacity accessibilityLabel="Mês anterior" onPress={() => navigate(-1)} style={s.arrow}>
            <Ionicons name="chevron-back" size={21} color={C.ink}/>
          </TouchableOpacity>
          <Text style={s.monthText}>{monthTitle(month)}</Text>
          <TouchableOpacity accessibilityLabel="Próximo mês" onPress={() => navigate(1)} style={s.arrow}>
            <Ionicons name="chevron-forward" size={21} color={C.ink}/>
          </TouchableOpacity>
        </View>
        <View style={s.calendarGrid}>
          {WEEKDAYS.map((d, i) => (
            <View key={`w-${i}`} style={s.dayCell}><Text style={s.weekday}>{d}</Text></View>
          ))}
          {days.map((d, i) => {
            const dayItems = d ? (perDay[d.key] || []) : [];
            const active = dayItems.filter(x => x.status !== 'cancelled');
            const chosen = d?.key === selectedDate;
            const current = d?.key === today;
            return (
              <View key={d?.key || `empty-${i}`} style={s.dayCell}>
                {d && <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${d.day} de ${monthTitle(month)}, ${active.length} atendimentos ativos`}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => { setSelectedDate(d.key); setNotice(''); }}
                  style={[s.dayButton, current && s.currentDay, chosen && s.daySelected]}
                >
                  <Text style={[s.dayNumber, chosen && s.daySelectedText]}>{d.day}</Text>
                  {active.length > 0 && <View style={[s.dot, chosen && s.dotSelected]}/>}
                </TouchableOpacity>}
              </View>
            );
          })}
        </View>
        <View style={s.legend}><View style={s.dot}/><Text style={s.legendText}>Dia com atendimento ativo</Text></View>
      </View>
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statNumber}>{pending}</Text><Text style={s.statName}>Pendentes</Text></View>
        <View style={s.stat}><Text style={s.statNumber}>{confirmed}</Text><Text style={s.statName}>Confirmados</Text></View>
        <View style={s.stat}><Text style={s.statNumber}>{money(totalCompleted)}</Text><Text style={s.statName}>Concluídos no dia</Text></View>
      </View>
      <Text style={s.selectedTitle}>{selectedDate.split('-').reverse().join('/')}</Text>
      {loading && <ActivityIndicator color={C.mocha} style={{ marginBottom: 16 }}/>} 
      {!!error && <Text style={s.error}>{error}</Text>}
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      {!loading && todaysItems.length === 0 && <Text style={s.empty}>Nenhum atendimento cadastrado nesta data.</Text>}
      {todaysItems.map(item => (
        <View key={item.id} style={[s.appointmentCard, item.status === 'cancelled' && { opacity: 0.60 }]}>
          <View style={s.appointmentTop}>
            <Text style={s.time}>{clock.format(new Date(item.starts_at))} – {clock.format(new Date(item.ends_at))}</Text>
            <Text style={[s.status, item.status === 'completed' && { color: C.green }, item.status === 'cancelled' && { color: C.red }]}>
              {LABELS[item.status] || item.status}
            </Text>
          </View>
          <Text style={s.client}>{item.profiles?.full_name || 'Cliente sem nome'}</Text>
          <Text style={s.details}>{item.services?.name || 'Serviço'} • {money(item.price_at_booking)}</Text>
          {!!item.profiles?.phone && <Text style={s.details}>Telefone: {item.profiles.phone}</Text>}
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <View style={s.actions}>
              {item.status === 'pending' && <TouchableOpacity disabled={!!savingId} style={s.action} onPress={() => updateStatus(item, 'confirmed')}><Text style={s.actionText}>Confirmar</Text></TouchableOpacity>}
              {item.status === 'confirmed' && <TouchableOpacity disabled={!!savingId} style={s.action} onPress={() => updateStatus(item, 'completed')}><Text style={s.actionText}>Concluir</Text></TouchableOpacity>}
              <TouchableOpacity disabled={!!savingId} style={s.actionOutline} onPress={() => updateStatus(item, 'cancelled')}><Text style={s.actionOutlineText}>Cancelar</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingTop: 8, paddingBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '700', color: C.ink },
  subTitle: { fontSize: 12, color: C.muted, marginTop: 4 },
  refresh: { padding: 10 },
  calendarCard: { padding: 15, borderRadius: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { padding: 8 }, monthText: { color: C.ink, fontWeight: '700', fontSize: 16 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285714%', height: 47, justifyContent: 'center', alignItems: 'center' },
  weekday: { fontSize: 11, color: C.muted, fontWeight: '700' },
  dayButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  currentDay: { borderWidth: 1, borderColor: C.mocha },
  daySelected: { backgroundColor: C.ink, borderColor: C.ink },
  dayNumber: { fontSize: 14, color: C.ink }, daySelectedText: { color: C.white, fontWeight: '700' },
  dot: { backgroundColor: C.mocha, width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  dotSelected: { backgroundColor: C.white },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendText: { fontSize: 11, color: C.muted },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.nude, padding: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statNumber: { fontSize: 15, fontWeight: '700', color: C.ink },
  statName: { fontSize: 10, color: C.mocha, marginTop: 5, textAlign: 'center' },
  selectedTitle: { fontSize: 18, fontWeight: '700', marginVertical: 18, color: C.ink },
  appointmentCard: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 15, backgroundColor: C.white, marginBottom: 10 },
  appointmentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  time: { fontWeight: '700', color: C.ink, fontSize: 13 },
  status: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  client: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  details: { fontSize: 12, color: C.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 9, backgroundColor: C.ink },
  actionText: { color: C.white, fontWeight: '600' },
  actionOutline: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 9, borderWidth: 1, borderColor: C.mocha },
  actionOutlineText: { color: C.mocha, fontWeight: '600' },
  error: { color: C.red, marginBottom: 15 }, notice: { color: C.green, marginBottom: 12 },
  empty: { fontSize: 13, color: C.muted, marginBottom: 16 },
});
