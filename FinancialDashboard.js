import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity,
  View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  ink: '#2C2C2C', mocha: '#7A655B', white: '#FFFFFF',
  border: '#E6DDD5', muted: '#756B65', soft: '#F2ECE6',
  bg: '#F4F5F7', green: '#276749', warning: '#9A6317',
};
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const currency = value => BRL.format(Number(value) || 0);
const count = value => Number(value) || 0;
function saoPauloCurrentDate() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month) };
}
function monthsOffset(year, month, diff) {
  const adjusted = new Date(Date.UTC(year, month - 1 + diff, 1));
  return { year: adjusted.getUTCFullYear(), month: adjusted.getUTCMonth() + 1 };
}
function monthName(year, month) {
  const text = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    'pt-BR', { timeZone: 'UTC', year: 'numeric', month: 'long' }
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function barLabel(bucket, year, month) {
  if (!month) return MONTH_NAMES[bucket - 1] || '';
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = 1 + (bucket - 1) * 7;
  return String(start) + '–' + String(Math.min(start + 6, maxDay));
}
const EMPTY = { metrics: { completed: 0, revenue: 0, ticket: 0, clients: 0,
  confirmed: 0, confirmed_value: 0, pending: 0, cancelled: 0 },
  series: [], services: [] };

function Metric({ label, value, note, icon, width, green }) {
  return (
    <View style={[s.metric, { width }]}>
      <View style={s.metricTop}>
        <Text style={s.metricLabel}>{label}</Text>
        <Ionicons name={icon} color={green ? C.green : C.mocha} size={20}/>
      </View>
      <Text style={[s.metricValue, green && { color: C.green }]} numberOfLines={1}
        adjustsFontSizeToFit>{value}</Text>
      <Text style={s.metricNote}>{note}</Text>
    </View>
  );
}

export default function FinancialDashboard() {
  const { width: screenWidth } = useWindowDimensions();
  const today = useMemo(saoPauloCurrentDate, []);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [mode, setMode] = useState('month');
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: result, error: queryError } = await supabase.rpc('p6_financial_dashboard', {
        p_year: year, p_month: mode === 'month' ? month : null,
      });
      if (queryError) throw queryError;
      if (!result || !result.metrics || !Array.isArray(result.series) ||
          !Array.isArray(result.services)) {
        throw new Error('O servidor não retornou os dados do painel.');
      }
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setData(EMPTY);
      setError('Não foi possível carregar o financeiro: ' + (err?.message || 'erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [year, month, mode]);

  useEffect(() => { load(); }, [load]);

  const metrics = data.metrics || EMPTY.metrics;
  const series = data.series || [];
  const services = data.services || [];
  const total = Number(metrics.revenue) || 0;
  const maxSeries = Math.max(1, ...series.map(item => Number(item.revenue) || 0));
  const maxService = Math.max(1, ...services.map(item => Number(item.revenue) || 0));
  const wide = screenWidth >= 790;
  const metricWidth = wide ? '23.5%' : '48%';

  const goPeriod = delta => {
    if (loading) return;
    if (mode === 'year') {
      setYear(y => Math.min(2099, Math.max(2000, y + delta)));
    } else {
      const n = monthsOffset(year, month, delta);
      if (n.year >= 2000 && n.year <= 2099) {
        setYear(n.year);
        setMonth(n.month);
      }
    }
  };

  return (
    <View style={s.root}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Painel financeiro</Text>
          <Text style={s.subtitle}>Desempenho dos atendimentos do estúdio</Text>
        </View>
        <TouchableOpacity onPress={load} disabled={loading}
          accessibilityRole="button" accessibilityLabel="Atualizar dados financeiros"
          style={[s.refresh, loading && { opacity: 0.5 }]}>
          <Ionicons name="refresh" size={22} color={C.mocha}/>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {[
          ['month', 'Mensal'],
          ['year', 'Anual'],
        ].map(([option, label]) => (
          <TouchableOpacity key={option} onPress={() => setMode(option)}
            accessibilityRole="button" accessibilityState={{ selected: mode === option }}
            style={[s.tab, mode === option && s.tabSelected]}>
            <Text style={[s.tabText, mode === option && s.tabTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.dateRow}>
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel="Período anterior" onPress={() => goPeriod(-1)} style={s.dateArrow}>
          <Ionicons name="chevron-back" color={C.ink} size={22}/>
        </TouchableOpacity>
        <Text style={s.dateTitle}>{mode === 'month' ? monthName(year, month) : year}</Text>
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel="Próximo período" onPress={() => goPeriod(1)} style={s.dateArrow}>
          <Ionicons name="chevron-forward" color={C.ink} size={22}/>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}
      {loading ? (
        <View style={s.loading}>
          <ActivityIndicator color={C.mocha}/>
          <Text style={s.help}>Calculando os indicadores financeiros...</Text>
        </View>
      ) : !error ? (
        <>
          <View style={s.metricsGrid}>
            <Metric label="Receita de atendimentos" value={currency(metrics.revenue)}
              note="Somente serviços concluídos" icon="cash-outline"
              width={metricWidth} green/>
            <Metric label="Atendimentos realizados" value={String(count(metrics.completed))}
              note="Marcados como concluídos" icon="checkmark-done-outline" width={metricWidth}/>
            <Metric label="Ticket médio" value={currency(metrics.ticket)}
              note="Valor médio por atendimento" icon="calculator-outline" width={metricWidth}/>
            <Metric label="Clientes atendidos" value={String(count(metrics.clients))}
              note="Clientes distintos no período" icon="people-outline" width={metricWidth}/>
          </View>

          <View style={s.panel}>
            <Text style={s.panelTitle}>{mode === 'month' ? 'Evolução por intervalo de 7 dias' : 'Evolução mensal'}</Text>
            <Text style={s.panelSub}>Valores de agendamentos concluídos em reais (R$)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[s.bars, { minWidth: mode === 'month' ? 370 : 610 }]}>
                {series.map(item => {
                  const value = Number(item.revenue) || 0;
                  return (
                    <View key={item.bucket} style={s.barCol}>
                      <Text style={s.barValue} numberOfLines={1}>
                        {value > 0 ? currency(value) : '—'}
                      </Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { height: value > 0 ?
                          Math.max(7, 118 * value / maxSeries) : 3 }]} />
                      </View>
                      <Text style={s.barName}>{barLabel(Number(item.bucket), year, mode === 'month' ? month : null)}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            {total === 0 && (
              <Text style={s.help}>Nenhum atendimento concluído neste período. Na Agenda, marque como concluídos os atendimentos realizados.</Text>
            )}
          </View>

          <View style={s.panel}>
            <Text style={s.panelTitle}>Receita por serviço</Text>
            <Text style={s.panelSub}>Distribuição de atendimentos concluídos</Text>
            {services.length === 0 ? (
              <Text style={s.help}>Sem serviços concluídos no período selecionado.</Text>
            ) : services.map(item => {
              const value = Number(item.revenue) || 0;
              return (
                <View key={item.service_id || item.name} style={s.serviceRow}>
                  <View style={s.serviceInfo}>
                    <Text style={s.serviceName} numberOfLines={2}>{String(item.name || '').trim()}</Text>
                    <Text style={s.servicePrice}>{currency(value)} · {count(item.completed)} atend.</Text>
                  </View>
                  <View style={s.serviceTrack}>
                    <View style={[s.serviceFill, { width: (100 * value / maxService) + '%' }]}/>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.panel}>
            <Text style={s.panelTitle}>Situação dos agendamentos</Text>
            <Text style={s.panelSub}>Reservas não são consideradas faturamento realizado.</Text>
            <View style={s.statusRow}>
              <View style={s.statusItem}>
                <Text style={s.statusValue}>{count(metrics.confirmed)}</Text>
                <Text style={s.statusLabel}>Confirmados</Text>
              </View>
              <View style={s.statusItem}>
                <Text style={s.statusValue}>{count(metrics.pending)}</Text>
                <Text style={s.statusLabel}>Pendentes</Text>
              </View>
              <View style={s.statusItem}>
                <Text style={s.statusValue}>{count(metrics.cancelled)}</Text>
                <Text style={s.statusLabel}>Cancelados</Text>
              </View>
            </View>
            <View style={s.projection}>
              <Text style={s.projectionLabel}>Valor das reservas confirmadas</Text>
              <Text style={s.projectionValue}>{currency(metrics.confirmed_value)}</Text>
              <Text style={s.help}>Valor previsto, separado da receita realizada; não inclui pedidos pendentes.</Text>
            </View>
          </View>

          <View style={s.footnote}>
            <Ionicons name="information-circle-outline" color={C.mocha} size={19}/>
            <Text style={s.footnoteText}>
              Os valores usam o preço registrado na reserva e a data do atendimento no horário de Brasília.
              “Receita” representa o valor dos serviços concluídos, não confirma que o pagamento foi recebido.
              Não inclui despesas, descontos posteriores ou taxas. A atualização não é em tempo real:
              toque em atualizar para buscar os dados mais recentes.
            </Text>
          </View>
          {!!lastUpdated && <Text style={s.updated}>
            Consultado às {lastUpdated.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} (Brasília)
          </Text>}
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingBottom: 35 },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 23, fontWeight: '700', color: C.ink },
  subtitle: { marginTop: 6, color: C.muted, fontSize: 13 },
  refresh: { padding: 11, borderColor: C.border, borderWidth: 1, backgroundColor: C.white, borderRadius: 11 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 15, backgroundColor: C.soft },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 9 },
  tabSelected: { backgroundColor: C.white },
  tabText: { fontSize: 14, fontWeight: '600', color: C.mocha },
  tabTextSelected: { color: C.ink, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 23 },
  dateArrow: { width: 43, height: 43, borderRadius: 21, borderColor: C.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  dateTitle: { fontWeight: '700', color: C.ink, fontSize: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  metric: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, minHeight: 128 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, alignItems: 'center', marginBottom: 10 },
  metricLabel: { fontSize: 12, color: C.muted, flex: 1, lineHeight: 17 },
  metricValue: { fontWeight: '800', fontSize: 21, color: C.ink },
  metricNote: { fontSize: 10, color: C.muted, marginTop: 9, lineHeight: 15 },
  panel: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 15 },
  panelTitle: { fontWeight: '700', color: C.ink, fontSize: 17 },
  panelSub: { color: C.muted, fontSize: 12, marginTop: 6, marginBottom: 20, lineHeight: 17 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 188, gap: 8, paddingVertical: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minWidth: 49 },
  barValue: { fontSize: 9, color: C.muted, marginBottom: 5, maxWidth: 76 },
  barTrack: { height: 118, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  barFill: { width: '70%', backgroundColor: C.mocha, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  barName: { marginTop: 9, fontSize: 11, color: C.muted, fontWeight: '600' },
  help: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 11 },
  serviceRow: { marginBottom: 19 },
  serviceInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 9 },
  serviceName: { color: C.ink, fontWeight: '700', fontSize: 13, flex: 1 },
  servicePrice: { fontSize: 12, color: C.mocha, fontWeight: '600' },
  serviceTrack: { height: 9, backgroundColor: C.soft, borderRadius: 5, overflow: 'hidden' },
  serviceFill: { height: '100%', backgroundColor: C.mocha, borderRadius: 5 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusItem: { alignItems: 'center', flex: 1, paddingVertical: 8 },
  statusValue: { fontSize: 26, color: C.ink, fontWeight: '700' },
  statusLabel: { color: C.muted, fontSize: 11, marginTop: 5 },
  projection: { backgroundColor: C.soft, padding: 16, borderRadius: 12, marginTop: 17 },
  projectionLabel: { color: C.ink, fontSize: 12, fontWeight: '600' },
  projectionValue: { fontWeight: '700', color: C.mocha, fontSize: 24, marginTop: 7 },
  footnote: { flexDirection: 'row', gap: 10, marginTop: 22, padding: 13, borderRadius: 12, borderColor: C.border, borderWidth: 1 },
  footnoteText: { flex: 1, fontSize: 11, lineHeight: 18, color: C.muted },
  updated: { color: C.muted, fontSize: 10, textAlign: 'right', paddingTop: 12 },
  loading: { alignItems: 'center', gap: 16, paddingVertical: 45 },
  error: { color: '#A52936', marginBottom: 15, lineHeight: 20 },
});
