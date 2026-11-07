import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

function MainApp({ user, isAdmin, onLogout }) {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(localDateKey(new Date()));
  const [selectedTime, setSelectedTime] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
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
    duration_minutes: '', active: true,
  });

  async function loadServices() {
    setServicesLoading(true);
    setServiceError('');
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id,name,description,category,price,duration_minutes,active')
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

  function beginNewService() {
    setEditingId(null);
    setServiceForm({ name: '', description: '', category: '', price: '', duration_minutes: '', active: true });
    setShowServiceForm(true);
    setServiceError('');
  }

  function beginEditService(service) {
    setEditingId(service.id);
    setServiceForm({
      name: service.name || '', description: service.description || '',
      category: service.category || '', price: String(service.price),
      duration_minutes: String(service.duration_minutes), active: service.active,
    });
    setShowServiceForm(true);
    setServiceError('');
  }

  async function saveService() {
    if (!isAdmin) return;
    const price = Number(serviceForm.price.replace(',', '.'));
    const duration = Number(serviceForm.duration_minutes);
    if (!serviceForm.name.trim() || !serviceForm.price.trim() ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(duration) || duration <= 0) {
      setServiceError('Preencha nome, preço válido e duração em minutos maior que zero.');
      return;
    }
    setSavingService(true);
    setServiceError('');
    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      category: serviceForm.category.trim() || null,
      price, duration_minutes: duration, active: serviceForm.active,
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
    if (!selectedServiceId || !selectedDate) return;
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
  }, [selectedServiceId, selectedDate, bookingSuccess]);

  async function confirmBooking() {
    if (!selectedServiceId || !selectedTime || bookingSaving) return;
    setBookingSaving(true);
    setBookingError('');
    setBookingSuccess('');
    try {
      const { error } = await supabase.rpc('book_appointment', {
        p_service_id: selectedServiceId, p_starts_at: selectedTime,
      });
      if (error) throw error;
      setBookingSuccess('Reserva enviada com sucesso! Aguarde a confirmação do estúdio.');
      setSelectedTime(null);
      if (isAdmin) await loadAppointments();
    } catch (err) {
      setBookingError('Não foi possível reservar: ' + err.message);
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
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.greeting}>Olá, bem-vinda! ✨</Text>
          <Text style={styles.subtitle}>Pronta para renovar suas unhas?</Text>
        </View>
        <View style={styles.profileIcon}>
          <Ionicons name="person-outline" size={23} color={colors.ink} />
        </View>
      </View>

      <View style={styles.loyaltyCard}>
        <View style={styles.loyaltyHeader}>
          <Text style={styles.loyaltyBrand}>TR BEAUTY CONCEPT</Text>
          <Ionicons name="diamond-outline" size={20} color={colors.ink} />
        </View>
        <Text style={styles.pointsValue}>—</Text>
        <Text style={styles.pointsLabel}>TR Points</Text>
        <Text style={styles.pointsSubtitle}>
          Seu saldo aparecerá aqui quando o programa de fidelidade estiver ativo.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentScreen('Booking')}>
        <Text style={styles.primaryButtonText}>Agendar Meu Horário</Text>
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
      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Ionicons name="log-out-outline" size={18} color={colors.mocha} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const BookingScreen = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Novo agendamento</Text>
        <Text style={styles.subtitle}>Terça a sábado, das 09h às 18h • horário de Brasília</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>1. Escolha o serviço</Text>
        {activeServices.map(service => (
          <TouchableOpacity key={service.id}
            style={[styles.bookingCard, selectedServiceId === service.id && styles.bookingCardSelected, { marginBottom: 10 }]}
            onPress={() => { setBookingSuccess(''); setSelectedServiceId(service.id); }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceTitle}>{service.name}</Text>
              <Text style={styles.serviceDetails}>{service.duration_minutes} min • {money(service.price)}</Text>
            </View>
            <Ionicons name={selectedServiceId === service.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.mocha} />
          </TouchableOpacity>
        ))}
        {!activeServices.length && <Text style={styles.subtitle}>Nenhum serviço ativo disponível.</Text>}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>2. Escolha a data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {dates.map(date => (
            <TouchableOpacity key={date.key} onPress={() => { setBookingSuccess(''); setSelectedDate(date.key); }}
              style={[selectedDate === date.key ? styles.dateBoxSelected : styles.dateBox, { marginRight: 8 }]}>
              <Text style={selectedDate === date.key ? styles.optionSelectedText : styles.optionText}>{date.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>3. Horários disponíveis</Text>
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
        <TouchableOpacity disabled={!selectedTime || bookingSaving || slotsLoading} onPress={confirmBooking}
          style={[styles.confirmButton, (!selectedTime || bookingSaving || slotsLoading) && { opacity: 0.45 }]}>
          {bookingSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmButtonText}>Confirmar reserva</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  const PortfolioScreen = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Inspirações</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((item) => (
            <View key={item} style={styles.imageCard}>
              <View style={styles.mockImage}>
                <Ionicons name="image-outline" size={40} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 10 }}>Foto {item}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const AdminScreen = () => (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: '#F4F5F7', flexGrow: 1 }]}>
      <View style={{ marginBottom: 24, marginTop: 10 }}>
        <Text style={styles.greeting}>Painel Admin 👩‍💻</Text>
        <Text style={styles.subtitle}>Visão geral do estúdio • dados de exemplo</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <View style={styles.adminStatCard}>
          <Text style={styles.adminStatLabel}>Faturamento hoje</Text>
          <Text style={styles.adminStatValue}>—</Text>
        </View>
        <View style={styles.adminStatCard}>
          <Text style={styles.adminStatLabel}>Agendamentos</Text>
          <Text style={styles.adminStatValue}>—</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Agendamentos reais</Text>
      <TouchableOpacity onPress={loadAppointments} style={{ paddingVertical: 10 }}>
        <Text style={{ color: colors.mocha, fontWeight: '600' }}>Atualizar agenda</Text>
      </TouchableOpacity>
      {appointmentsLoading && <ActivityIndicator color={colors.mocha} />}
      {!!appointmentsError && <Text style={styles.loginError}>{appointmentsError}</Text>}
      {!appointmentsLoading && appointments.length === 0 && <Text style={[styles.subtitle, { marginBottom: 20 }]}>Sem agendamentos recentes ou futuros.</Text>}
      {appointments.map(item => (
        <View key={item.id} style={[styles.adminAgendaCard, { marginBottom: 12 }]}>
          <Text style={styles.serviceTitle}>{readableDate(item.starts_at)}</Text>
          <Text style={styles.serviceDetails}>{item.services?.name || 'Serviço'} • {money(item.price_at_booking)}</Text>
          <Text style={[styles.subtitle, { marginTop: 5 }]}>Cliente: {item.profiles?.full_name || 'Nome não cadastrado'}</Text>
          <Text style={[styles.subtitle, { marginTop: 5 }]}>Status: {({ pending:'Pendente', confirmed:'Confirmado', completed:'Concluído', cancelled:'Cancelado' })[item.status] || item.status}</Text>
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
              {item.status === 'pending' && <TouchableOpacity disabled={!!statusSavingId} onPress={() => changeAppointmentStatus(item, 'confirmed')}><Text style={styles.adminAction}>Confirmar</Text></TouchableOpacity>}
              {item.status === 'confirmed' && <TouchableOpacity disabled={!!statusSavingId} onPress={() => changeAppointmentStatus(item, 'completed')}><Text style={styles.adminAction}>Concluir</Text></TouchableOpacity>}
              <TouchableOpacity disabled={!!statusSavingId} onPress={() => changeAppointmentStatus(item, 'cancelled')}><Text style={styles.adminAction}>Cancelar</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
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
          ].map(([field, title]) => (
            <View key={field}>
              <Text style={styles.inputLabel}>{title}</Text>
              <TextInput
                style={styles.loginInput}
                value={serviceForm[field]}
                onChangeText={(value) => setServiceForm((prev) => ({ ...prev, [field]: value }))}
                keyboardType={field === 'price' ? 'decimal-pad' : field === 'duration_minutes' ? 'number-pad' : 'default'}
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
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Agenda de hoje</Text>
      <View style={styles.adminAgendaCard}>
        <Text style={styles.subtitle}>Ainda não conectada ao Supabase.</Text>
      </View>
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
        {currentScreen === 'Booking' && BookingScreen()}
        {currentScreen === 'Portfolio' && PortfolioScreen()}
        {currentScreen === 'Admin' && isAdmin && AdminScreen()}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Home')}>
          <Ionicons name={currentScreen === 'Home' ? 'home' : 'home-outline'} size={24} color={currentScreen === 'Home' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Home' && styles.navTextActive]}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Booking')}>
          <Ionicons name={currentScreen === 'Booking' ? 'calendar' : 'calendar-outline'} size={24} color={currentScreen === 'Booking' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Booking' && styles.navTextActive]}>Agendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Portfolio')}>
          <Ionicons name={currentScreen === 'Portfolio' ? 'image' : 'image-outline'} size={24} color={currentScreen === 'Portfolio' ? colors.ink : colors.muted} />
          <Text style={[styles.navText, currentScreen === 'Portfolio' && styles.navTextActive]}>Galeria</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Admin')}>
            <Ionicons name={currentScreen === 'Admin' ? 'settings' : 'settings-outline'} size={24} color={currentScreen === 'Admin' ? colors.ink : colors.muted} />
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  async function handleLogin() {
    if (!email.trim() || !password) {
      setErrorMessage('Informe seu e-mail e senha.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMessage('Não foi possível entrar. Confira e-mail, senha e confirmação da conta.');
      }
    } catch (error) {
      setErrorMessage('Falha na conexão. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Erro', 'Não foi possível sair da conta. Tente novamente.');
  }

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color={colors.mocha} />
        <Text style={[styles.subtitle, { marginTop: 14 }]}>Carregando TR Beauty Concept...</Text>
      </View>
    );
  }

  if (user) {
    return <MainApp user={user} isAdmin={isAdmin} onLogout={handleLogout} />;
  }

  return (
    <SafeAreaView style={styles.loginPage}>
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <View style={styles.loginLogo}>
          <Ionicons name="sparkles-outline" size={30} color={colors.mocha} />
        </View>
        <Text style={styles.loginTitle}>TR Beauty Concept</Text>
        <Text style={styles.loginSubtitle}>Seu espaço de beleza, do seu jeito.</Text>
        <Text style={styles.inputLabel}>E-mail</Text>
        <TextInput
          placeholder="seuemail@exemplo.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          style={styles.loginInput}
        />
        <Text style={styles.inputLabel}>Senha</Text>
        <TextInput
          placeholder="Digite sua senha"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          style={styles.loginInput}
          onSubmitEditing={handleLogin}
        />
        {!!errorMessage && <Text style={styles.loginError}>{errorMessage}</Text>}
        <TouchableOpacity style={[styles.loginButton, submitting && { opacity: 0.6 }]} onPress={handleLogin} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.loginButtonText}>Entrar</Text>}
        </TouchableOpacity>
        <Text style={styles.loginFootnote}>
          Nesta primeira etapa, use a conta já cadastrada no Supabase. Cadastro e recuperação de senha serão adicionados depois.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  mainContent: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 10 },
  pageHeader: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: colors.ink, marginBottom: 4 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.muted },
  profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.nude, justifyContent: 'center', alignItems: 'center' },
  loyaltyCard: { backgroundColor: colors.nude, borderRadius: 20, padding: 24, marginBottom: 24 },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  loyaltyBrand: { fontSize: 12, letterSpacing: 2, fontWeight: '600', color: colors.ink },
  pointsValue: { fontSize: 48, fontWeight: '300', color: colors.ink, lineHeight: 52 },
  pointsLabel: { fontSize: 16, fontWeight: '500', color: colors.ink, marginBottom: 24 },
  pointsSubtitle: { fontSize: 12, color: '#5C5C5C' },
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
  dateBox: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  dateBoxSelected: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.ink, borderRadius: 8 },
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
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  navItem: { alignItems: 'center', minWidth: 55 },
  navText: { fontSize: 10, color: colors.muted, marginTop: 4 },
  navTextActive: { color: colors.ink, fontWeight: 'bold' },
  adminAction: { color: colors.mocha, fontWeight: '700' },
  successText: { color: '#247047', fontWeight: '600' },
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
