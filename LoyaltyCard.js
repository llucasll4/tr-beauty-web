import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import { getVipProgress } from './vipProgress';

// Cores amostradas da referência da Home; não altera cálculos nem saldos.
const C = { ink: '#30231E', mocha: '#A1754D', nude: '#F0E8DE', muted: '#64574F', brown: '#402816', gold: '#C5A06C' };
const fmtDate = v => new Date(v).toLocaleDateString('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
});

export default function LoyaltyCard({ userId, refreshSignal = 0, onOpenDetails }) {
  const [summary, setSummary] = useState(null);
  const [vipSummary, setVipSummary] = useState(null);
  const [vipSettings, setVipSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const [points, vip, thresholds] = await Promise.all([
        supabase.rpc('get_my_loyalty'),
        supabase.rpc('get_my_vip_summary'),
        supabase.from('vip_settings').select('silver_points,gold_points').eq('id', 1).maybeSingle(),
      ]);
      const failed = [points, vip, thresholds].find(result => result.error);
      if (failed) throw failed.error;
      if (requestId !== requestRef.current) return;
      setSummary(points.data || null);
      setVipSummary(vip.data || null);
      setVipSettings(thresholds.data || null);
      setError('');
    } catch (e) {
      if (requestId === requestRef.current) {
        setError('Não conseguimos atualizar seus pontos agora. Tente novamente.');
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    load();
    // A tabela de pontos não está na publicação Realtime deste Supabase.
    // Atualização automática enquanto a Home está aberta, ao voltar ao app
    // e ao retornar à tela inicial depois de uma movimentação.
    const interval = setInterval(() => load(true), 60000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') load(true);
    });
    return () => {
      requestRef.current += 1;
      clearInterval(interval);
      subscription.remove();
    };
  }, [load, userId, refreshSignal]);

  const balance = Math.max(0, Number(summary?.balance || 0));
  const vip = getVipProgress(vipSummary, vipSettings);
  const history = Array.isArray(summary?.recent_history) ? summary.recent_history : [];
  const digits = number => Number(number || 0).toLocaleString('pt-BR');

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.brand}>TR BEAUTY CONCEPT</Text>
        <Ionicons name="diamond-outline" size={21} color={C.gold}/>
      </View>
      {loading ? <ActivityIndicator color={C.mocha} style={{ marginVertical: 20 }}/> : (
        <>
          <Text style={s.balance}>{summary ? digits(balance) : '—'}</Text>
          <View style={s.pointsLabelRow}>
            <Text style={s.label}>TR Points</Text>
            <Ionicons name="star" size={22} color={C.gold} style={s.labelStar}
              accessibilityLabel="Estrela dourada"/>
          </View>
          {summary?.enabled && vip && <>
            <View style={s.levelRow}>
              <Text style={s.levelLabel}>NÍVEL {vip.tier.toLocaleUpperCase('pt-BR')}</Text>
              <Text style={s.levelNext}>
                {vip.nextTier ? 'Próximo: ' + vip.nextTier : 'Nível máximo'}
              </Text>
            </View>
            <View style={s.track} accessibilityRole="progressbar"
              accessibilityValue={{min:0,max:100,now:Math.round(vip.progress)}}>
              <View style={[s.fill, { width: vip.progress + '%' }]}/>
            </View>
            {vip.nextTier ? <>
              <Text style={s.goal}>
                {'Meta para ' + vip.nextTier + ': ' + digits(vip.goal) + ' pontos acumulados'}
              </Text>
              <Text style={s.helper}>
                {digits(vip.lifetime) + ' pontos acumulados · Faltam ' +
                  digits(vip.remaining) + ' para subir de nível'}
              </Text>
            </> : <>
              <Text style={s.goal}>Você alcançou o nível Ouro! 🏆</Text>
              <Text style={s.helper}>
                {digits(vip.lifetime) + ' pontos acumulados · Nível máximo do Clube VIP'}
              </Text>
            </>}
            <Text style={s.note}>
              A evolução de nível considera pontos acumulados, não o saldo disponível para resgate.
            </Text>
          </>}
          {summary?.enabled && !vip && <Text style={s.helper}>
            Não foi possível consultar a meta do seu nível. Atualize para tentar novamente.
          </Text>}
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
      <TouchableOpacity style={s.refresh} onPress={() => load()} disabled={loading} accessibilityLabel="Atualizar TR Points">
        <Ionicons name="refresh" size={15} color={C.mocha}/>
        <Text style={s.refreshText}>Atualizar pontos e nível</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.nude, borderRadius: 20, padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: '#E9DCCC',
    shadowColor: '#B88E63', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11, shadowRadius: 15, elevation: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  brand: { fontSize: 12, letterSpacing: 2, fontWeight: '600', color: C.ink },
  balance: { fontSize: 48, fontWeight: '300', color: C.ink, lineHeight: 54 },
  pointsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 17 },
  label: { fontSize: 16, fontWeight: '500', color: C.mocha },
  labelStar: { textShadowColor: '#F8E4BA', textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    alignItems: 'center', gap: 7, marginBottom: 10 },
  levelLabel: { color: C.ink, fontWeight: '700', fontSize: 12, letterSpacing: 0.6 },
  levelNext: { color: C.mocha, fontSize: 12, fontWeight: '600' },
  track: { backgroundColor: '#E1D4C7', height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { backgroundColor: '#BD925E', height: 7, borderRadius: 4 },
  goal: { color: C.ink, fontWeight: '700', fontSize: 12, marginTop: 12, lineHeight: 19 },
  helper: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 18 },
  note: { fontSize: 11, color: C.mocha, lineHeight: 17, marginTop: 10 },
  error: { color: '#B42318', fontSize: 12, marginTop: 8 },
  history: { borderTopWidth: 1, borderColor: '#D8CEC5', marginTop: 18, paddingTop: 13 },
  historyTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 7 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  historyDate: { fontSize: 12, color: C.muted },
  historyPoints: { fontSize: 12, color: '#397C59', fontWeight: '700' },
  details: { backgroundColor: C.brown, paddingVertical: 13, paddingHorizontal: 15,
    borderRadius: 11, marginTop: 18, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 9,
    shadowColor: '#8D5B34', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13, shadowRadius: 8, elevation: 2 },
  detailsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  refresh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, paddingVertical: 5 },
  refreshText: { marginLeft: 6, color: C.mocha, fontSize: 12, fontWeight: '700' },
});
