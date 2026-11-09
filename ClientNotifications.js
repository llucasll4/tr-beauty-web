import React from 'react';
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
        {!loading && items.map(item => {
          const unread = !item.read_at;
          return (
            <TouchableOpacity key={item.id} style={[s.notice, unread && s.noticeUnread]}
              onPress={() => unread && onMarkRead(item.id)} accessibilityRole="button"
              accessibilityLabel={item.title + (unread ? ', não lida' : ', lida')}>
              <View style={[s.noticeIcon, item.type === 'booking_cancelled' && s.cancelIcon]}>
                <Ionicons name={iconTypes[item.type] || 'notifications-outline'}
                  size={23} color={item.type === 'booking_cancelled' ? C.red : C.mocha}/>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.noticeTitleRow}>
                  <Text style={s.noticeTitle}>{item.title}</Text>
                  {unread && <View style={s.dot}/>}
                </View>
                <Text style={s.noticeBody}>{item.body}</Text>
                <Text style={s.noticeDate}>{dateLabel(item.visible_at || item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  footnote: { marginTop: 20, fontSize: 11, color: C.muted, lineHeight: 18 },
});
