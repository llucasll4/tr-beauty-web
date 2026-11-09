import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import AuthScreen from './AuthScreen';
import ProfileScreen from './ProfileScreen';
import AdminCalendar from './AdminCalendar';
import AdminManualBooking from './AdminManualBooking';
import AdminClients from './AdminClients';
import LoyaltyCard from './LoyaltyCard';
import TRPointsDashboard from './TRPointsDashboard';
import AdminPointsPrices from './AdminPointsPrices';
import PortfolioScreen from './PortfolioScreen';
import FinancialDashboard from './FinancialDashboard';
import ClientAppointments from './ClientAppointments';
import ClientNotifications from './ClientNotifications';

const { width } = Dimensions.get('window');
const imageSize = (width - 48 - 16) / 2;
const colors = {
  background: '#FDFBF7',
  white: '#FFFFFF',
  ink: '#2C2C2C',
  muted: '#8E8E93',
  nude: '#EBE5DF',
  mocha: '#7A655B',
  border: '#EBE5DF',
};

const greetingClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false,
});
function greetingForTime(timestamp) {
  const hour = Number(greetingClock.format(new Date(timestamp)));
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
const brazilClock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
const brazilDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
function localDateKey(date) {
  const parts = Object.fromEntries(brazilDate.formatToParts(date).map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function futureDates() {
  const today = localDateKey(new Date());
  const base = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }) };
  });
}
const readableDate = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const offsetMonth = (monthKey, offset) => {
  const [y, m] = monthKey.split('-').map(Number);
  const newDate = new Date(Date.UTC(y, m - 1 + offset, 1));
  return newDate.toISOString().slice(0, 7);
};
const initialBookableDate = () => futureDates().find(({ key }) => {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return weekday >= 2 && weekday <= 6;
})?.key || localDateKey(new Date());
function buildCalendar(monthKey, allowedDateKeys) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstColumn = (firstWeekday + 6) % 7; // Segunda-feira primeiro
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: firstColumn }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    cells.push({ key, day, enabled: allowedDateKeys.has(key) && weekday >= 2 && weekday <= 6 });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

function MainApp({ user, isAdmin, onLogout, onRequestAuth, initialScreen = 'Home', initialServiceId = null }) {
  const [currentScreen, setCurrentScreen] = useState(isAdmin ? 'Admin' : initialScreen);
  useEffect(() => {
    if(isAdmin && ['Booking','Profile','Points'].includes(currentScreen)) setCurrentScreen('Admin');
  },[isAdmin,currentScreen]);
  const [homeAvatar, setHomeAvatar] = useState(null);
  const [homeName, setHomeName] = useState('');
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(!!user);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationActionSaving, setNotificationActionSaving] = useState(false);
  const displayName = (
    homeName.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user ? 'Cliente' : 'Visitante')
  ).trim().split(/\s+/)[0];
  useEffect(() => {
    const id = setInterval(() => setCurrentTimestamp(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const cutoff = new Date().toISOString();
    try {
      const [list, number] = await Promise.all([
        supabase.from('notifications')
          .select('id,appointment_id,type,title,body,created_at,visible_at,read_at')
          .eq('profile_id', user.id).lte('visible_at', cutoff)
          .order('visible_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id).is('read_at', null)
          .lte('visible_at', cutoff),
      ]);
      if (list.error) throw list.error;
      if (number.error) throw number.error;
      setNotifications(list.data || []);
      setUnreadNotifications(number.count || 0);
      setNotificationsError('');
    } catch (e) {
      setNotificationsError('Não foi possível carregar as notificações: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setNotificationsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadNotifications(0);
      setNotificationsLoading(false);
      return;
    }
    loadNotifications();
    const channel = supabase.channel('client-notifications-' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: 'profile_id=eq.' + user.id,
      }, () => { loadNotifications(); })
      .subscribe();
    // Sincroniza mudanças e libera lembretes na hora programada,
    // mesmo se a conexão Realtime ficar indisponível.
    const interval = setInterval(loadNotifications, 60000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadNotifications]);

  useEffect(() => {
    if (user?.id && (currentScreen === 'Home' || currentScreen === 'Notifications'))
      loadNotifications();
  }, [currentScreen, user?.id, loadNotifications]);

  async function markNotificationRead(id = null) {
    if (!user?.id || notificationActionSaving) return;
    setNotificationActionSaving(true);
    try {
      let query = supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('profile_id', user.id)
        .is('read_at', null)
        .lte('visible_at', new Date().toISOString());
      if (id) query = query.eq('id', id);
      const { error } = await query;
      if (error) throw error;
      await loadNotifications();
    } catch (e) {
      setNotificationsError('Não foi possível atualizar os avisos: ' + (e?.message || 'erro desconhecido'));
    } finally { setNotificationActionSaving(false); }
  }

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setHomeAvatar(null);
      setHomeName('');
      return () => { active = false; };
    }
    // Inicializa o avatar na Home ao entrar na conta.
    // Alterações posteriores são sincronizadas pelo ProfileScreen.
    supabase.from('profiles')
      .select('avatar_path,full_name')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!active || error) return;
        const path = data?.avatar_path;
        const url = path
          ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now()
          : null;
        setHomeAvatar(url);
        setHomeName(data?.full_name || '');
      });
    return () => { active = false; };
  }, [user?.id]);
  const [bookingView, setBookingView] = useState(initialScreen === 'Booking' && initialServiceId ? 'new' : 'hub');
  const [myAppointmentsRefresh, setMyAppointmentsRefresh] = useState(0);
  const [adminSection, setAdminSection] = useState('agenda');
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedDate, setSelectedDate] = useState(initialBookableDate);
  const [calendarMonth, setCalendarMonth] = useState(() => initialBookableDate().slice(0, 7));
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingConfirmationVisible, setBookingConfirmationVisible] = useState(false);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [bookingWasRedeemed, setBookingWasRedeemed] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', category: '', price: '',
    duration_minutes: '', redeem_points: '300', active: true,
  });

  async function loadServices() {
    setServicesLoading(true);
    setServiceError('');
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id,name,description,category,price,duration_minutes,active,redeem_points')
        .order('name', { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      setServiceError('Não foi possível carregar os serviços: ' + error.message);
    } finally {
      setServicesLoading(false);
    }
  }

  useEffect(() => { loadServices(); }, [isAdmin]);

  async function reloadPoints() {
    if (!user) return;
    setPointsLoading(true);
    setPointsError('');
    try {
      const {data,error} = await supabase.rpc('get_my_loyalty');
      if (error) throw error;
      setPointsBalance(Math.max(0,Number(data?.balance||0)));
      setPointsEnabled(!!data?.enabled);
    } catch(err) {
      setPointsEnabled(false);
      setPointsError('Não foi possível verificar seu saldo: '+err.message);
    } finally { setPointsLoading(false); }
  }
  useEffect(() => {
    if (user && currentScreen==='Booking' && bookingView==='new') reloadPoints();
  },[user?.id,currentScreen,bookingView]);

  function beginNewService() {
    setEditingId(null);
    setServiceForm({ name: '', description: '', category: '', price: '', duration_minutes: '', redeem_points: String(300+100*services.length), active: true });
    setShowServiceForm(true);
    setServiceError('');
  }

  function beginEditService(service) {
    setEditingId(service.id);
    setServiceForm({
      name: service.name || '', description: service.description || '',
      category: service.category || '', price: String(service.price),
      duration_minutes: String(service.duration_minutes), redeem_points: String(service.redeem_points || 300), active: service.active,
    });
    setShowServiceForm(true);
    setServiceError('');
  }

  async function saveService() {
    if (!isAdmin) return;
    const price = Number(serviceForm.price.replace(',', '.'));
    const duration = Number(serviceForm.duration_minutes);
    const redeemPoints=Number(serviceForm.redeem_points);
    if (!serviceForm.name.trim() || !serviceForm.price.trim() ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(duration) || duration <= 0 ||
        !Number.isSafeInteger(redeemPoints) || redeemPoints < 1) {
      setServiceError('Preencha nome, preço, duração e custo de resgate em pontos (inteiro de pelo menos 1).');
      return;
    }
    setSavingService(true);
    setServiceError('');
    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      category: serviceForm.category.trim() || null,
      price, duration_minutes: duration, redeem_points: redeemPoints, active: serviceForm.active,
    };
    try {
      const query = editingId
        ? supabase.from('services').update(payload).eq('id', editingId)
        : supabase.from('services').insert(payload);
      const { error } = await query;
      if (error) throw error;
      setShowServiceForm(false);
      setEditingId(null);
      await loadServices();
    } catch (error) {
      setServiceError('Não foi possível salvar: ' + error.message);
    } finally {
      setSavingService(false);
    }
  }

  async function toggleService(service) {
    if (!isAdmin) return;
    setServiceError('');
    const { error } = await supabase.from('services')
      .update({ active: !service.active }).eq('id', service.id);
    if (error) {
      setServiceError('Não foi possível alterar o serviço: ' + error.message);
    } else {
      await loadServices();
    }
  }

  const money = (value) => Number(value).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  });
  const activeServices = services.filter((service) => service.active);

  const dates = futureDates();
  const allowedDateKeys = new Set(dates.map(date => date.key));
  const calendarCells = buildCalendar(calendarMonth, allowedDateKeys);
  const firstCalendarMonth = dates[0].key.slice(0, 7);
  const lastCalendarMonth = dates[dates.length - 1].key.slice(0, 7);
  const chosenService = activeServices.find(s => s.id === selectedServiceId);

  useEffect(() => {
    if (!selectedServiceId || !activeServices.some(s => s.id === selectedServiceId)) {
      setSelectedServiceId(activeServices[0]?.id || null);
    }
  }, [services, selectedServiceId]);

  useEffect(() => {
    let cancelled = false;
    setSelectedTime(null);
    setSlots([]);
    setBookingError('');
    if (!user || !selectedServiceId || !selectedDate) return;
    setSlotsLoading(true);
    supabase.rpc('available_slots', { p_service_id: selectedServiceId, p_date: selectedDate })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setSlots(data || []);
      })
      .catch(err => { if (!cancelled) setBookingError('Não foi possível consultar os horários: ' + err.message); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, selectedServiceId, selectedDate, bookingSuccess]);

  async function confirmBooking() {
    if (!user) { onRequestAuth('Booking', selectedServiceId); return; }
    if (!selectedServiceId || !selectedTime || bookingSaving) return;
    if (paymentMethod==='points' &&
        (!pointsEnabled || pointsLoading || !Number.isInteger(chosenService?.redeem_points) ||
         pointsBalance < chosenService.redeem_points)) {
      setBookingError('O resgate não está disponível ou seu saldo de pontos é insuficiente.');
      return;
    }
    setBookingSaving(true);
    setBookingError('');
    setBookingSuccess('');
    try {
      const withPoints=paymentMethod==='points';
      const { error } = await supabase.rpc(
        withPoints ? 'book_appointment_with_points' : 'book_appointment', {
          p_service_id: selectedServiceId, p_starts_at: selectedTime,
        });
      if (error) throw error;
      // Pedido recebido: não confundir envio com confirmação do estúdio.
      setBookingSuccess('');
      setSelectedTime(null);
      setPaymentMethod('cash');
      setBookingWasRedeemed(withPoints);
      setBookingView('hub');
      setMyAppointmentsRefresh(value => value + 1);
      setCurrentScreen('Home');
      setBookingConfirmationVisible(true);
      if (isAdmin) await loadAppointments();
    } catch (err) {
      setBookingError('Não foi possível reservar: ' + err.message);
      if (paymentMethod==='points') reloadPoints();
      setBookingSuccess('');
    } finally { setBookingSaving(false); }
  }

  async function loadAppointments() {
    if (!isAdmin) return;
    setAppointmentsLoading(true);
    setAppointmentsError('');
    try {
      const { data, error } = await supabase.from('appointments')
        .select('id,client_id,starts_at,ends_at,status,price_at_booking,services(name),profiles(full_name)')
        .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
        .order('starts_at', { ascending: true }).limit(150);
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      setAppointmentsError('Não foi possível carregar a agenda: ' + err.message);
    } finally { setAppointmentsLoading(false); }
  }
  useEffect(() => { if (isAdmin) loadAppointments(); }, [isAdmin]);

  async function changeAppointmentStatus(item, nextStatus) {
    if (!isAdmin || statusSavingId) return;
    setStatusSavingId(item.id);
    setAppointmentsError('');
    const { error } = await supabase.from('appointments').update({ status: nextStatus }).eq('id', item.id);
    if (error) setAppointmentsError('Falha ao atualizar: ' + error.message);
    else await loadAppointments();
    setStatusSavingId(null);
  }

  const HomeScreen = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.homeGreetingHeader}>
        <TouchableOpacity style={styles.greetingAvatarButton} accessibilityRole="button"
          accessibilityLabel={isAdmin ? 'Abrir meu perfil no Admin' : user ? 'Abrir perfil' : 'Entrar ou criar conta'}
          onPress={() => isAdmin ? (setAdminSection('perfil'),setCurrentScreen('Admin')) :
            user ? setCurrentScreen('Profile') : onRequestAuth('Profile')}>
          {user && homeAvatar
            ? <Image source={{ uri: homeAvatar }} style={styles.greetingAvatarImage}
                resizeMode="cover" accessibilityLabel="Minha foto de perfil" />
            : <Ionicons name="person-outline" size={29} color={colors.mocha}/>}
        </TouchableOpacity>
        <View style={styles.greetingTextBlock}>
          <Text style={styles.greetingDay}>{greetingForTime(currentTimestamp)} 💅🌟</Text>
          <Text style={styles.greetingFullName} numberOfLines={1}
            adjustsFontSizeToFit>{displayName}</Text>
        </View>
        <TouchableOpacity style={styles.homeBellButton} accessibilityRole="button"
          accessibilityLabel={user ? 'Abrir notificações' :
            'Entre na sua conta para ver notificações'}
          onPress={() => user ? setCurrentScreen('Notifications') : onRequestAuth('Home')}>
          <Ionicons name="notifications-outline" size={29} color={colors.ink}/>
          {user && unreadNotifications > 0 && (
            <View style={styles.homeBellBadge}>
              <Text style={styles.homeBellBadgeText}>
                {unreadNotifications > 9 ? '9+' : String(unreadNotifications)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {isAdmin ? (
        <View style={styles.guestCard}>
          <View style={styles.guestCardHeader}>
            <Ionicons name="settings-outline" size={24} color={colors.mocha}/>
            <Text style={styles.guestCardTitle}>Área administrativa</Text>
          </View>
          <Text style={styles.guestCardText}>Acesse a agenda, as clientes e as ferramentas do estúdio em um só lugar.</Text>
          <TouchableOpacity style={styles.guestCardButton} onPress={() => setCurrentScreen('Admin')}
            accessibilityRole="button">
            <Text style={styles.guestCardButtonText}>Abrir painel Admin</Text>
            <Ionicons name="arrow-forward-outline" size={16} color={colors.mocha}/>
          </TouchableOpacity>
        </View>
      ) : user ? <LoyaltyCard onOpenDetails={() => setCurrentScreen('Points')} /> : (
        <View style={styles.guestCard}>
          <View style={styles.guestCardHeader}>
            <Ionicons name="sparkles-outline" size={25} color={colors.mocha}/>
            <Text style={styles.guestCardTitle}>Conheça a TR Beauty Concept</Text>
          </View>
          <Text style={styles.guestCardText}>Veja nossos serviços e trabalhos sem precisar criar uma conta. Para reservar um horário, entre ou cadastre-se.</Text>
          <TouchableOpacity style={styles.guestCardButton} accessibilityRole="button"
            onPress={() => onRequestAuth('Home')}>
            <Text style={styles.guestCardButtonText}>Entrar ou criar conta</Text>
            <Ionicons name="arrow-forward-outline" size={16} color={colors.mocha}/>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton}
        onPress={() => { if (isAdmin) { setAdminSection('manual'); setCurrentScreen('Admin'); } else { setCurrentScreen('Booking'); if (user) { setBookingSuccess(''); setBookingView('new'); } } }}>
        <Text style={styles.primaryButtonText}>{isAdmin ? 'Agendar cliente' : 'Agendar Meu Horário'}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.background} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Serviços disponíveis</Text>
      {servicesLoading && <ActivityIndicator color={colors.mocha} />}
      {!!serviceError && !isAdmin && <Text style={styles.loginError}>{serviceError}</Text>}
      {!servicesLoading && activeServices.length === 0 && (
        <Text style={styles.subtitle}>Nenhum serviço disponível por enquanto.</Text>
      )}
      <View style={styles.servicesGrid}>
        {activeServices.map((service) => (
          <View key={service.id} style={styles.simpleServiceCard}>
            <Text style={styles.serviceTitle}>{service.name}</Text>
            <Text style={styles.serviceDetails}>
              {service.duration_minutes} min • {money(service.price)}
            </Text>
            {!!service.description && <Text style={styles.subtitle}>{service.description}</Text>}
          </View>
        ))}
      </View>
      {user && <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={18} color={colors.mocha} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>}
    </ScrollView>
  );

  const GuestBookingScreen = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Agendar um serviço</Text>
        <Text style={styles.subtitle}>Conheça os serviços e entre para escolher um horário</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.guestCard}>
          <View style={styles.guestCardHeader}>
            <Ionicons name="lock-closed-outline" size={25} color={colors.mocha}/>
            <Text style={styles.guestCardTitle}>Agendamento com cadastro</Text>
          </View>
          <Text style={styles.guestCardText}>Para consultar horários e confirmar uma reserva é necessário entrar ou criar sua conta gratuitamente.</Text>
        </View>
        <Text style={styles.sectionTitle}>Serviços disponíveis</Text>
        {servicesLoading && <ActivityIndicator color={colors.mocha}/>}
        {!!serviceError && <Text style={styles.loginError}>{serviceError}</Text>}
        {activeServices.map(service => (
          <TouchableOpacity key={service.id} accessibilityRole="button"
            style={[styles.bookingCard, selectedServiceId === service.id && styles.bookingCardSelected, { marginBottom: 10 }]}
            onPress={() => setSelectedServiceId(service.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>{service.name}</Text>
              <Text style={styles.serviceDetails}>{service.duration_minutes} min • {money(service.price)}</Text>
              {!!service.description && <Text style={styles.subtitle}>{service.description}</Text>}
            </View>
            <Ionicons name={selectedServiceId === service.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.mocha}/>
          </TouchableOpacity>
        ))}
        {!servicesLoading && !activeServices.length && <Text style={styles.subtitle}>Nenhum serviço disponível.</Text>}
        <TouchableOpacity style={[styles.confirmButton, { marginTop: 22 }]}
          onPress={() => onRequestAuth('Booking', selectedServiceId)} accessibilityRole="button">
          <Text style={styles.confirmButtonText}>Entrar ou criar conta para agendar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentScreen('Portfolio')} style={{ alignSelf: 'center', padding: 18 }}>
          <Text style={{ color: colors.mocha, fontWeight: '600' }}>Ver galeria de trabalhos</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const BookingScreen = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.pageHeader, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar aos meus agendamentos"
          style={{ padding: 7 }} onPress={() => { setBookingView('hub'); setBookingSuccess(''); }}>
          <Ionicons name="arrow-back-outline" size={24} color={colors.ink}/>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
        <Text style={styles.pageTitle}>Novo agendamento</Text>
        <Text style={styles.subtitle}>Terça a sábado, das 09h às 18h • horário de Brasília</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>1. Escolha o serviço</Text>
        {activeServices.map(service => (
          <TouchableOpacity key={service.id}
            style={[styles.bookingCard, selectedServiceId === service.id && styles.bookingCardSelected, { marginBottom: 10 }]}
            onPress={() => { setBookingSuccess(''); setBookingError(''); setSelectedServiceId(service.id); }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>{service.name}</Text>
              <Text style={styles.serviceDetails}>{service.duration_minutes} min • {money(service.price)}</Text>
              <Text style={[styles.serviceDetails,{marginTop:5,color:colors.mocha}]}>
                Resgate: {Number(service.redeem_points||0).toLocaleString('pt-BR')} TR Points
              </Text>
            </View>
            <Ionicons name={selectedServiceId === service.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.mocha} />
          </TouchableOpacity>
        ))}
        {!activeServices.length && <Text style={styles.subtitle}>Nenhum serviço ativo disponível.</Text>}
        <Text style={[styles.sectionTitle,{marginTop:24}]}>2. Forma de pagamento</Text>
        <View style={{flexDirection:'row',gap:10,marginBottom:14}}>
          <TouchableOpacity onPress={()=>{setPaymentMethod('cash');setBookingError('');}}
            accessibilityRole="button" accessibilityState={{selected:paymentMethod==='cash'}}
            style={[styles.bookingCard,{flex:1,justifyContent:'center'},paymentMethod==='cash'&&styles.bookingCardSelected]}>
            <Text style={{fontWeight:'700',color:colors.ink}}>No atendimento</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>{setPaymentMethod('points');setBookingError('');}}
            accessibilityRole="button" accessibilityState={{selected:paymentMethod==='points'}}
            style={[styles.bookingCard,{flex:1,justifyContent:'center'},paymentMethod==='points'&&styles.bookingCardSelected]}>
            <Text style={{fontWeight:'700',color:colors.ink}}>TR Points</Text>
          </TouchableOpacity>
        </View>
        {paymentMethod==='points'&&<View style={[styles.simpleServiceCard,{marginBottom:16}]}>
          <Text style={[styles.serviceTitle,{marginBottom:8}]}>Resgatar com TR Points</Text>
          {pointsLoading?<ActivityIndicator color={colors.mocha}/>:
           <Text style={styles.serviceDetails}>Saldo disponível: {pointsBalance.toLocaleString('pt-BR')} pts</Text>}
          <Text style={[styles.serviceDetails,{marginTop:6}]}>
            Custo do serviço: {Number(chosenService?.redeem_points||0).toLocaleString('pt-BR')} pts
          </Text>
          {!pointsLoading&&pointsEnabled&&pointsBalance<Number(chosenService?.redeem_points||0)&&
            <Text style={[styles.loginError,{marginTop:10}]}>Pontos insuficientes para este resgate.</Text>}
          {!pointsLoading&&!pointsEnabled&&
            <Text style={[styles.loginError,{marginTop:10}]}>Programa de pontos indisponível no momento.</Text>}
          {!!pointsError&&<Text style={styles.loginError}>{pointsError}</Text>}
          <Text style={[styles.subtitle,{marginTop:10}]}>
            Os pontos serão descontados ao enviar o pedido e devolvidos se o estúdio cancelar antes do atendimento.
            Este serviço não gera novos pontos.
          </Text>
        </View>}
        <Text style={[styles.sectionTitle,{marginTop:24}]}>3. Escolha a data</Text>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity accessibilityLabel="Mês anterior" disabled={calendarMonth <= firstCalendarMonth}
              onPress={() => setCalendarMonth(current => offsetMonth(current, -1))}
              style={styles.calendarArrow}>
              <Ionicons name="chevron-back" size={20} color={calendarMonth <= firstCalendarMonth ? '#D1C9C1' : colors.ink} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthTitle}>{monthLabel(calendarMonth)}</Text>
            <TouchableOpacity accessibilityLabel="Próximo mês" disabled={calendarMonth >= lastCalendarMonth}
              onPress={() => setCalendarMonth(current => offsetMonth(current, 1))}
              style={styles.calendarArrow}>
              <Ionicons name="chevron-forward" size={20} color={calendarMonth >= lastCalendarMonth ? '#D1C9C1' : colors.ink} />
            </TouchableOpacity>
          </View>
          <View style={styles.calendarGrid}>
            {WEEKDAYS.map(day => (
              <View key={day} style={styles.calendarCell}>
                <Text style={styles.calendarWeekday}>{day}</Text>
              </View>
            ))}
            {calendarCells.map((day, index) => (
              <View key={day?.key || `empty-${index}`} style={styles.calendarCell}>
                {day && (
                  <TouchableOpacity accessibilityRole="button"
                    accessibilityLabel={`${day.day} de ${monthLabel(calendarMonth)}`}
                    accessibilityState={{ disabled: !day.enabled, selected: selectedDate === day.key }}
                    disabled={!day.enabled}
                    onPress={() => {
                      setBookingSuccess('');
                      setBookingError('');
                      setSelectedDate(day.key);
                    }}
                    style={[styles.calendarDay, day.enabled && styles.calendarDayEnabled,
                      selectedDate === day.key && styles.calendarDaySelected]}>
                    <Text style={[styles.calendarDayText, !day.enabled && styles.calendarDayDisabledText,
                      selectedDate === day.key && styles.calendarDaySelectedText]}>{day.day}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.calendarHint}>Terça a sábado • datas disponíveis nos próximos 30 dias</Text>
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>4. Horários disponíveis</Text>
        {slotsLoading && <ActivityIndicator color={colors.mocha} />}
        {!slotsLoading && chosenService && slots.length === 0 && !bookingError && (
          <Text style={styles.subtitle}>Não há horários disponíveis nesta data. Escolha outra.</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {slots.map(item => {
            const chosen = selectedTime === item.starts_at;
            return (
              <TouchableOpacity key={item.starts_at} onPress={() => { setSelectedTime(item.starts_at); setBookingSuccess(''); }}
                style={chosen ? styles.timeBoxSelected : styles.timeBox}>
                <Text style={chosen ? styles.optionSelectedText : styles.optionText}>{brazilClock.format(new Date(item.starts_at))}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!!bookingError && <Text style={[styles.loginError, { marginTop: 15 }]}>{bookingError}</Text>}
        {!!bookingSuccess && <Text style={[styles.successText, { marginTop: 15 }]}>{bookingSuccess}</Text>}
      </ScrollView>
      <View style={styles.footerBooking}>
        {!!selectedTime && <Text style={[styles.subtitle, { marginBottom: 8 }]}>Selecionado: {readableDate(selectedTime)}</Text>}
        <TouchableOpacity disabled={!selectedTime || bookingSaving || slotsLoading ||
          (paymentMethod==='points' && (pointsLoading || !pointsEnabled ||
           !chosenService?.redeem_points || pointsBalance<chosenService.redeem_points))}
          onPress={confirmBooking}
          style={[styles.confirmButton, (!selectedTime || bookingSaving || slotsLoading ||
            (paymentMethod==='points' && (pointsLoading || !pointsEnabled ||
             !chosenService?.redeem_points || pointsBalance<chosenService.redeem_points))) && { opacity: 0.45 }]}>
          {bookingSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmButtonText}>{paymentMethod==='points'?'Resgatar e confirmar pedido':'Confirmar reserva'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const AdminScreen = () => adminSection === 'perfil' ? (
    <View style={{flex:1}}>
      <TouchableOpacity
        accessibilityRole="button" onPress={() => setAdminSection('agenda')}
        style={{paddingHorizontal:22,paddingVertical:15,flexDirection:'row',alignItems:'center',gap:8}}>
        <Ionicons name="arrow-back-outline" size={19} color={colors.mocha}/>
        <Text style={{color:colors.mocha,fontWeight:'700'}}>Voltar ao painel Admin</Text>
      </TouchableOpacity>
      <ProfileScreen user={user} onLogout={onLogout} onAvatarChange={setHomeAvatar}
          onNameChange={setHomeName}/>
    </View>
  ) : (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: '#F4F5F7', flexGrow: 1 }]}>
      <View style={{ marginBottom: 20, marginTop: 10 }}>
        <Text style={styles.greeting}>Painel Admin 👩‍💻</Text>
        <Text style={styles.subtitle}>Agenda, clientes, serviços e indicadores do estúdio</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 21 }}
        contentContainerStyle={[styles.adminTabs, { minWidth: 950, marginBottom: 0 }]}>
        {[
          ['agenda', 'Agenda'],
          ['manual', 'Agendar cliente'],
          ['clientes', 'Clientes'],
          ['servicos', 'Serviços'],
          ['portfolio', 'Portfólio'],
          ['financeiro', 'Financeiro'],
          ['pontos','TR Points'],
          ['perfil','Meu perfil'],
        ].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.adminTab, adminSection === id && styles.adminTabActive]}
            onPress={() => setAdminSection(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: adminSection === id }}
          >
            <Text style={[styles.adminTabText, adminSection === id && styles.adminTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {adminSection === 'agenda' && <AdminCalendar />}
      {adminSection === 'manual' && <AdminManualBooking services={services} onShowAgenda={() => setAdminSection('agenda')}/>}
      {adminSection === 'clientes' && <AdminClients />}
      {adminSection === 'portfolio' && <PortfolioScreen adminMode services={services} />}
      {adminSection === 'financeiro' && <FinancialDashboard />}
      {adminSection === 'pontos' && <AdminPointsPrices services={services} onSaved={loadServices} />}
      {adminSection === 'servicos' && (
        <View>
        <Text style={styles.sectionTitle}>Gerenciar serviços</Text>
        <TouchableOpacity style={styles.confirmButton} onPress={beginNewService}>
          <Text style={styles.confirmButtonText}>+ Novo serviço</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={loadServices} style={{ paddingVertical: 14 }}>
          <Text style={{ color: colors.mocha }}>Atualizar lista</Text>
        </TouchableOpacity>
        {servicesLoading && <ActivityIndicator color={colors.mocha} />}
        {!!serviceError && <Text style={styles.loginError}>{serviceError}</Text>}
        {services.map((service) => (
          <View key={service.id} style={[styles.simpleServiceCard, { marginBottom: 12 }]}>
            <Text style={styles.serviceTitle}>{service.name}</Text>
            <Text style={styles.serviceDetails}>
              {service.category || 'Sem categoria'} • {service.duration_minutes} min • {money(service.price)}
            </Text>
            <Text style={[styles.subtitle, { marginTop: 6 }]}>
              {service.active ? 'Ativo' : 'Desativado'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 14 }}>
              <TouchableOpacity onPress={() => beginEditService(service)}>
                <Text style={{ color: colors.mocha, fontWeight: '600' }}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleService(service)}>
                <Text style={{ color: colors.mocha, fontWeight: '600' }}>
                  {service.active ? 'Desativar' : 'Ativar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {showServiceForm && (
          <View style={[styles.simpleServiceCard, { marginTop: 12, padding: 18 }]}>
            <Text style={styles.sectionTitle}>{editingId ? 'Editar serviço' : 'Novo serviço'}</Text>
            {[
              ['name', 'Nome do serviço'],
              ['description', 'Descrição'],
              ['category', 'Categoria'],
              ['price', 'Preço (ex.: 120,00)'],
              ['duration_minutes', 'Duração em minutos (ex.: 90)'],
              ['redeem_points', 'Pontos necessários para resgatar o serviço'],
            ].map(([field, title]) => (
              <View key={field}>
                <Text style={styles.inputLabel}>{title}</Text>
                <TextInput
                  style={styles.loginInput}
                  value={serviceForm[field]}
                  onChangeText={(value) => setServiceForm((prev) => ({ ...prev, [field]: value }))}
                  keyboardType={field === 'price' ? 'decimal-pad' : ['duration_minutes','redeem_points'].includes(field) ? 'number-pad' : 'default'}
                  placeholder={title}
                />
              </View>
            ))}
            <TouchableOpacity
              onPress={() => setServiceForm((prev) => ({ ...prev, active: !prev.active }))}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: colors.ink }}>
                {serviceForm.active ? '☑ Serviço ativo' : '☐ Serviço desativado'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, savingService && { opacity: 0.6 }]}
              onPress={saveService}
              disabled={savingService}
            >
              <Text style={styles.confirmButtonText}>{savingService ? 'Salvando...' : 'Salvar serviço'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowServiceForm(false); setServiceError(''); }} style={{ padding: 14 }}>
              <Text style={{ textAlign: 'center', color: colors.mocha }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      )}
      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={18} color={colors.mocha} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContent}>
        {currentScreen === 'Home' && HomeScreen()}
        {currentScreen === 'Booking' && !isAdmin && (user
          ? (bookingView === 'new' ? BookingScreen() : (
              <ClientAppointments userId={user.id}
                refreshSignal={myAppointmentsRefresh}
                notice={bookingSuccess}
                onNewBooking={() => { setBookingSuccess(''); setBookingView('new'); }}/>
            ))
          : GuestBookingScreen())}
        {currentScreen === 'Portfolio' && <PortfolioScreen services={services} />}
        {currentScreen === 'Notifications' && user && <ClientNotifications
          items={notifications}
          unreadCount={unreadNotifications}
          loading={notificationsLoading}
          error={notificationsError}
          updating={notificationActionSaving}
          onBack={() => setCurrentScreen('Home')}
          onRefresh={loadNotifications}
          onMarkRead={(id) => markNotificationRead(id)}
          onMarkAll={() => markNotificationRead()}
          onOpenBookings={() => {
            if (isAdmin) { setAdminSection('agenda'); setCurrentScreen('Admin'); }
            else { setBookingView('hub'); setCurrentScreen('Booking'); }
          }}
        />}
        {currentScreen === 'Points' && user && !isAdmin && <TRPointsDashboard userId={user.id} onBack={() => setCurrentScreen('Home')} onRedeem={() => { setPaymentMethod('points');setBookingView('new');setBookingSuccess('');setCurrentScreen('Booking'); }}/>}
        {currentScreen === 'Profile' && user && !isAdmin && <ProfileScreen
          user={user}
          onLogout={onLogout}
          onAvatarChange={setHomeAvatar}
          onNameChange={setHomeName}
        />}
        {currentScreen === 'Admin' && isAdmin && AdminScreen()}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Home')}>
          <Ionicons name={currentScreen === 'Home' ? 'home' : 'home-outline'} size={24} color={currentScreen === 'Home' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Home' && styles.navTextActive]}>Início</Text>
        </TouchableOpacity>
        {!isAdmin && <TouchableOpacity style={styles.navItem}
          onPress={() => { setCurrentScreen('Booking'); if (user) { setBookingView('hub'); setBookingSuccess(''); } }}>
          <Ionicons name={currentScreen === 'Booking' ? 'calendar' : 'calendar-outline'} size={24} color={currentScreen === 'Booking' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Booking' && styles.navTextActive]}>{user ? 'Reservas' : 'Agendar'}</Text>
        </TouchableOpacity>}
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Portfolio')}>
          <Ionicons name={currentScreen === 'Portfolio' ? 'image' : 'image-outline'} size={24} color={currentScreen === 'Portfolio' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Portfolio' && styles.navTextActive]}>Galeria</Text>
        </TouchableOpacity>
        {!isAdmin && <TouchableOpacity style={styles.navItem} onPress={() => isAdmin ? (setAdminSection('perfil'),setCurrentScreen('Admin')) : user ? setCurrentScreen('Profile') : onRequestAuth('Profile')}>
          <Ionicons name={currentScreen === 'Profile' ? 'person' : 'person-outline'} size={24} color={currentScreen === 'Profile' ? colors.ink : colors.muted}/>
          <Text style={[styles.navText,currentScreen === 'Profile' && styles.navTextActive]}>{user ? 'Perfil' : 'Entrar'}</Text>
        </TouchableOpacity>}
        {isAdmin && (
          <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Admin')}>
            <Ionicons name={currentScreen === 'Admin' ? 'settings' : 'settings-outline'} size={24} color={currentScreen === 'Admin' ? colors.ink : colors.muted} />
            <Text style={[styles.navText, currentScreen === 'Admin' && styles.navTextActive]}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>
      <Modal visible={bookingConfirmationVisible} transparent animationType="fade"
        onRequestClose={() => setBookingConfirmationVisible(false)}>
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard} accessibilityRole="alert">
            <View style={styles.confirmationIconCircle}>
              <Ionicons name="checkmark-circle-outline" size={42} color="#247047" />
            </View>
            <Text style={styles.confirmationTitle}>Pedido de agendamento enviado!</Text>
            <Text style={styles.confirmationMessage}>
              {bookingWasRedeemed ? 'Seu resgate foi registrado e os pontos foram descontados. O atendimento aguarda a confirmação do estúdio.' : 'Seu pedido foi registrado com sucesso e está aguardando a confirmação do estúdio.'}
            </Text>
            <Text style={styles.confirmationHint}>
              Para acompanhar seus pedidos futuros e visualizar agendamentos anteriores,
              acesse a aba Reservas.
            </Text>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel="Ver minhas reservas" style={styles.confirmationPrimaryButton}
              onPress={() => {
                setBookingConfirmationVisible(false);
                setBookingView('hub');
                setCurrentScreen('Booking');
              }}>
              <Ionicons name="calendar-outline" size={20} color={colors.white} />
              <Text style={styles.confirmationPrimaryText}>Ver minhas reservas</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel="Entendi, continuar na tela inicial"
              style={styles.confirmationSecondaryButton}
              onPress={() => setBookingConfirmationVisible(false)}>
              <Text style={styles.confirmationSecondaryText}>Entendi, continuar no Início</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [authVisible, setAuthVisible] = useState(false);
  const [returnScreen, setReturnScreen] = useState('Home');
  const [returnServiceId, setReturnServiceId] = useState(null);

  useEffect(() => {
    let active = true;

    async function applySession(session) {
      if (!active) return;
      if (!session?.user) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (error) throw error;
        if (active) {
          setIsAdmin(data.role === 'admin');
          setUser(session.user);
          setErrorMessage('');
        }
      } catch (error) {
        if (active) {
          setUser(null);
          setIsAdmin(false);
          setErrorMessage('Não foi possível carregar seu perfil. Verifique o Supabase e tente novamente.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return applySession(data.session);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setErrorMessage('Não foi possível verificar sua sessão.');
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      // Consultas ao banco ocorrem fora do callback de autenticação.
      setTimeout(() => {
        if (active) applySession(session);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function requestAuth(screen = 'Home', serviceId = null) {
    setReturnScreen(screen);
    setReturnServiceId(serviceId);
    setAuthVisible(true);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
    else { setAuthVisible(false); setReturnScreen('Home'); setReturnServiceId(null); }
  }

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={colors.mocha} />
        <Text style={[styles.subtitle, { marginTop: 14 }]}>Carregando TR Beauty Concept...</Text>
      </View>
    );
  }

  if (passwordRecovery) return <AuthScreen recovery onRecoveryDone={() => setPasswordRecovery(false)} />;

  if (!user && authVisible) {
    return <AuthScreen onBack={() => setAuthVisible(false)} />;
  }

  return <MainApp key={user?.id || 'guest'}
    user={user} isAdmin={isAdmin} onLogout={handleLogout} onRequestAuth={requestAuth}
    initialScreen={returnScreen}
    initialServiceId={returnServiceId}/>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  mainContent: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 10 },
  homeGreetingHeader: { flexDirection: 'row', alignItems: 'center',
    gap: 13, marginBottom: 27, marginTop: 8, minHeight: 70 },
  greetingAvatarButton: { height: 66, width: 66, borderRadius: 33,
    backgroundColor: colors.nude, justifyContent: 'center',
    alignItems: 'center', overflow: 'hidden' },
  greetingAvatarImage: { width: 66, height: 66, borderRadius: 33 },
  greetingTextBlock: { flex: 1, minWidth: 0, justifyContent: 'center' },
  greetingDay: { color: colors.muted, fontSize: 17, fontWeight: '400', marginBottom: 2 },
  greetingFullName: { color: colors.ink, fontSize: 27, fontWeight: '700' },
  homeBellButton: { width: 62, height: 62, backgroundColor: colors.white,
    borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.11, shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  homeBellBadge: { position: 'absolute', right: 8, top: 8,
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#AD4D55',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  homeBellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  pageHeader: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: colors.ink, marginBottom: 4 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted },
  profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.nude, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  homeAvatar: { width: 44, height: 44, borderRadius: 22 },
  loyaltyCard: { backgroundColor: colors.nude, borderRadius: 20, padding: 24, marginBottom: 24 },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  loyaltyBrand: { fontSize: 12, letterSpacing: 2, fontWeight: '600', color: colors.ink },
  pointsValue: { fontSize: 48, fontWeight: '300', color: colors.ink, lineHeight: 52 },
  pointsLabel: { fontSize: 16, fontWeight: '500', color: colors.ink, marginBottom: 24 },
  pointsSubtitle: { fontSize: 12, color: '#5C5C5C' },
  guestCard: { backgroundColor: colors.nude, borderRadius: 18, padding: 21, marginBottom: 22 },
  guestCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  guestCardTitle: { color: colors.ink, fontWeight: '700', fontSize: 17, flex: 1 },
  guestCardText: { color: colors.mocha, fontSize: 13, lineHeight: 21 },
  guestCardButton: { backgroundColor: colors.white, borderRadius: 12, padding: 14, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  guestCardButtonText: { color: colors.mocha, fontWeight: '700', fontSize: 14 },
  primaryButton: { backgroundColor: colors.ink, flexDirection: 'row', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  primaryButtonText: { color: colors.background, fontSize: 16, fontWeight: '600', marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 16 },
  servicesGrid: { gap: 12 },
  simpleServiceCard: { padding: 16, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  serviceTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  serviceDetails: { fontSize: 13, color: colors.muted },
  bookingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  bookingCardSelected: { borderColor: colors.ink, backgroundColor: colors.background },
  radioSelected: { height: 20, width: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  radioDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: colors.ink },
  calendarCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 18 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  calendarArrow: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  calendarMonthTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', height: 47, justifyContent: 'center', alignItems: 'center' },
  calendarWeekday: { color: colors.mocha, fontWeight: '700', fontSize: 12 },
  calendarDay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  calendarDayEnabled: { backgroundColor: '#F2EDE8' },
  calendarDaySelected: { backgroundColor: colors.ink },
  calendarDayText: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  calendarDayDisabledText: { color: '#C7C0BA' },
  calendarDaySelectedText: { color: colors.white, fontWeight: '700' },
  calendarHint: { textAlign: 'center', color: colors.muted, fontSize: 11, marginTop: 14 },
  timeBox: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  timeBoxSelected: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.ink, borderRadius: 8 },
  optionText: { color: colors.ink },
  optionSelectedText: { color: colors.white, fontWeight: 'bold' },
  footerBooking: { padding: 24, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  confirmButton: { backgroundColor: colors.ink, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  imageCard: { width: imageSize, height: imageSize * 1.3, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.nude },
  mockImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.nude },
  adminStatCard: { flex: 1, backgroundColor: colors.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  adminStatLabel: { fontSize: 12, color: colors.muted },
  adminStatValue: { fontSize: 20, fontWeight: 'bold', color: colors.ink, marginTop: 5 },
  adminAgendaCard: { backgroundColor: colors.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  adminTabs: { flexDirection: 'row', backgroundColor: colors.nude, borderRadius: 12, padding: 4, marginBottom: 21, gap: 3 },
  adminTab: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  adminTabActive: { backgroundColor: colors.white },
  adminTabText: { fontSize: 13, fontWeight: '600', color: colors.mocha },
  adminTabTextActive: { color: colors.ink, fontWeight: '700' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  navItem: { alignItems: 'center', minWidth: 55 },
  navText: { fontSize: 10, color: colors.muted, marginTop: 4 },
  navTextActive: { color: colors.ink, fontWeight: 'bold' },
  adminAction: { color: colors.mocha, fontWeight: '700' },
  successText: { color: '#247047', fontWeight: '600' },
  confirmationBackdrop: { flex: 1, backgroundColor: 'rgba(25, 25, 25, 0.58)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  confirmationCard: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 24, paddingVertical: 29, alignItems: 'center' },
  confirmationIconCircle: { width: 76, height: 76, backgroundColor: '#EAF6EF', borderRadius: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  confirmationTitle: { color: colors.ink, fontSize: 21, fontWeight: '700', textAlign: 'center', marginBottom: 13 },
  confirmationMessage: { color: colors.ink, fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 12 },
  confirmationHint: { color: colors.mocha, fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  confirmationPrimaryButton: { backgroundColor: colors.ink, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  confirmationPrimaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  confirmationSecondaryButton: { marginTop: 10, paddingVertical: 13, paddingHorizontal: 10 },
  confirmationSecondaryText: { color: colors.mocha, fontWeight: '600', fontSize: 13 },
  logoutButton: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, paddingVertical: 14, marginTop: 26 },
  logoutText: { color: colors.mocha, fontWeight: '600' },
  loadingPage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loginPage: { flex: 1, backgroundColor: colors.background },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingVertical: 50 },
  loginLogo: { width: 64, height: 64, alignSelf: 'center', borderRadius: 32, backgroundColor: colors.nude, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  loginTitle: { fontSize: 29, fontWeight: '700', textAlign: 'center', color: colors.ink, marginBottom: 8 },
  loginSubtitle: { fontSize: 14, textAlign: 'center', color: colors.muted, marginBottom: 35 },
  inputLabel: { color: colors.ink, fontWeight: '600', marginBottom: 7 },
  loginInput: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, padding: 16, borderRadius: 12, marginBottom: 18, fontSize: 16 },
  loginError: { color: '#B42318', marginBottom: 16 },
  loginButton: { backgroundColor: colors.ink, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  loginButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  loginFootnote: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 22 },
});
