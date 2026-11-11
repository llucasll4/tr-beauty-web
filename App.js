import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
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
import CompletePhoneScreen from './CompletePhoneScreen';
import { normalizeBrazilMobile } from './phoneUtils';
import ProfileScreen from './ProfileScreen';
import AdminCalendar from './AdminCalendar';
import AdminCalendarBlocks from './AdminCalendarBlocks';
import AdminManualBooking from './AdminManualBooking';
import AdminClients from './AdminClients';
import LoyaltyCard from './LoyaltyCard';
import NextSelfCareCard from './NextSelfCareCard';
import TRPointsDashboard from './TRPointsDashboard';
import AdminPointsPrices from './AdminPointsPrices';
import PortfolioScreen from './PortfolioScreen';
import FinancialDashboard from './FinancialDashboard';
import ClientAppointments from './ClientAppointments';
import ClientNotifications from './ClientNotifications';
import AdminNotifications from './AdminNotifications';
import NailBook from './NailBook';
import AdminWhatsApp from './AdminWhatsApp';
import BookingWizard from './BookingWizard';

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
// Tons quentes da referência — somente Home e navegação, sem mudar o tema global.
const homeColors = { background: '#FAF9F5', brown: '#402816', bronze: '#9B6840' };

// Emojis relacionados a unhas para os cards, sem associar gel a gotas d'água.
const emojiForHomeService = (name = '') => {
  const label = String(name).toLocaleLowerCase('pt-BR');
  if (label.includes('nail art') || label.includes('decora') || label.includes('arte')) return '🎨';
  if (label.includes('manuten') || label.includes('alongamento') || label.includes('gel') ||
      label.includes('esmalta') || label.includes('unha') || label.includes('banho')) return '💅';
  return '✨';
};
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
function buildCalendar(monthKey, allowedDateKeys, openWeekdays = null) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstColumn = (firstWeekday + 6) % 7; // Segunda-feira primeiro
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: firstColumn }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    cells.push({ key, day, enabled: allowedDateKeys.has(key) && (!openWeekdays || openWeekdays.has(weekday)) });
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
  const [pointsInitialTab, setPointsInitialTab] = useState('ledger');
  const [pointsReturnScreen, setPointsReturnScreen] = useState('Home');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(!!user);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationActionSaving, setNotificationActionSaving] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [adminNotificationLoading, setAdminNotificationLoading] = useState(!!isAdmin);
  const [adminNotificationError, setAdminNotificationError] = useState('');
  const [adminNotificationBusy, setAdminNotificationBusy] = useState(null);
  const displayName = (
    homeName.trim() ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user ? 'Cliente' : 'Visitante')
  ).trim().split(/\s+/)[0];
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const cutoff = new Date().toISOString();
    try {
      const fields = 'id,appointment_id,type,title,body,created_at,visible_at,read_at';
      const [newItems, oldItems, number] = await Promise.all([
        supabase.from('notifications')
          .select(fields)
          .eq('profile_id', user.id).is('read_at', null)
          .lte('visible_at', cutoff)
          .order('visible_at', { ascending: false })
          .limit(150),
        supabase.from('notifications')
          .select(fields)
          .eq('profile_id', user.id).not('read_at', 'is', null)
          .lte('visible_at', cutoff)
          .order('visible_at', { ascending: false })
          .limit(60),
        supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id).is('read_at', null)
          .lte('visible_at', cutoff),
      ]);
      if (newItems.error) throw newItems.error;
      if (oldItems.error) throw oldItems.error;
      if (number.error) throw number.error;
      setNotifications([...(newItems.data || []), ...(oldItems.data || [])]);
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

  const loadAdminNotifications = useCallback(async () => {
    if (!isAdmin || !user?.id) return;
    try {
      const fields = 'id,recipient_id,appointment_id,type,priority,title,body,read_at,resolved_at,created_at,appointments(id,starts_at,status,price_at_booking,points_redeemed,notes,services(name,duration_minutes),profiles(full_name,phone))';
      const [newItems, oldItems, count] = await Promise.all([
        supabase.from('admin_notifications')
          .select(fields)
          .eq('recipient_id',user.id).is('read_at',null)
          .order('created_at',{ascending:false}).limit(150),
        supabase.from('admin_notifications')
          .select(fields)
          .eq('recipient_id',user.id).not('read_at','is',null)
          .order('created_at',{ascending:false}).limit(60),
        supabase.from('admin_notifications')
          .select('id',{count:'exact',head:true})
          .eq('recipient_id',user.id).is('read_at',null),
      ]);
      if(newItems.error)throw newItems.error;
      if(oldItems.error)throw oldItems.error;
      if(count.error)throw count.error;
      setAdminNotifications([...(newItems.data||[]),...(oldItems.data||[])]);
      setUnreadAdminCount(count.count||0);
      setAdminNotificationError('');
    }catch(e){
      setAdminNotificationError('Não foi possível consultar os alertas: '+(e?.message||'erro desconhecido'));
    }finally{setAdminNotificationLoading(false);}
  },[user?.id,isAdmin]);

  useEffect(()=>{
    if(!isAdmin||!user?.id){
      setAdminNotifications([]);setUnreadAdminCount(0);
      setAdminNotificationLoading(false);
      return;
    }
    loadAdminNotifications();
    const channel=supabase.channel('admin-operational-alerts-'+user.id)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'admin_notifications',
        filter:'recipient_id=eq.'+user.id,
      },()=>loadAdminNotifications()).subscribe();
    const poll=setInterval(loadAdminNotifications,30000);
    return ()=>{
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  },[isAdmin,user?.id,loadAdminNotifications]);

  useEffect(()=>{
    if(isAdmin&&user?.id&&(currentScreen==='Notifications'||currentScreen==='Home'||currentScreen==='Admin'))
      loadAdminNotifications();
  },[currentScreen,isAdmin,user?.id,loadAdminNotifications]);

  async function markAdminNotificationRead(id=null){
    if(!isAdmin||!user?.id)return;
    try{
      let query=supabase.from('admin_notifications')
        .update({read_at:new Date().toISOString()})
        .eq('recipient_id',user.id).is('read_at',null);
      if(id)query=query.eq('id',id);
      const {error}=await query;
      if(error)throw error;
      await loadAdminNotifications();
    }catch(e){
      setAdminNotificationError('Não foi possível marcar como lido: '+(e?.message||'erro desconhecido'));
    }
  }

  async function decideAdminNotification(item,nextStatus){
    if(!isAdmin||!user?.id||adminNotificationBusy)throw new Error('Ação indisponível.');
    if(item.type!=='booking_requested'||!item.appointment_id||
      !['confirmed','cancelled'].includes(nextStatus))
      throw new Error('Esta notificação não permite essa ação.');
    setAdminNotificationBusy(item.id);
    try{
      const {data,error}=await supabase.from('appointments')
        .update({status:nextStatus})
        .eq('id',item.appointment_id)
        .eq('status','pending')
        .select('id,status')
        .maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('Este pedido já foi respondido ou alterado por outra pessoa. Atualize os alertas.');
      await markAdminNotificationRead(item.id);
      await loadAppointments();
    }finally{
      setAdminNotificationBusy(null);
      await loadAdminNotifications();
    }
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
  const [bookingStartStep,setBookingStartStep] = useState(initialServiceId && initialScreen === 'Booking' ? 2 : 1);
  const [adminSection, setAdminSection] = useState('agenda');
  const [showAdminBookingModal, setShowAdminBookingModal] = useState(false);
  const [adminCalendarRefresh, setAdminCalendarRefresh] = useState(0);
  const [adminQuickOpen, setAdminQuickOpen] = useState(false);
  const [adminTodayStats, setAdminTodayStats] = useState(null);
  const [adminStatsError, setAdminStatsError] = useState('');
  const [adminStatsLoading, setAdminStatsLoading] = useState(false);

  const loadAdminTodayStats = useCallback(async () => {
    if (!isAdmin || !user?.id) return;
    setAdminStatsLoading(true);
    try {
      const today = localDateKey(new Date());
      const start = new Date(today + 'T00:00:00-03:00');
      const end = new Date(start.getTime() + 86400000);
      const { data, error: queryError } = await supabase.from('appointments')
        .select('status,price_at_booking')
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
        .limit(1000);
      if (queryError) throw queryError;
      if ((data || []).length === 1000) throw new Error('Volume muito alto; atualize o painel.');
      const active = (data || []).filter(a =>
        ['pending','confirmed','completed'].includes(a.status));
      setAdminTodayStats({
        visits: active.length,
        revenue: active.filter(a => a.status === 'completed')
          .reduce((total,a) => total + Number(a.price_at_booking || 0), 0),
        cancelled: (data || []).filter(a => a.status === 'cancelled').length,
      });
      setAdminStatsError('');
    } catch (e) {
      setAdminStatsError('Indicadores indisponíveis. Toque em atualizar.');
    } finally {setAdminStatsLoading(false);}
  }, [isAdmin, user?.id]);

  useEffect(() => {
    if (!isAdmin || currentScreen !== 'Admin') return;
    loadAdminTodayStats();
    const id = setInterval(loadAdminTodayStats, 60000);
    return () => clearInterval(id);
  }, [isAdmin, currentScreen, adminSection, loadAdminTodayStats]);

  function goToAdminSection(section) {
    setAdminQuickOpen(false);
    setAdminSection(section);
    setCurrentScreen('Admin');
  }

  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedDate, setSelectedDate] = useState(initialBookableDate);
  const [calendarMonth, setCalendarMonth] = useState(() => initialBookableDate().slice(0, 7));
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [openWeekdays, setOpenWeekdays] = useState(null);
  useEffect(() => {
    let active = true;
    if (!user?.id) { setOpenWeekdays(null); return () => { active = false; }; }
    // O calendário reflete os dias habilitados no Supabase (não um conjunto fixo).
    supabase.from('business_hours').select('weekday').eq('enabled', true)
      .then(({data,error}) => {
        if(!active) return;
        // Em caso de falha, a RPC ainda valida o expediente ao escolher o dia.
        if(!error) setOpenWeekdays(new Set((data || []).map(row => Number(row.weekday))));
      });
    return () => { active = false; };
  }, [user?.id]);
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [homeInspirations, setHomeInspirations] = useState([]);
  const [homeInspirationsLoading, setHomeInspirationsLoading] = useState(false);
  const [homeInspirationsError, setHomeInspirationsError] = useState('');

  // Utiliza o mesmo portfólio público da galeria, sem fotos de exemplo nem dados fictícios.
  useEffect(() => {
    if (currentScreen !== 'Home' || isAdmin) return;
    let active = true;
    setHomeInspirationsLoading(true);
    setHomeInspirationsError('');
    supabase.from('portfolio_photos')
      .select('id,title,image_path')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setHomeInspirations((data || []).filter(photo => !!photo.image_path));
      })
      .catch(error => {
        if (active) setHomeInspirationsError('Não foi possível carregar as inspirações.');
      })
      .finally(() => { if (active) setHomeInspirationsLoading(false); });
    return () => { active = false; };
  }, [currentScreen, isAdmin]);
  const [savingService, setSavingService] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', price: '',
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
    setServiceForm({ name: '', description: '', price: '', duration_minutes: '', redeem_points: String(300+100*services.length), active: true });
    setShowServiceForm(true);
    setServiceError('');
  }

  function beginEditService(service) {
    setEditingId(service.id);
    setServiceForm({
      name: service.name || '', description: service.description || '',
      price: String(service.price),
      duration_minutes: String(service.duration_minutes), redeem_points: String(service.redeem_points || 300), active: service.active,
    });
    setShowServiceForm(true);
    setServiceError('');
  }

  function closeServiceForm() {
    if (savingService) return;
    setShowServiceForm(false);
    setEditingId(null);
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
      // Categoria é opcional no Supabase e não é solicitada no formulário.
      // Para serviços já existentes, não alterar a categoria previamente salva.
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
  const calendarCells = buildCalendar(calendarMonth, allowedDateKeys, openWeekdays);
  useEffect(() => {
    if (!openWeekdays || !openWeekdays.size) return;
    const chosenWeekday = new Date(selectedDate + 'T12:00:00Z').getUTCDay();
    if (!openWeekdays.has(chosenWeekday)) {
      const nextDay = futureDates().find(({key}) =>
        openWeekdays.has(new Date(key + 'T12:00:00Z').getUTCDay()));
      if (nextDay) {
        setSelectedDate(nextDay.key);
        setCalendarMonth(nextDay.key.slice(0, 7));
      }
    }
  }, [openWeekdays, selectedDate]);
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
  }, [user?.id, selectedServiceId, selectedDate, bookingSuccess, myAppointmentsRefresh]);

  async function confirmBooking() {
    if (!user) { onRequestAuth('Booking', selectedServiceId); return false; }
    if (!selectedServiceId || !selectedTime || bookingSaving) return false;
    if (paymentMethod==='points' &&
        (!pointsEnabled || pointsLoading || !Number.isInteger(chosenService?.redeem_points) ||
         pointsBalance < chosenService.redeem_points)) {
      setBookingError('O resgate não está disponível ou seu saldo de pontos é insuficiente.');
      return false;
    }
    setBookingSaving(true);
    setBookingError('');
    setBookingSuccess('');
    try {
      const withPoints=paymentMethod==='points';
      const { data, error } = await supabase.rpc(
        withPoints ? 'book_appointment_with_points' : 'book_appointment', {
          p_service_id: selectedServiceId, p_starts_at: selectedTime,
        });
      if (error) throw error;
      if (!data) throw new Error('O servidor não retornou a identificação da reserva. Consulte seus agendamentos antes de tentar novamente.');
      // Pedido recebido: não confundir envio com confirmação do estúdio.
      setBookingSuccess('');
      setSelectedTime(null);
      setPaymentMethod('cash');
      setMyAppointmentsRefresh(value => value + 1);
      if (isAdmin) await loadAppointments();
      return true;
    } catch (err) {
      setBookingError('Não foi possível reservar: ' + err.message);
      // Outro atendimento pode ter preenchido a lacuna desde a seleção.
      // Reconsulta a disponibilidade sem apagar a mensagem mostrada à cliente.
      if (err.code === '23P01' ||
          /horário (indisponível|acabou de ser reservado)/i.test(err.message || '')) {
        setSelectedTime(null);
        supabase.rpc('available_slots', { p_service_id: selectedServiceId, p_date: selectedDate })
          .then(({data,error}) => { if (!error) setSlots(data || []); });
      }
      if (paymentMethod==='points') reloadPoints();
      setBookingSuccess('');
      return false;
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
    <ScrollView style={styles.homeScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
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
          <Text style={styles.greetingFullName} numberOfLines={1}
            adjustsFontSizeToFit>Olá, {displayName}!</Text>
        </View>
        <TouchableOpacity style={styles.homeBellButton} accessibilityRole="button"
          accessibilityLabel={user ? 'Abrir notificações' :
            'Entre na sua conta para ver notificações'}
          onPress={() => user ? setCurrentScreen('Notifications') : onRequestAuth('Home')}>
          <Ionicons name="notifications-outline" size={29} color={homeColors.brown}/>
          {user && (isAdmin ? unreadAdminCount : unreadNotifications) > 0 && (
            <View style={styles.homeBellBadge}>
              <Text style={styles.homeBellBadgeText}>
                {(isAdmin ? unreadAdminCount : unreadNotifications) > 9 ? '9+' :
                  String(isAdmin ? unreadAdminCount : unreadNotifications)}
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
      ) : user ? <View>
        <NextSelfCareCard
          userId={user.id}
          refreshSignal={myAppointmentsRefresh}
          onOpenAppointments={() => {
            setBookingView('hub');
            setBookingSuccess('');
            setCurrentScreen('Booking');
          }}
        />
        <LoyaltyCard userId={user.id} refreshSignal={myAppointmentsRefresh}
          onOpenDetails={() => {
          setPointsInitialTab('ledger');
          setPointsReturnScreen('Home');
          setCurrentScreen('Points');
        }} />
      </View> : (
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

      {isAdmin && <TouchableOpacity style={styles.primaryButton}
        onPress={() => { setCurrentScreen('Admin'); setShowAdminBookingModal(true); }}>
        <Text style={styles.primaryButtonText}>Agendar cliente</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.background} />
      </TouchableOpacity>}

      <View style={styles.homeSectionHeading}>
        <View style={styles.homeSectionLabel}>
          <Text style={styles.homeSectionTitle}>Serviços</Text>
          <View style={styles.homeSectionAccent}/>
        </View>
        {!isAdmin && activeServices.length > 4 && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver todos os serviços"
            style={styles.homeSectionLink}
            onPress={() => { setBookingStartStep(1); setCurrentScreen('Booking'); if (user) { setBookingSuccess(''); setBookingView('new'); } }}>
            <Text style={styles.homeSectionLinkText}>Ver todos</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mocha}/>
          </TouchableOpacity>
        )}
      </View>
      {servicesLoading && <ActivityIndicator color={colors.mocha} />}
      {!!serviceError && !isAdmin && <Text style={styles.loginError}>{serviceError}</Text>}
      {!servicesLoading && activeServices.length === 0 && (
        <Text style={styles.subtitle}>Nenhum serviço disponível por enquanto.</Text>
      )}
      <View style={styles.homeServicesGrid}>
        {activeServices.slice(0, 4).map(service => (
          <TouchableOpacity key={service.id} style={styles.homeServiceCard}
            disabled={isAdmin} accessibilityRole="button"
            accessibilityLabel={service.name + ', ' + money(service.price) + ', ' + service.duration_minutes + ' minutos'}
            onPress={() => {
              setSelectedServiceId(service.id);
              setSelectedTime(null);
              setPaymentMethod('cash');
              setBookingStartStep(2);
              setBookingSuccess('');
              if (user) setBookingView('new');
              setCurrentScreen('Booking');
            }}>
            <Text style={styles.homeServiceEmoji} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {emojiForHomeService(service.name)}
            </Text>
            <Text style={styles.homeServiceName} numberOfLines={2}>{service.name}</Text>
            <Text style={styles.homeServiceMeta}>
              {money(service.price)} · {service.duration_minutes} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isAdmin && (
        <View style={styles.homeInspirationsSection}>
          <View style={styles.homeSectionHeading}>
            <View style={styles.homeSectionLabel}>
              <Text style={styles.homeSectionTitle}>Inspirações</Text>
              <View style={styles.homeSectionAccent}/>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver todas as inspirações"
              style={styles.homeSectionLink} onPress={() => setCurrentScreen('Portfolio')}>
              <Text style={styles.homeSectionLinkText}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mocha}/>
            </TouchableOpacity>
          </View>
          {homeInspirationsLoading && <ActivityIndicator color={colors.mocha}/>}
          {!!homeInspirationsError && (
            <Text style={styles.homeGalleryMessage}>{homeInspirationsError}</Text>
          )}
          {!homeInspirationsLoading && !homeInspirationsError && homeInspirations.length === 0 && (
            <Text style={styles.homeGalleryMessage}>Novas inspirações chegarão em breve.</Text>
          )}
          {homeInspirations.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.homeInspirationCarousel}
              accessibilityLabel="Carrossel de inspirações do estúdio">
              {homeInspirations.map(photo => (
                <TouchableOpacity key={photo.id} style={styles.homeInspirationCard}
                  accessibilityRole="button" accessibilityLabel={'Abrir galeria: ' + photo.title}
                  onPress={() => setCurrentScreen('Portfolio')}>
                  <Image style={styles.homeInspirationImage} resizeMode="cover"
                    source={{ uri: supabase.storage.from('portfolio').getPublicUrl(photo.image_path).data.publicUrl }}/>
                  <Text numberOfLines={1} style={styles.homeInspirationName}>{photo.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {!isAdmin && <TouchableOpacity style={styles.primaryButton}
        accessibilityRole="button"
        onPress={() => { setBookingStartStep(1); setCurrentScreen('Booking'); if (user) { setBookingSuccess(''); setBookingView('new'); } }}>
        <Text style={styles.primaryButtonText}>Agendar Meu Horário</Text>
        <Ionicons name="calendar-outline" size={20} color={colors.background}/>
      </TouchableOpacity>}

      {user && !isAdmin && (
        <TouchableOpacity accessibilityRole="button" onPress={() => setCurrentScreen('NailBook')}
          style={[styles.guestCardButton, styles.homeNailBookButton]}>
          <Ionicons name="images-outline" size={20} color={colors.mocha}/>
          <Text style={styles.guestCardButtonText}>Meu Nail Book 💅</Text>
          <Ionicons name="arrow-forward-outline" size={16} color={colors.mocha}/>
        </TouchableOpacity>
      )}
      {user && <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={18} color={colors.mocha} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>}

      <View style={styles.studioInfoCard}>
        <View style={styles.studioInfoHeader}>
          <View style={styles.studioInfoLogo}>
            <Ionicons name="sparkles-outline" color={colors.mocha} size={22}/>
          </View>
          <View style={{flex:1}}>
            <Text style={styles.studioInfoHeading}>TR Beauty Concept</Text>
            <Text style={styles.studioInfoTagline}>Informações do estúdio</Text>
          </View>
        </View>

        <TouchableOpacity accessibilityRole="link"
          accessibilityLabel="Conversar com o Studio pelo WhatsApp: (11) 94690-1167"
          onPress={() => Linking.openURL('https://wa.me/5511946901167')}
          style={styles.studioInfoRow}>
          <View style={styles.studioInfoRowIcon}>
            <Ionicons name="logo-whatsapp" size={20} color={colors.mocha}/>
          </View>
          <View style={styles.studioInfoRowText}>
            <Text style={styles.studioInfoLabel}>WhatsApp do Studio</Text>
            <Text style={styles.studioInfoValue}>(11) 94690-1167</Text>
          </View>
          <Ionicons name="arrow-up-forward-outline" size={17} color={colors.mocha}/>
        </TouchableOpacity>

        <View style={styles.studioInfoDivider}/>
        <TouchableOpacity accessibilityRole="link"
          accessibilityLabel="Visitar o Instagram da Talita Nail Design"
          onPress={() => Linking.openURL('https://www.instagram.com/__thalitanaildesign?cplk=c3A4emlocGRxOXEx')}
          style={styles.studioInfoRow}>
          <View style={styles.studioInfoRowIcon}>
            <Ionicons name="logo-instagram" size={20} color={colors.mocha}/>
          </View>
          <View style={styles.studioInfoRowText}>
            <Text style={styles.studioInfoLabel}>Instagram</Text>
            <Text style={styles.studioInfoValue}>@__thalitanaildesign</Text>
          </View>
          <Ionicons name="arrow-up-forward-outline" size={17} color={colors.mocha}/>
        </TouchableOpacity>

        <View style={styles.studioInfoDivider}/>
        <TouchableOpacity accessibilityRole="link"
          accessibilityLabel="Ver localização do estúdio no mapa"
          onPress={() => Linking.openURL(
            'https://www.google.com/maps/search/?api=1&query=' +
            encodeURIComponent('Rua Santa Cruz, 537, Diadema, SP')
          )}
          style={styles.studioInfoRow}>
          <View style={styles.studioInfoRowIcon}>
            <Ionicons name="location-outline" size={20} color={colors.mocha}/>
          </View>
          <View style={styles.studioInfoRowText}>
            <Text style={styles.studioInfoLabel}>Endereço</Text>
            <Text style={styles.studioInfoValue}>Rua Santa Cruz, 537</Text>
            <Text style={styles.studioInfoAddress}>Diadema – SP</Text>
          </View>
          <Ionicons name="arrow-up-forward-outline" size={17} color={colors.mocha}/>
        </TouchableOpacity>
      </View>
      <Text style={styles.studioInfoFooter}>Estúdio especializado em unhas 💅</Text>
    </ScrollView>
  );

  const AdminScreen = () => adminSection === 'nailbook' ? (
    <NailBook adminMode onBack={() => setAdminSection('clientes')}/>
  ) : adminSection === 'perfil' ? (
    <View style={{flex:1}}>
      <TouchableOpacity
        accessibilityRole="button" onPress={() => setAdminSection('agenda')}
        style={{paddingHorizontal:22,paddingVertical:15,flexDirection:'row',alignItems:'center',gap:8}}>
        <Ionicons name="arrow-back-outline" size={19} color={colors.mocha}/>
        <Text style={{color:colors.mocha,fontWeight:'700'}}>Voltar ao painel Admin</Text>
      </TouchableOpacity>
      <ProfileScreen user={user} onLogout={onLogout} onAvatarChange={setHomeAvatar}
          onNameChange={setHomeName} showPoints={false}/>
    </View>
  ) : (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: '#F4F5F7', flexGrow: 1 }]}>
      <View style={styles.adminHeader}>
        <View style={{flex:1,minWidth:0}}>
          <Text style={styles.adminTitle}>Painel Admin 👩‍💻</Text>
          <Text style={styles.adminSubtitle}>Agenda, clientes, serviços e indicadores do estúdio</Text>
        </View>
        <View style={styles.adminHeaderActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={
              'Notificações da administração' +
              (unreadAdminCount ? ': '+unreadAdminCount+' não lidas' : '')
            } onPress={() => {setAdminQuickOpen(false);setCurrentScreen('Notifications');}}
            style={styles.adminHeaderIcon}>
            <Ionicons name="notifications-outline" color={homeColors.brown} size={26}/>
            {unreadAdminCount > 0 && <View style={styles.adminUnreadDot}/>}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel="Configurações da administração"
            onPress={() => goToAdminSection('configuracoes')}
            style={styles.adminHeaderIcon}>
            <Ionicons name={adminSection==='configuracoes'?'settings':'settings-outline'}
              color={homeColors.brown} size={27}/>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.adminKpiHeader}>
        <Text style={styles.adminKpiHeading}>Indicadores Rápidos (Hoje)</Text>
        <TouchableOpacity onPress={loadAdminTodayStats} disabled={adminStatsLoading}
          accessibilityRole="button" accessibilityLabel="Atualizar indicadores">
          <Ionicons name="refresh-outline" color={colors.mocha} size={19}/>
        </TouchableOpacity>
      </View>
      <View style={styles.adminKpiRow}>
        {[
          ['Atendimentos',adminTodayStats?.visits,'#EBE0D6'],
          ['Faturamento',adminTodayStats
            ? Number(adminTodayStats.revenue || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
            : null,'#F0E8D8'],
          ['Cancelados',adminTodayStats?.cancelled,'#EBE0D6'],
        ].map(([label,value,tint])=>
          <View key={label} style={[styles.adminKpiCard,{backgroundColor:tint}]}>
            <Text style={styles.adminKpiLabel}>{label}</Text>
            {adminStatsLoading&&!adminTodayStats
              ? <ActivityIndicator color={colors.mocha} size="small"/> :
              <Text style={styles.adminKpiValue} numberOfLines={1} adjustsFontSizeToFit>
                {value === null || value === undefined ? '—' : value}
              </Text>}
          </View>)}
      </View>
      {!!adminStatsError&&<Text style={styles.adminKpiError}>{adminStatsError}</Text>}
      <View style={[styles.adminTabs,{marginBottom:21}]}>
        {[
          ['agenda','Agenda'],
          ['clientes','Clientes'],
          ['financeiro','Métricas'],
        ].map(([id,label])=>
          <TouchableOpacity key={id} accessibilityRole="button"
            accessibilityState={{selected:adminSection===id}}
            style={[styles.adminTab,adminSection===id&&styles.adminTabActive]}
            onPress={() => goToAdminSection(id)}>
            <Text style={[styles.adminTabText,adminSection===id&&styles.adminTabTextActive]}>{label}</Text>
          </TouchableOpacity>)}
      </View>
      {adminSection === 'configuracoes' && <View style={styles.adminSettingsCard}>
        <Text style={styles.adminSettingsTitle}>Configurações do estúdio</Text>
        <Text style={styles.adminSettingsSubtitle}>Gerencie os recursos e as preferências administrativas</Text>
        {[
          ['perfil','person-outline','Meu perfil','Dados e conta do estúdio'],
          ['servicos','color-palette-outline','Serviços','Cadastrar, editar e desativar serviços'],
          ['bloqueios','lock-closed-outline','Bloqueios da agenda','Folgas, dias e horários indisponíveis'],
          ['pontos','diamond-outline','TR Points','Valores e regras de pontuação'],
          ['whatsapp','logo-whatsapp','WhatsApp','Integração e comunicação'],
          ['portfolio','images-outline','Portfólio','Fotos e inspirações'],
          ['nailbook','book-outline','Nail Book','Histórico e inspirações'],
        ].map(([id,icon,label,description]) =>
          <TouchableOpacity key={id} accessibilityRole="button"
            accessibilityLabel={label} onPress={() => goToAdminSection(id)}
            style={styles.adminSettingsRow}>
            <View style={styles.adminSettingsIcon}>
              <Ionicons name={icon} size={22} color={colors.mocha}/>
            </View>
            <View style={{flex:1,minWidth:0}}>
              <Text style={styles.adminSettingsRowTitle}>{label}</Text>
              <Text style={styles.adminSettingsRowCaption}>{description}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={19} color={colors.mocha}/>
          </TouchableOpacity>)}
      </View>}
{adminSection === 'agenda' && <AdminCalendar key={adminCalendarRefresh} />}
      {adminSection === 'bloqueios' && <AdminCalendarBlocks onBack={() => goToAdminSection('agenda')}/>}
      {adminSection === 'clientes' && <AdminClients />}
      {adminSection === 'portfolio' && <PortfolioScreen adminMode services={services} />}
      {adminSection === 'financeiro' && <FinancialDashboard />}
      {adminSection === 'pontos' && <AdminPointsPrices services={services} onSaved={loadServices} />}
      {adminSection === 'whatsapp' && <AdminWhatsApp/>}
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
        {!!serviceError && !showServiceForm && <Text style={styles.loginError}>{serviceError}</Text>}
        {services.map((service) => (
          <View key={service.id} style={[styles.simpleServiceCard, { marginBottom: 12 }]}>
            <Text style={styles.serviceTitle}>{service.name}</Text>
            <Text style={styles.serviceDetails}>
              {service.duration_minutes} min • {money(service.price)}
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
        <Modal visible={showServiceForm} transparent animationType="fade"
          onRequestClose={closeServiceForm}>
          <View style={styles.serviceModalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject}
              accessibilityRole="button" accessibilityLabel="Fechar formulário de serviço"
              activeOpacity={1} onPress={closeServiceForm} disabled={savingService}/>
            <View style={styles.serviceModalCard} accessibilityViewIsModal>
              <View style={styles.serviceModalHeader}>
                <View style={styles.serviceModalHeading}>
                  <View style={styles.serviceModalIcon}>
                    <Ionicons name={editingId ? 'create-outline' : 'add-outline'}
                      size={23} color={colors.mocha}/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={styles.serviceModalTitle}>
                      {editingId ? 'Editar serviço' : 'Novo serviço'}
                    </Text>
                    <Text style={styles.serviceModalSubtitle}>
                      {editingId ? 'Atualize os dados do atendimento' : 'Preencha os dados do novo atendimento'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={closeServiceForm} disabled={savingService}
                  accessibilityRole="button" accessibilityLabel="Fechar"
                  style={styles.serviceModalClose}>
                  <Ionicons name="close" color={colors.mocha} size={22}/>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.serviceModalScroll}
                contentContainerStyle={styles.serviceModalFields}
                keyboardShouldPersistTaps="handled">
                {[
                  ['name', 'Nome do serviço *', 'Ex.: Banho de gel'],
                  ['description', 'Descrição', 'Descreva o procedimento (opcional)'],
                  ['price', 'Preço (R$) *', 'Ex.: 120,00'],
                  ['duration_minutes', 'Duração (minutos) *', 'Ex.: 90'],
                  ['redeem_points', 'Pontos para resgate *', 'Ex.: 300'],
                ].map(([field, label, hint]) => (
                  <View key={field} style={styles.serviceModalField}>
                    <Text style={styles.serviceModalFieldLabel}>{label}</Text>
                    <TextInput
                      style={[styles.serviceModalInput, field === 'description' && styles.serviceModalTextarea]}
                      value={serviceForm[field]}
                      onChangeText={(value) => setServiceForm(prev => ({...prev, [field]: value}))}
                      keyboardType={field === 'price' ? 'decimal-pad' :
                        ['duration_minutes', 'redeem_points'].includes(field) ? 'number-pad' : 'default'}
                      placeholder={hint} placeholderTextColor={colors.muted}
                      accessibilityLabel={label}
                      multiline={field === 'description'}
                      textAlignVertical={field === 'description' ? 'top' : 'center'}
                    />
                  </View>
                ))}

                <TouchableOpacity onPress={() => setServiceForm(prev => ({...prev, active: !prev.active}))}
                  style={styles.serviceModalActive} accessibilityRole="checkbox"
                  accessibilityState={{checked:serviceForm.active}}>
                  <Ionicons name={serviceForm.active ? 'checkbox' : 'square-outline'}
                    size={24} color={colors.mocha}/>
                  <View style={{flex:1}}>
                    <Text style={styles.serviceModalActiveTitle}>Serviço ativo</Text>
                    <Text style={styles.serviceModalActiveHint}>
                      {serviceForm.active ? 'Visível para agendamento das clientes' : 'Oculto dos novos agendamentos'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {!!serviceError && <View style={styles.serviceModalErrorBox}>
                  <Ionicons name="alert-circle-outline" color="#B42318" size={18}/>
                  <Text style={styles.serviceModalErrorText}>{serviceError}</Text>
                </View>}
              </ScrollView>

              <View style={styles.serviceModalActions}>
                <TouchableOpacity onPress={closeServiceForm} disabled={savingService}
                  style={styles.serviceModalCancel} accessibilityRole="button">
                  <Text style={styles.serviceModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveService} disabled={savingService}
                  accessibilityRole="button"
                  style={[styles.serviceModalSave, savingService && {opacity:0.65}]}>
                  {savingService ? <ActivityIndicator color={colors.white}/> :
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.white}/>}
                  <Text style={styles.serviceModalSaveText}>
                    {savingService ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
        {currentScreen === 'Booking' && !isAdmin && (user && bookingView !== 'new' ? (
          <ClientAppointments userId={user.id}
            refreshSignal={myAppointmentsRefresh}
            notice={bookingSuccess}
            onNewBooking={() => { setBookingSuccess('');setBookingStartStep(1);setPaymentMethod('cash');setBookingView('new'); }}/>
        ) : (
          <BookingWizard
            user={user}
            services={services}
            servicesLoading={servicesLoading}
            serviceError={serviceError}
            selectedServiceId={selectedServiceId}
            setSelectedServiceId={setSelectedServiceId}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            slots={slots}
            slotsLoading={slotsLoading}
            error={bookingError}
            onClearError={() => setBookingError('')}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            pointsBalance={pointsBalance}
            pointsEnabled={pointsEnabled}
            pointsLoading={pointsLoading}
            pointsError={pointsError}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            calendarCells={calendarCells}
            firstCalendarMonth={firstCalendarMonth}
            lastCalendarMonth={lastCalendarMonth}
            saving={bookingSaving}
            initialStep={bookingStartStep}
            onConfirm={confirmBooking}
            onExit={() => user ? setBookingView('hub') : setCurrentScreen('Home')}
            onHome={() => {setBookingView('hub');setCurrentScreen('Home');}}
            onReservations={() => {setBookingView('hub');setCurrentScreen('Booking');}}
            onRequireAuth={serviceId => onRequestAuth('Booking',serviceId)}
          />
        ))}
        {currentScreen === 'Portfolio' && <PortfolioScreen services={services} />}
        {currentScreen === 'Notifications' && user && isAdmin && <AdminNotifications
          items={adminNotifications}
          unreadCount={unreadAdminCount}
          loading={adminNotificationLoading}
          error={adminNotificationError}
          busyId={adminNotificationBusy}
          onBack={() => setCurrentScreen('Admin')}
          onRefresh={loadAdminNotifications}
          onMarkRead={markAdminNotificationRead}
          onMarkAll={() => markAdminNotificationRead()}
          onDecide={decideAdminNotification}
        />}
        {currentScreen === 'Notifications' && user && !isAdmin && <ClientNotifications
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
        {currentScreen === 'Points' && user && !isAdmin && <TRPointsDashboard
          userId={user.id} initialTab={pointsInitialTab}
          onBack={() => setCurrentScreen(pointsReturnScreen)}
          onRedeem={() => { setBookingStartStep(1);setPaymentMethod('points');setBookingView('new');setBookingSuccess('');setCurrentScreen('Booking'); }}/>}
        {currentScreen === 'NailBook' && user && !isAdmin && <NailBook
          clientId={user.id}
          onBack={() => setCurrentScreen('Home')}
          onRepeat={serviceId => {
            setSelectedServiceId(serviceId);
            setPaymentMethod('cash');
            setBookingStartStep(2);
            setBookingView('new');
            setCurrentScreen('Booking');
          }}
        />}
        {currentScreen === 'Profile' && user && !isAdmin && <ProfileScreen
          user={user}
          requirePhone
          onLogout={onLogout}
          onAvatarChange={setHomeAvatar}
          onNameChange={setHomeName}
          onOpenRules={() => {
            setPointsInitialTab('vip');
            setPointsReturnScreen('Profile');
            setCurrentScreen('Points');
          }}
        />}
        {currentScreen === 'Admin' && isAdmin && AdminScreen()}
        {currentScreen === 'Admin' && isAdmin &&
          !['perfil','nailbook'].includes(adminSection) &&
          <View style={styles.adminQuickOverlay} pointerEvents="box-none">
            {adminQuickOpen && <View style={styles.adminQuickMenu}>
              {[
                ['manual','calendar-outline','Agendar cliente'],
                ['bloqueios','lock-closed-outline','Bloquear dias e horários'],
                ['servicos','add-circle-outline','Adicionar novo serviço'],
              ].map(([section,icon,label]) =>
                <TouchableOpacity key={label} accessibilityRole="button"
                  accessibilityLabel={label} style={styles.adminQuickItem}
                  onPress={() => {
                    setAdminQuickOpen(false);
                    if(section==='manual') {
                      setShowAdminBookingModal(true);
                    } else {
                      goToAdminSection(section);
                      if(section==='servicos')beginNewService();
                    }
                  }}>
                  <Ionicons name={icon} color={colors.mocha} size={21}/>
                  <Text style={styles.adminQuickLabel}>{label}</Text>
                </TouchableOpacity>)}
            </View>}
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={adminQuickOpen ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
              accessibilityState={{expanded:adminQuickOpen}}
              style={styles.adminFab}
              onPress={() => setAdminQuickOpen(value=>!value)}>
              <Ionicons name={adminQuickOpen?'close':'add'} color={colors.white} size={32}/>
            </TouchableOpacity>
          </View>}
      </View>

      {isAdmin && showAdminBookingModal && <AdminManualBooking
        visible
        services={services}
        onClose={() => setShowAdminBookingModal(false)}
        onBooked={() => {
          setAdminCalendarRefresh(value => value + 1);
          loadAdminTodayStats();
        }}
        onShowAgenda={() => {
          goToAdminSection('agenda');
          setAdminCalendarRefresh(value => value + 1);
        }}
      />}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Home')}>
          <Ionicons name={currentScreen === 'Home' ? 'home' : 'home-outline'} size={24} color={currentScreen === 'Home' ? homeColors.brown : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Home' && styles.navTextActive]}>Início</Text>
        </TouchableOpacity>
        {!isAdmin && <TouchableOpacity style={styles.navItem}
          onPress={() => { setCurrentScreen('Booking'); if (user) { setBookingView('hub'); setBookingSuccess(''); } }}>
          <Ionicons name={currentScreen === 'Booking' ? 'calendar' : 'calendar-outline'} size={24} color={currentScreen === 'Booking' ? homeColors.brown : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Booking' && styles.navTextActive]}>{user ? 'Reservas' : 'Agendar'}</Text>
        </TouchableOpacity>}
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Portfolio')}>
          <Ionicons name={currentScreen === 'Portfolio' ? 'image' : 'image-outline'} size={24} color={currentScreen === 'Portfolio' ? homeColors.brown : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Portfolio' && styles.navTextActive]}>Galeria</Text>
        </TouchableOpacity>
        {!isAdmin && <TouchableOpacity style={styles.navItem} onPress={() => isAdmin ? (setAdminSection('perfil'),setCurrentScreen('Admin')) : user ? setCurrentScreen('Profile') : onRequestAuth('Profile')}>
          <Ionicons name={currentScreen === 'Profile' ? 'person' : 'person-outline'} size={24} color={currentScreen === 'Profile' ? homeColors.brown : colors.muted}/>
          <Text style={[styles.navText,currentScreen === 'Profile' && styles.navTextActive]}>{user ? 'Perfil' : 'Entrar'}</Text>
        </TouchableOpacity>}
        {isAdmin && (
          <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Admin')}>
            <Ionicons name={currentScreen === 'Admin' ? 'settings' : 'settings-outline'} size={24} color={currentScreen === 'Admin' ? homeColors.brown : colors.muted} />
            <Text style={[styles.navText, currentScreen === 'Admin' && styles.navTextActive]}>Admin</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);
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
        setNeedsPhone(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role,phone')
          .eq('id', session.user.id)
          .single();
        if (error) throw error;
        if (active) {
          setIsAdmin(data.role === 'admin');
          setNeedsPhone(data.role !== 'admin' && !normalizeBrazilMobile(data.phone));
          setUser(session.user);
          setErrorMessage('');
        }
      } catch (error) {
        if (active) {
          setUser(null);
          setIsAdmin(false);
          setNeedsPhone(false);
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

  if (user && needsPhone && !isAdmin) {
    return <CompletePhoneScreen user={user}
      onSaved={() => setNeedsPhone(false)} onLogout={handleLogout}/>;
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
  homeScroll: { backgroundColor: homeColors.background },
  adminHeader:{flexDirection:'row',alignItems:'center',gap:13,marginBottom:20,marginTop:8},
  adminTitle:{fontSize:23,fontWeight:'800',color:colors.ink,letterSpacing:-0.5},
  adminSubtitle:{fontSize:13,color:'#756F6A',marginTop:5,lineHeight:19},
  adminHeaderActions:{flexDirection:'row',alignItems:'center',gap:6},
  adminHeaderIcon:{width:42,height:42,alignItems:'center',justifyContent:'center',position:'relative'},
  adminUnreadDot:{width:10,height:10,borderRadius:5,backgroundColor:'#C82637',
    position:'absolute',right:6,top:5,borderWidth:1,borderColor:'#F4F5F7'},
  adminKpiHeader:{flexDirection:'row',justifyContent:'space-between',
    alignItems:'center',marginBottom:12},
  adminKpiHeading:{fontSize:17,fontWeight:'700',color:colors.ink},
  adminKpiRow:{flexDirection:'row',gap:10,marginBottom:24},
  adminKpiCard:{flex:1,borderRadius:15,paddingHorizontal:13,paddingVertical:16,minWidth:0},
  adminKpiLabel:{fontSize:12,color:colors.ink,marginBottom:5},
  adminKpiValue:{fontSize:20,fontWeight:'800',color:colors.ink,minHeight:25},
  adminKpiError:{fontSize:12,color:'#B42318',marginBottom:12},
  adminSettingsCard:{borderRadius:18,backgroundColor:colors.white,
    borderWidth:1,borderColor:colors.border,paddingHorizontal:17,paddingTop:18,
    paddingBottom:6,marginBottom:20},
  adminSettingsTitle:{fontSize:19,fontWeight:'800',color:colors.ink},
  adminSettingsSubtitle:{fontSize:12,color:colors.mocha,marginTop:5,marginBottom:13},
  adminSettingsRow:{flexDirection:'row',alignItems:'center',gap:12,
    paddingVertical:13,borderTopWidth:1,borderTopColor:colors.border},
  adminSettingsIcon:{width:40,height:40,borderRadius:12,backgroundColor:'#F3ECE5',
    alignItems:'center',justifyContent:'center'},
  adminSettingsRowTitle:{color:colors.ink,fontSize:14,fontWeight:'700'},
  adminSettingsRowCaption:{color:colors.mocha,fontSize:12,marginTop:4,lineHeight:17},
  adminQuickOverlay:{position:'absolute',right:20,bottom:18,alignItems:'flex-end',
    zIndex:50,elevation:8},
  adminFab:{width:58,height:58,borderRadius:29,backgroundColor:'#604736',
    alignItems:'center',justifyContent:'center',shadowColor:'#281B16',
    shadowOpacity:0.28,shadowRadius:13,shadowOffset:{width:0,height:7},elevation:7},
  adminQuickMenu:{marginBottom:13,backgroundColor:colors.white,
    borderRadius:17,borderWidth:1,borderColor:colors.border,minWidth:225,
    paddingHorizontal:7,paddingVertical:7,shadowColor:'#3B2B22',
    shadowOpacity:0.14,shadowRadius:15,shadowOffset:{width:0,height:5},elevation:6},
  adminQuickItem:{flexDirection:'row',alignItems:'center',gap:12,
    paddingHorizontal:13,paddingVertical:14,borderRadius:11},
  adminQuickLabel:{color:colors.ink,fontWeight:'700',fontSize:13},
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
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: homeColors.bronze,
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
  homeSectionHeading: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 17, marginTop: 7 },
  homeSectionLabel: { alignItems: 'flex-start' },
  homeSectionTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  homeSectionAccent: { width: 38, height: 3, backgroundColor: colors.mocha, borderRadius: 3, marginTop: 7 },
  homeSectionLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 3 },
  homeSectionLinkText: { color: colors.mocha, fontSize: 13, fontWeight: '600' },
  homeServicesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    rowGap: 12, marginBottom: 15 },
  homeServiceCard: { width: '48%', minHeight: 124, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    padding: 15, justifyContent: 'space-between' },
  homeServiceEmoji: { fontSize: 28, lineHeight: 32, alignSelf: 'flex-start' },
  homeServiceName: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 11 },
  homeServiceMeta: { color: colors.mocha, fontSize: 12, marginTop: 5 },
  homeInspirationsSection: { marginTop: 7, marginBottom: 23 },
  homeInspirationCarousel: { gap: 12, paddingBottom: 2 },
  homeInspirationCard: { width: 157, backgroundColor: colors.white,
    borderRadius: 14, borderColor: colors.border, borderWidth: 1, overflow: 'hidden' },
  homeInspirationImage: { width: '100%', height: 151, backgroundColor: colors.nude },
  homeInspirationName: { paddingHorizontal: 10, paddingVertical: 10,
    color: colors.ink, fontSize: 12, fontWeight: '600' },
  homeGalleryMessage: { color: colors.mocha, fontSize: 13, paddingVertical: 14 },
  homeNailBookButton: { justifyContent: 'center', marginTop: -13, marginBottom: 10 },
  serviceModalOverlay: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.62)',
    alignItems: 'center', justifyContent: 'center', padding: 16 },
  serviceModalCard: { width: '100%', maxWidth: 520, maxHeight: '88%',
    borderRadius: 22, backgroundColor: colors.white, overflow: 'hidden',
    shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 22, elevation: 12 },
  serviceModalHeader: { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingVertical: 17,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  serviceModalHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceModalIcon: { width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.nude },
  serviceModalTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  serviceModalSubtitle: { marginTop: 4, fontSize: 12, color: colors.mocha },
  serviceModalClose: { width: 38, height: 38, alignItems: 'center',
    justifyContent: 'center', borderRadius: 19, backgroundColor: colors.nude },
  serviceModalScroll: { flexShrink: 1 },
  serviceModalFields: { paddingHorizontal: 20, paddingTop: 19, paddingBottom: 12 },
  serviceModalField: { marginBottom: 16 },
  serviceModalFieldLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  serviceModalInput: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.ink, minHeight: 48 },
  serviceModalTextarea: { minHeight: 86 },
  serviceModalActive: { flexDirection: 'row', gap: 12, alignItems: 'center',
    padding: 13, borderRadius: 13, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, marginBottom: 7 },
  serviceModalActiveTitle: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  serviceModalActiveHint: { fontSize: 12, color: colors.mocha, marginTop: 3 },
  serviceModalErrorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF2F1', padding: 12, borderRadius: 10, marginTop: 10 },
  serviceModalErrorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 18 },
  serviceModalActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20,
    paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border },
  serviceModalCancel: { flex: 1, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  serviceModalCancelText: { fontSize: 14, color: colors.mocha, fontWeight: '700' },
  serviceModalSave: { flex: 1.5, flexDirection: 'row', gap: 7, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: colors.ink },
  serviceModalSaveText: { color: colors.white, fontSize: 14, fontWeight: '700' },
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
  navTextActive: { color: homeColors.brown, fontWeight: 'bold' },
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
  studioInfoCard: { marginTop: 27, borderWidth: 1, borderColor: colors.border,
    borderRadius: 19, backgroundColor: colors.white, padding: 20 },
  studioInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  studioInfoLogo: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.nude,
    alignItems: 'center', justifyContent: 'center' },
  studioInfoHeading: { color: colors.ink, fontWeight: '700', fontSize: 17 },
  studioInfoTagline: { color: colors.mocha, fontSize: 12, marginTop: 4 },
  studioInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 10 },
  studioInfoRowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F5F0EB',
    alignItems: 'center', justifyContent: 'center' },
  studioInfoRowText: { flex: 1, minWidth: 0 },
  studioInfoLabel: { color: colors.muted, fontSize: 11, marginBottom: 4 },
  studioInfoValue: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  studioInfoAddress: { color: colors.mocha, fontSize: 12, marginTop: 3 },
  studioInfoDivider: { height: 1, backgroundColor: colors.border, marginVertical: 5 },
  studioInfoFooter: { marginTop: 13, color: colors.mocha, textAlign: 'center', fontSize: 11 },
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
