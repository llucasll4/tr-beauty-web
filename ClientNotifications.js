import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
  white: '#FFFFFF',
  bg: '#FDFBF7',
  ink: '#2C2C2C',
  mocha: '#7A655B',
  muted: '#756B65',
  border: '#EBE5DF',
  nude: '#F2ECE6',
  green: '#26704B',
  red: '#AD4D55',
};
const iconTypes = {
  booking_requested: 'calendar-outline',
  booking_confirmed: 'checkmark-circle-outline',
  booking_cancelled: 'close-circle-outline',
  reminder_24h: 'alarm-outline',
};
const dateLabel = timestamp => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' (Brasília)';
};

export default function ClientNotifications({
  items = [],
  unreadCount = 0,
  loading = false,
  error = '',
  updating = false,
  onBack,
  onRefresh,
  onMarkRead,
  onMarkAll,
  onOpenBookings,
}) {
  const [showRead, setShowRead] = useState(false);
  const [expandedRead, setExpandedRead] = useState(null);
  const { unread, read } = useMemo(() => {
    const sorted = [...items].sort((a, b) =>
      new Date(b.visible_at || b.created_at).getTime() -
      new Date(a.visible_at || a.created_at).getTime());
    return {
      unread: sorted.filter(item => !item.read_at),
      read: sorted.filter(item => !!item.read_at),
    };
  }, [items]);

  const renderUnread = item => (
    <TouchableOpacity key={item.id} style={[s.notice, s.noticeUnread]}
      onPress={() => onMarkRead(item.id)} disabled={updating}
      accessibilityRole="button" accessibilityLabel={item.title + ', não lida. Marcar como lida'}>
      <View style={[s.noticeIcon, item.type === 'booking_cancelled' && s.cancelIcon]}>
        <Ionicons name={iconTypes[item.type] || 'notifications-outline'} size={23}
          color={item.type === 'booking_cancelled' ? C.red : C.mocha}/>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.noticeTitleRow}>
          <Text style={s.noticeTitle}>{item.title}</Text>
          <View style={s.dot}/>
        </View>
        <Text style={s.noticeBody}>{item.body}</Text>
        <Text style={s.noticeDate}>{dateLabel(item.visible_at || item.created_at)}</Text>
        <Text style={s.readAction}>Toque para marcar como lida</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRead = item => {
    const expanded = expandedRead === item.id;
    return (
      <View key={item.id} style={s.readCard}>
        <TouchableOpacity accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={(expanded ? 'Recolher' : 'Ver') + ' detalhes de ' + item.title}
          onPress={() => setExpandedRead(expanded ? null : item.id)}
          style={s.readRow}>
          <View style={s.readIcon}>
            <Ionicons name={iconTypes[item.type] || 'notifications-outline'}
              size={19} color={C.mocha}/>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.readTitle} numberOfLines={expanded ? 3 : 1}>{item.title}</Text>
            <Text style={s.readDate}>{dateLabel(item.visible_at || item.created_at)}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={19} color={C.muted}/>
        </TouchableOpacity>
        {expanded && <Text style={s.readBody}>{item.body}</Text>}
      </View>
    );
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={onBack}
          accessibilityRole="button" accessibilityLabel="Voltar para Início">
          <Ionicons name="arrow-back-outline" size={22} color={C.ink}/>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notificações</Text>
          <Text style={s.subtitle}>
            {unreadCount > 0 ? unreadCount + ' não lida' + (unreadCount === 1 ? '' : 's') :
              'Tudo em dia por aqui'}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshButton} onPress={onRefresh}
          accessibilityRole="button" accessibilityLabel="Atualizar notificações"
          disabled={updating}>
          <Ionicons name="refresh-outline" size={21} color={C.mocha}/>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.topRow}>
          <Text style={s.heading}>Avisos dos seus agendamentos</Text>
          {unreadCount > 0 && (
            <TouchableOpacity accessibilityRole="button"
              disabled={updating}
              onPress={onMarkAll}>
              <Text style={s.markAll}>Marcar todas como lidas</Text>
            </TouchableOpacity>
          )}
        </View>
        {loading && <View style={s.center}>
          <ActivityIndicator color={C.mocha}/>
          <Text style={s.helper}>Carregando seus avisos...</Text>
        </View>}
        {!!error && (
          <View style={s.errorCard}>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" style={s.retry} onPress={onRefresh}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && items.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={43} color={C.mocha}/>
            <Text style={s.emptyTitle}>Você ainda não tem notificações</Text>
            <Text style={s.emptyDescription}>
              Quando houver novidades sobre seus pedidos, confirmações,
              cancelamentos ou lembretes, elas aparecerão aqui.
            </Text>
          </View>
        )}
        {!loading && !error && items.length > 0 && (
          <>
            <View style={s.sectionBar}>
              <View style={s.sectionLabel}>
                <Ionicons name="mail-unread-outline" size={19} color={C.mocha}/>
                <Text style={s.sectionTitle}>Não lidas</Text>
                <View style={s.countPill}>
                  <Text style={s.countText}>{unreadCount}</Text>
                </View>
              </View>
            </View>
            {unread.length > 0 ? unread.map(renderUnread) : (
              <View style={s.allReadState}>
                <Ionicons name="checkmark-circle-outline" size={22} color={C.green}/>
                <Text style={s.allReadText}>Tudo em dia! Nenhuma mensagem não lida.</Text>
              </View>
            )}
            {read.length > 0 && (
              <View style={s.readSection}>
                <TouchableOpacity style={s.readSectionToggle} accessibilityRole="button"
                  accessibilityState={{ expanded: showRead }}
                  accessibilityLabel={(showRead ? 'Ocultar' : 'Mostrar') + ' notificações lidas'}
                  onPress={() => setShowRead(value => !value)}>
                  <View style={s.sectionLabel}>
                    <Ionicons name="checkmark-done-outline" size={19} color={C.muted}/>
                    <Text style={s.readSectionTitle}>Lidas</Text>
                    <View style={s.readCountPill}>
                      <Text style={s.readCountText}>{read.length}</Text>
                    </View>
                  </View>
                  <View style={s.toggleRight}>
                    <Text style={s.toggleText}>{showRead ? 'Ocultar' : 'Mostrar'}</Text>
                    <Ionicons name={showRead ? 'chevron-up' : 'chevron-down'}
                      color={C.mocha} size={18}/>
                  </View>
                </TouchableOpacity>
                {showRead && <View style={s.readList}>{read.map(renderRead)}</View>}
              </View>
            )}
          </>
        )}
        {!loading && (
          <TouchableOpacity style={s.bookingsLink} onPress={onOpenBookings}
            accessibilityRole="button">
            <Ionicons name="calendar-outline" size={20} color={C.mocha}/>
            <Text style={s.bookingsText}>Consultar meus agendamentos</Text>
            <Ionicons name="chevron-forward-outline" size={17} color={C.mocha}/>
          </TouchableOpacity>
        )}
        <Text style={s.footnote}>
          Estes avisos ficam disponíveis dentro da sua conta.
          As notificações por e-mail e, futuramente, WhatsApp seguem as preferências
          configuradas no Perfil. Horários exibidos no fuso de Brasília.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row',
    alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  refreshButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 21, fontWeight: '700', color: C.ink },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 5 },
  scroll: { maxWidth: 760, width: '100%', alignSelf: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 44 },
  topRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap',
    alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heading: { fontSize: 16, fontWeight: '700', color: C.ink },
  markAll: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  notice: { padding: 17, backgroundColor: C.white, borderRadius: 15,
    borderWidth: 1, borderColor: C.border, flexDirection: 'row',
    gap: 13, marginBottom: 12 },
  noticeUnread: { backgroundColor: '#FFF9F3', borderColor: '#D9C6B7' },
  noticeIcon: { backgroundColor: C.nude, width: 45, height: 45, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center' },
  cancelIcon: { backgroundColor: '#FAEBEC' },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noticeTitle: { color: C.ink, fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20 },
  dot: { width: 8, height: 8, backgroundColor: C.mocha, borderRadius: 4 },
  noticeBody: { color: C.muted, fontSize: 13, lineHeight: 21 },
  noticeDate: { color: C.mocha, fontSize: 11, marginTop: 10, fontWeight: '600' },
  center: { alignItems: 'center', paddingVertical: 52, gap: 12 },
  helper: { color: C.muted, fontSize: 13 },
  errorCard: { padding: 17, borderRadius: 15, backgroundColor: C.white },
  error: { color: C.red, lineHeight: 21, fontSize: 13 },
  retry: { padding: 12, alignSelf: 'flex-start', borderRadius: 10, backgroundColor: C.nude, marginTop: 12 },
  retryText: { color: C.mocha, fontSize: 13, fontWeight: '700' },
  empty: { backgroundColor: C.white, borderRadius: 17, padding: 36,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.ink,
    marginTop: 14, textAlign: 'center' },
  emptyDescription: { textAlign: 'center', color: C.muted, marginTop: 9,
    fontSize: 13, lineHeight: 20 },
  bookingsLink: { flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: 13, backgroundColor: C.nude, padding: 15, marginTop: 16 },
  bookingsText: { flex: 1, color: C.mocha, fontWeight: '700', fontSize: 13 },
  sectionBar: { marginTop: 7, marginBottom: 14 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: '700' },
  countPill: { backgroundColor: C.mocha, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, minWidth: 26, alignItems: 'center' },
  countText: { color: C.white, fontSize: 11, fontWeight: '700' },
  allReadState: { flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, padding: 16, borderRadius: 13, marginBottom: 12,
    borderWidth: 1, borderColor: C.border },
  allReadText: { color: C.muted, fontSize: 13, flex: 1, lineHeight: 19 },
  readAction: { color: C.mocha, fontWeight: '600', fontSize: 11, marginTop: 12 },
  readSection: { marginTop: 17, backgroundColor: '#F5F0EB',
    borderRadius: 15, padding: 14, borderWidth: 1, borderColor: C.border },
  readSectionToggle: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, minHeight: 30 },
  readSectionTitle: { color: C.muted, fontSize: 15, fontWeight: '700' },
  readCountPill: { borderRadius: 10, backgroundColor: C.white,
    paddingHorizontal: 8, paddingVertical: 3 },
  readCountText: { fontSize: 11, color: C.mocha, fontWeight: '700' },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleText: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  readList: { marginTop: 14, gap: 8 },
  readCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readIcon: { height: 35, width: 35, borderRadius: 18, backgroundColor: C.nude,
    alignItems: 'center', justifyContent: 'center' },
  readTitle: { fontSize: 13, fontWeight: '600', color: C.muted, lineHeight: 18 },
  readDate: { fontSize: 11, color: C.muted, marginTop: 4 },
  readBody: { fontSize: 12, color: C.muted, lineHeight: 19, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  footnote: { marginTop: 20, fontSize: 11, color: C.muted, lineHeight: 18 },
});
