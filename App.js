import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
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
import ClientSettings from './ClientSettings';
import PrivacyNotice from './PrivacyNotice';
import AdminManualBooking from './AdminManualBooking';
import TRPointsDashboard from './TRPointsDashboard';
import PortfolioScreen from './PortfolioScreen';
import ClientAppointments from './ClientAppointments';
import ClientNotifications from './ClientNotifications';
import AdminNotifications from './AdminNotifications';
import NailBook from './NailBook';
import BookingWizard from './BookingWizard';
import {brandColors as colors, homeColors} from './theme/tokens';
import styles from './appStyles';
import HomeScreen from './HomeScreen';
import AdminScreen from './AdminScreen';
import {localDateKey,futureDates,initialBookableDate,buildCalendar} from './utils/calendar';

// Cores originais importadas de uma fonte de verdade compartilhada.

function MainApp({ user, isAdmin, onLogout, onRequestAuth, initialScreen = 'Home', initialServiceId = null }) {
  const [currentScreen, setCurrentScreen] = useState(isAdmin ? 'Admin' : initialScreen);
  const [privacyVisible,setPrivacyVisible]=useState(false);
  useEffect(() => {
    if(isAdmin && ['Booking','Profile','Points'].includes(currentScreen)) setCurrentScreen('Admin');
  },[isAdmin,currentScreen]);
  const [homeAvatar, setHomeAvatar] = useState(null);
  const [homeName, setHomeName] = useState('');
  const [pointsInitialTab, setPointsInitialTab] = useState('ledger');
  const [pointsReturnScreen, setPointsReturnScreen] = useState('Home');
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [appAlertsEnabled, setAppAlertsEnabled] = useState(true);
  const [notificationReturnScreen, setNotificationReturnScreen] = useState('Home');
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
  useEffect(() => {
    if(!user?.id || isAdmin)return;
    let active=true;
    const loadAppAlerts=async()=>{
      const {data,error}=await supabase.from('client_care_preferences')
        .select('app_alerts_enabled').eq('user_id',user.id).maybeSingle();
      if(active&&!error)setAppAlertsEnabled(data?.app_alerts_enabled!==false);
    };
    loadAppAlerts();
    return()=>{active=false;};
  },[user?.id,isAdmin,currentScreen]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContent}>
        {currentScreen === 'Home' && <HomeScreen
          user={user} isAdmin={isAdmin} homeAvatar={homeAvatar}
          displayName={displayName} appAlertsEnabled={appAlertsEnabled}
          unreadAdminCount={unreadAdminCount} unreadNotifications={unreadNotifications}
          myAppointmentsRefresh={myAppointmentsRefresh}
          activeServices={activeServices} servicesLoading={servicesLoading}
          serviceError={serviceError} homeInspirations={homeInspirations}
          homeInspirationsLoading={homeInspirationsLoading}
          homeInspirationsError={homeInspirationsError}
          onLogout={onLogout} onRequestAuth={onRequestAuth}
          setCurrentScreen={setCurrentScreen} setAdminSection={setAdminSection}
          setNotificationReturnScreen={setNotificationReturnScreen}
          setBookingView={setBookingView} setBookingSuccess={setBookingSuccess}
          setPointsInitialTab={setPointsInitialTab}
          setPointsReturnScreen={setPointsReturnScreen}
          setShowAdminBookingModal={setShowAdminBookingModal}
          setSelectedServiceId={setSelectedServiceId} setSelectedTime={setSelectedTime}
          setPaymentMethod={setPaymentMethod} setBookingStartStep={setBookingStartStep}
          setPrivacyVisible={setPrivacyVisible} money={money}
        />}
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
          onBack={() => setCurrentScreen(isAdmin ? 'Home' : notificationReturnScreen)}
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
        {currentScreen === 'Profile' && user && !isAdmin && <ClientSettings
          user={user}
          onLogout={onLogout}
          onAvatarChange={setHomeAvatar}
          onNameChange={setHomeName}
          onBack={() => setCurrentScreen('Home')}
          onAppAlertsChange={setAppAlertsEnabled}
          onOpenNotifications={() => {
            setNotificationReturnScreen('Profile');
            setCurrentScreen('Notifications');
          }}
          onOpenHistory={() => {
            setPointsInitialTab('services');
            setPointsReturnScreen('Profile');
            setCurrentScreen('Points');
          }}
          onOpenRules={() => {
            setPointsInitialTab('vip');
            setPointsReturnScreen('Profile');
            setCurrentScreen('Points');
          }}
        />}
        {currentScreen === 'Admin' && isAdmin && <AdminScreen
          adminSection={adminSection} setAdminSection={setAdminSection}
          goToAdminSection={goToAdminSection} user={user} onLogout={onLogout}
          setHomeAvatar={setHomeAvatar} setHomeName={setHomeName}
          unreadAdminCount={unreadAdminCount} setAdminQuickOpen={setAdminQuickOpen}
          setCurrentScreen={setCurrentScreen}
          loadAdminTodayStats={loadAdminTodayStats}
          adminStatsLoading={adminStatsLoading} adminTodayStats={adminTodayStats}
          adminStatsError={adminStatsError} adminCalendarRefresh={adminCalendarRefresh}
          services={services} loadServices={loadServices}
          servicesLoading={servicesLoading} serviceError={serviceError}
          showServiceForm={showServiceForm} beginNewService={beginNewService}
          beginEditService={beginEditService} toggleService={toggleService}
          money={money} saveService={saveService}
          closeServiceForm={closeServiceForm} savingService={savingService}
          editingId={editingId} serviceForm={serviceForm}
          setServiceForm={setServiceForm}
        />}
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

      <PrivacyNotice visible={privacyVisible} onClose={()=>setPrivacyVisible(false)}/>

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
