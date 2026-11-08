import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  white: '#FFFFFF', ink: '#2C2C2C', mocha: '#7A655B',
  muted: '#8E8E93', nude: '#EBE5DF', bg: '#FDFBF7',
  green: '#247047', red: '#B42318',
};
const PAGE_SIZE = 40;
const HISTORY_SIZE = 25;
const STATUS = {
  pending: 'Pendente', confirmed: 'Confirmado',
  completed: 'Concluído', cancelled: 'Cancelado',
};
const cash = value => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency', currency: 'BRL',
});
const dateLabel = value => value
  ? new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '—';
const timeLabel = value => value
  ? new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';
function whatsappNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return null;
}
function Photo({ path, size = 48 }) {
  const uri = path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.nude }}/>
  ) : (
    <View style={[s.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person-outline" size={size * .48} color={C.mocha}/>
    </View>
  );
}

// O componente é renderizado apenas dentro do painel Admin.
// A função SQL e o RLS conferem o acesso novamente no servidor.
export default function AdminClients() {
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyError, setLoyaltyError] = useState('');
  const selected = clients.find(c => c.id === selectedId) || null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      const { data, error: requestError } = await supabase.rpc('admin_list_clients', {
        p_search: query,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (!active) return;
      if (requestError) throw requestError;
      const rows = data || [];
      setClients(old => page === 0 ? rows : [ ...old, ...rows ]);
      setMore(rows.length === PAGE_SIZE);
    })().catch(e => {
      if (active) setError('Não foi possível consultar as clientes: ' + (e?.message || 'Erro desconhecido'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, page, refresh]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    (async () => {
      const { data, error: requestError } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price_at_booking, services(name)')
        .eq('client_id', selectedId)
        .order('starts_at', { ascending: false })
        .range(historyPage * HISTORY_SIZE, (historyPage + 1) * HISTORY_SIZE - 1);
      if (!active) return;
      if (requestError) throw requestError;
      const rows = data || [];
      setHistory(old => historyPage === 0 ? rows : [ ...old, ...rows ]);
      setHistoryMore(rows.length === HISTORY_SIZE);
    })().catch(e => {
      if (active) setHistoryError('Falha ao carregar o histórico: ' + (e?.message || 'Erro desconhecido'));
    }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selectedId, historyPage, refresh]);

  useEffect(() => {
    if (!selectedId) {
      setLoyalty(null);
      setLoyaltyError('');
      return;
    }
    let active = true;
    setLoyalty(null);
    setLoyaltyError('');
    supabase.rpc('admin_client_loyalty', { p_client_id: selectedId })
      .then(({ data, error: requestError }) => {
        if (!active) return;
        if (requestError) throw requestError;
        setLoyalty(data || null);
      })
      .catch(e => {
        if (active) setLoyaltyError('Falha ao consultar TR Points: ' + (e?.message || 'erro'));
      });
    return () => { active = false; };
  }, [selectedId, refresh]);

  function performSearch() {
    const next = searchText.trim();
    setSelectedId(null);
    setPage(0);
    if (next === query) setRefresh(value => value + 1);
    else setQuery(next);
  }
  function showClient(id) {
    setHistory([]);
    setHistoryPage(0);
    setSelectedId(id);
    setNotice('');
  }
  async function openWhatsapp() {
    const number = whatsappNumber(selected?.phone);
    if (!number) return;
    try { await Linking.openURL(`https://wa.me/${number}`); }
    catch { setNotice('Não foi possível abrir o WhatsApp neste dispositivo.'); }
  }

  return (
    <View style={s.root}>
      {!selected ? (
        <>
          <Text style={s.title}>Clientes</Text>
          <Text style={s.subtitle}>Lista e histórico • acesso exclusivo da administração</Text>
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Buscar nome, e-mail ou telefone"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              onSubmitEditing={performSearch}
              returnKeyType="search"
              accessibilityLabel="Buscar clientes"
            />
            <TouchableOpacity style={s.searchButton} onPress={performSearch} accessibilityLabel="Buscar">
              <Ionicons name="search" size={21} color={C.white}/>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.refreshButton} onPress={() => { setPage(0); setRefresh(n => n + 1); }}>
            <Ionicons name="refresh-outline" size={17} color={C.mocha}/>
            <Text style={s.link}>Atualizar clientes</Text>
          </TouchableOpacity>
          {!!error && <Text style={s.error}>{error}</Text>}
          {!loading && !error && clients.length === 0 && <Text style={s.empty}>Nenhuma cliente encontrada.</Text>}
          {clients.map(c => (
            <TouchableOpacity key={c.id} style={s.card} onPress={() => showClient(c.id)} accessibilityRole="button">
              <Photo path={c.avatar_path}/>
              <View style={s.cardInfo}>
                <Text style={s.clientName} numberOfLines={1}>{c.full_name || 'Cliente sem nome'}</Text>
                <Text style={s.cardDetail} numberOfLines={1}>{c.email || 'Sem e-mail'}</Text>
                <Text style={s.cardDetail} numberOfLines={1}>{c.phone || 'Telefone não informado'}</Text>
                <Text style={s.cardHint}>{c.completed_count} concluído(s) • {c.appointment_count} agendamento(s)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.mocha}/>
            </TouchableOpacity>
          ))}
          {loading && <ActivityIndicator color={C.mocha} style={{ marginTop: 14 }}/>} 
          {more && !loading && <TouchableOpacity onPress={() => setPage(n => n + 1)} style={s.outlineButton}><Text style={s.outlineText}>Carregar mais clientes</Text></TouchableOpacity>}
          <Text style={s.info}>As informações são exibidas apenas para o perfil administrador. Não é possível editar dados de clientes nesta tela.</Text>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => { setSelectedId(null); setNotice(''); }} style={s.back}>
            <Ionicons name="arrow-back-outline" size={19} color={C.mocha}/>
            <Text style={s.link}>Voltar às clientes</Text>
          </TouchableOpacity>
          <View style={s.detailCard}>
            <View style={s.profileHeader}>
              <Photo path={selected.avatar_path} size={68}/>
              <View style={{ flex: 1 }}>
                <Text style={s.detailName}>{selected.full_name || 'Cliente sem nome'}</Text>
                <Text style={s.cardDetail}>{selected.email || 'E-mail não informado'}</Text>
                <Text style={s.cardDetail}>{selected.phone || 'Telefone não informado'}</Text>
              </View>
            </View>
            <View style={s.hairline}/>
            <Text style={s.detailText}>Cadastrada em: {dateLabel(selected.created_at)}</Text>
            <Text style={s.detailText}>Primeiro atendimento concluído: {dateLabel(selected.first_completed_at)}</Text>
            <Text style={s.detailText}>Último agendamento: {dateLabel(selected.last_appointment_at)}</Text>
            <View style={s.metrics}>
              <View style={s.metric}><Text style={s.metricValue}>{selected.appointment_count}</Text><Text style={s.metricLabel}>Agendamentos</Text></View>
              <View style={s.metric}><Text style={s.metricValue}>{selected.completed_count}</Text><Text style={s.metricLabel}>Concluídos</Text></View>
            </View>
            <Text style={s.totalLabel}>Total dos serviços concluídos</Text>
            <Text style={s.totalValue}>{cash(selected.completed_total)}</Text>
            <Text style={s.smallNote}>Valor dos serviços, não comprovante de pagamento recebido.</Text>
            <Text style={s.totalLabel}>TR Points da cliente</Text>
            <Text style={s.totalValue}>{loyalty ? Number(loyalty.balance || 0).toLocaleString('pt-BR') + ' pontos' : '—'}</Text>
            {!!loyaltyError && <Text style={s.error}>{loyaltyError}</Text>
            {!!whatsappNumber(selected.phone) && (
              <TouchableOpacity style={s.whatsapp} onPress={openWhatsapp}>
                <Ionicons name="logo-whatsapp" size={20} color={C.white}/>
                <Text style={s.whatsappText}>Abrir conversa no WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!notice && <Text style={s.error}>{notice}</Text>}
          <Text style={s.sectionTitle}>Histórico de agendamentos</Text>
          {!!historyError && <Text style={s.error}>{historyError}</Text>}
          {!historyLoading && !historyError && history.length === 0 && <Text style={s.empty}>Esta cliente ainda não tem agendamentos.</Text>}
          {history.map(item => (
            <View key={item.id} style={s.historyCard}>
              <View style={s.historyHead}>
                <Text style={s.historyDate}>{timeLabel(item.starts_at)}</Text>
                <Text style={[s.status, item.status === 'completed' && { color: C.green }, item.status === 'cancelled' && { color: C.red }]}>
                  {STATUS[item.status] || item.status}
                </Text>
              </View>
              <Text style={s.serviceName}>{item.services?.name || 'Serviço não encontrado'}</Text>
              <Text style={s.cardDetail}>{cash(item.price_at_booking)}</Text>
            </View>
          ))}
          {historyLoading && <ActivityIndicator color={C.mocha} style={{ marginTop: 14 }}/>} 
          {historyMore && !historyLoading && <TouchableOpacity style={s.outlineButton} onPress={() => setHistoryPage(p => p + 1)}><Text style={s.outlineText}>Carregar mais atendimentos</Text></TouchableOpacity>}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingBottom: 20 },
  title: { fontSize: 21, fontWeight: '700', color: C.ink },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  searchInput: { flex: 1, minWidth: 0, backgroundColor: C.white, borderWidth: 1, borderColor: C.nude, padding: 13, borderRadius: 12, fontSize: 14, color: C.ink },
  searchButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 11, alignSelf: 'flex-start' },
  link: { color: C.mocha, fontWeight: '700', fontSize: 13 },
  error: { color: C.red, marginVertical: 12, fontSize: 13 },
  empty: { color: C.muted, fontSize: 13, padding: 15, backgroundColor: C.white, borderRadius: 12, marginTop: 8 },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.nude, padding: 12, borderRadius: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardInfo: { flex: 1, minWidth: 0, gap: 3 },
  clientName: { color: C.ink, fontSize: 15, fontWeight: '700' },
  cardDetail: { color: C.muted, fontSize: 12 },
  cardHint: { color: C.mocha, fontSize: 11, marginTop: 3 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.nude },
  info: { fontSize: 11, color: C.muted, lineHeight: 17, marginTop: 15 },
  outlineButton: { backgroundColor: C.white, borderWidth: 1, borderColor: C.mocha, padding: 13, borderRadius: 11, marginTop: 12, alignItems: 'center' },
  outlineText: { color: C.mocha, fontWeight: '700' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 2 },
  detailCard: { backgroundColor: C.white, borderRadius: 17, padding: 15, borderWidth: 1, borderColor: C.nude },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  detailName: { fontSize: 19, fontWeight: '700', color: C.ink },
  hairline: { height: 1, backgroundColor: C.nude, marginVertical: 16 },
  detailText: { fontSize: 12, color: C.ink, marginBottom: 6 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 12 },
  metric: { flex: 1, backgroundColor: C.bg, padding: 13, alignItems: 'center', borderRadius: 11 },
  metricValue: { fontSize: 19, fontWeight: '700', color: C.ink },
  metricLabel: { fontSize: 11, color: C.mocha, marginTop: 4 },
  totalLabel: { fontSize: 12, color: C.muted },
  totalValue: { fontSize: 23, fontWeight: '700', color: C.ink, marginTop: 5 },
  smallNote: { color: C.muted, fontSize: 10, marginTop: 5, marginBottom: 13 },
  whatsapp: { backgroundColor: '#286648', padding: 12, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', gap: 9, alignItems: 'center' },
  whatsappText: { color: C.white, fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: C.ink, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 },
  historyCard: { backgroundColor: C.white, borderRadius: 13, borderWidth: 1, borderColor: C.nude, padding: 13, marginBottom: 9 },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7, marginBottom: 5 },
  historyDate: { fontSize: 12, color: C.ink, fontWeight: '700' },
  status: { fontSize: 11, color: C.mocha, fontWeight: '700' },
  serviceName: { fontSize: 14, color: C.ink, fontWeight: '600', marginBottom: 4 },
});
