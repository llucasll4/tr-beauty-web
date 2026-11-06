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

function MainApp({ user, isAdmin, onLogout }) {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [selectedDate, setSelectedDate] = useState('14');
  const [selectedTime, setSelectedTime] = useState('14:00');
  const [bookingNotice, setBookingNotice] = useState(false);

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

      <Text style={styles.sectionTitle}>Serviços Populares</Text>
      <View style={styles.servicesGrid}>
        <View style={styles.simpleServiceCard}>
          <Text style={styles.serviceTitle}>Manutenção Fibra</Text>
          <Text style={styles.serviceDetails}>2h • R$ 150 (exemplo)</Text>
        </View>
        <View style={styles.simpleServiceCard}>
          <Text style={styles.serviceTitle}>Banho de Gel</Text>
          <Text style={styles.serviceDetails}>1h30 • R$ 120 (exemplo)</Text>
        </View>
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
        <Text style={styles.pageTitle}>Novo Agendamento</Text>
        <Text style={styles.subtitle}>Prévia: os horários ainda não são reais.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>1. Escolha o serviço</Text>
        <View style={[styles.bookingCard, styles.bookingCardSelected]}>
          <View>
            <Text style={styles.serviceTitle}>Manutenção em Gel</Text>
            <Text style={styles.serviceDetails}>90 min • R$ 120 (exemplo)</Text>
          </View>
          <View style={styles.radioSelected}><View style={styles.radioDot} /></View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Escolha a data</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {['14 Ter', '15 Qua', '16 Qui'].map((d) => {
            const day = d.split(' ')[0];
            const selected = selectedDate === day;
            return (
              <TouchableOpacity
                key={d}
                style={selected ? styles.dateBoxSelected : styles.dateBox}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={selected ? styles.optionSelectedText : styles.optionText}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>3. Horário</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {['09:00', '10:30', '14:00', '15:30'].map((time) => {
            const selected = selectedTime === time;
            return (
              <TouchableOpacity
                key={time}
                style={selected ? styles.timeBoxSelected : styles.timeBox}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={selected ? styles.optionSelectedText : styles.optionText}>{time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footerBooking}>
        {bookingNotice && (
          <Text style={{ color: colors.mocha, marginBottom: 12 }}>
            Isto é apenas uma demonstração. Nenhuma reserva foi registrada.
          </Text>
        )}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => setBookingNotice(true)}
        >
          <Text style={styles.confirmButtonText}>Testar reserva</Text>
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
      <Text style={styles.sectionTitle}>Agenda de Hoje</Text>
      <View style={styles.adminAgendaCard}>
        <Text style={styles.serviceTitle}>Nenhum dado carregado</Text>
        <Text style={styles.subtitle}>A agenda real será conectada ao Supabase na próxima etapa.</Text>
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
        {currentScreen === 'Home' && <HomeScreen />}
        {currentScreen === 'Booking' && <BookingScreen />}
        {currentScreen === 'Portfolio' && <PortfolioScreen />}
        {currentScreen === 'Admin' && isAdmin && <AdminScreen />}
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
