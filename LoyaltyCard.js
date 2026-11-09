import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = { ink: '#2C2C2C', mocha: '#7A655B', nude: '#EBE5DF', muted: '#6D625E' };
const fmtDate = v => new Date(v).toLocaleDateString('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
});

export default function LoyaltyCard({ onOpenDetails }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: e } = await supabase.rpc('get_my_loyalty');
      if (e) throw e;
      setSummary(data || null);
    } catch (e) {
      setError('Não foi possível consultar TR Points: ' + (e?.message || 'erro desconhecido'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const balance = Math.max(0, Number(summary?.balance || 0));
  const goal = Math.max(1, Number(summary?.goal_points || 300));
  const progress = Math.min(100, 100 * balance / goal);
  const history = Array.isArray(summary?.recent_history) ? summary.recent_history : [];

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.brand}>TR BEAUTY CONCEPT</Text>
        <Ionicons name="diamond-outline" size={21} color={C.ink}/>
      </View>
      {loading ? <ActivityIndicator color={C.mocha} style={{ marginVertical: 20 }}/> : (
        <>
          <Text style={s.balance}>{summary ? balance.toLocaleString('pt-BR') : '—'}</Text>
          <Text style={s.label}>TR Points</Text>
          {summary?.enabled && <>
            <View style={s.track}><View style={[s.fill, { width: progress + '%' }]}/></View>
            <Text style={s.helper}>{balance >= goal
              ? 'Você atingiu a meta de ' + goal + ' pontos! Consulte o estúdio sobre os benefícios.'
              : 'Faltam ' + (goal - balance) + ' pontos para a meta de ' + goal + '.'}</Text>
          </>}
          {summary && !summary.enabled && <Text style={s.helper}>O programa de fidelidade está pausado.</Text>}
          {!!error && <Text style={s.error}>{error}</Text>}
          {history.length > 0 && <View style={s.history}>
            <Text style={s.historyTitle}>Últimos movimentos</Text>
            {history.map((item, i) => <View key={item.created_at + '-' + i} style={s.historyRow}>
              <Text style={s.historyDate}>{fmtDate(item.created_at)}</Text>
              <Text style={[s.historyPoints, Number(item.points) < 0 && { color: '#A63D40' }]}>
                {Number(item.points) > 0 ? '+' : ''}{Number(item.points)} pts
              </Text>
            </View>)}
          </View>}
        </>
      )}
      <TouchableOpacity style={s.details} onPress={onOpenDetails} accessibilityRole="button"
        accessibilityLabel="Ver extrato completo do TR Points">
        <Text style={s.detailsText}>Ver meu extrato e serviços</Text>
        <Ionicons name="arrow-forward-outline" size={17} color="#FFFFFF"/>
      </TouchableOpacity>
      <TouchableOpacity style={s.refresh} onPress={load} disabled={loading} accessibilityLabel="Atualizar TR Points">
        <Ionicons name="refresh" size={15} color={C.mocha}/>
        <Text style={s.refreshText}>Atualizar saldo</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.nude, borderRadius: 20, padding: 24, marginBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { fontSize: 12, letterSpacing: 2, fontWeight: '600', color: C.ink },
  balance: { fontSize: 48, fontWeight: '300', color: C.ink, lineHeight: 54 },
  label: { fontSize: 16, fontWeight: '500', color: C.ink, marginBottom: 17 },
  track: { backgroundColor: '#D9D1C7', height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { backgroundColor: C.ink, height: 7, borderRadius: 4 },
  helper: { fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 17 },
  error: { color: '#B42318', fontSize: 12, marginTop: 8 },
  history: { borderTopWidth: 1, borderColor: '#D9D1C7', marginTop: 18, paddingTop: 13 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 7 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  historyDate: { fontSize: 12, color: C.muted },
  historyPoints: { fontSize: 12, color: '#246344', fontWeight: '700' },
  details: { backgroundColor: C.ink, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 11, marginTop: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  detailsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  refresh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, paddingVertical: 5 },
  refreshText: { marginLeft: 6, color: C.mocha, fontSize: 12, fontWeight: '700' },
});
