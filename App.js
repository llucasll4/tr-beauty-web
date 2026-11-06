import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image, Platform, StatusBar, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const imageSize = (width - 48 - 16) / 2; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');

  const HomeScreen = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, Marcela ✨</Text>
          <Text style={styles.subtitle}>Pronta para renovar suas unhas?</Text>
        </View>
        <View style={styles.profileIcon}>
          <Text style={styles.profileInitials}>M</Text>
        </View>
      </View>

      <View style={styles.loyaltyCard}>
        <View style={styles.loyaltyHeader}>
          <Text style={styles.loyaltyBrand}>TR BEAUTY CONCEPT</Text>
          <Ionicons name="diamond-outline" size={20} color="#2C2C2C" />
        </View>
        <Text style={styles.pointsValue}>250</Text>
        <Text style={styles.pointsLabel}>TR Points</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '83%' }]} />
          </View>
          <Text style={styles.pointsSubtitle}>Faltam 50 pontos para sua próxima recompensa!</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentScreen('Booking')}>
        <Text style={styles.primaryButtonText}>Agendar Meu Horário</Text>
        <Ionicons name="calendar-outline" size={20} color="#FAF9F6" />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Serviços Populares</Text>
      <View style={styles.servicesGrid}>
        <View style={styles.simpleServiceCard}>
          <Text style={styles.serviceTitle}>Manutenção Fibra</Text>
          <Text style={styles.serviceDetails}>2h • R$ 150</Text>
        </View>
        <View style={styles.simpleServiceCard}>
          <Text style={styles.serviceTitle}>Banho de Gel</Text>
          <Text style={styles.serviceDetails}>1h30 • R$ 120</Text>
        </View>
      </View>
    </ScrollView>
  );

  const BookingScreen = () => {
    const [selectedService, setSelectedService] = useState('1');
    const [selectedDate, setSelectedDate] = useState('14');
    const [selectedTime, setSelectedTime] = useState('14:00');

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Novo Agendamento</Text>
        </View>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.sectionTitle}>1. Escolha o serviço</Text>
          <TouchableOpacity style={[styles.bookingCard, styles.bookingCardSelected]}>
            <View>
              <Text style={styles.serviceTitle}>Manutenção em Gel</Text>
              <Text style={styles.serviceDetails}>90 min • R$ 120</Text>
            </View>
            <View style={styles.radioSelected}><View style={styles.radioDot}/></View>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Escolha a data</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {['14 Ter', '15 Qua', '16 Qui'].map((d) => (
              <TouchableOpacity key={d} style={selectedDate === d.split(' ')[0] ? styles.dateBoxSelected : styles.dateBox} onPress={() => setSelectedDate(d.split(' ')[0])}>
                <Text style={selectedDate === d.split(' ')[0] ? {color: 'white', fontWeight: 'bold'} : {color: '#2C2C2C'}}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>3. Horário</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {['09:00', '10:30', '14:00', '15:30'].map((t) => (
               <TouchableOpacity key={t} style={selectedTime === t ? styles.timeBoxSelected : styles.timeBox} onPress={() => setSelectedTime(t)}>
                 <Text style={selectedTime === t ? {color: 'white', fontWeight: 'bold'} : {color: '#2C2C2C'}}>{t}</Text>
               </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={styles.footerBooking}>
          <TouchableOpacity style={styles.confirmButton} onPress={() => { alert('Horário Confirmado com Sucesso!'); setCurrentScreen('Home'); }}>
            <Text style={styles.confirmButtonText}>Confirmar Reserva</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const PortfolioScreen = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Inspirações</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {[1,2,3,4].map((i) => (
            <View key={i} style={styles.imageCard}>
              <View style={styles.mockImage}>
                <Ionicons name="image-outline" size={40} color="#8E8E93" />
                <Text style={{color: '#8E8E93', marginTop: 10}}>Foto {i}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const AdminScreen = () => (
    <ScrollView contentContainerStyle={[styles.container, {backgroundColor: '#F4F5F7'}]}>
      <View style={{marginBottom: 24, marginTop: 10}}>
        <Text style={styles.greeting}>Painel Admin 👩‍💻</Text>
        <Text style={styles.subtitle}>Visão geral do estúdio</Text>
      </View>

      <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
        <View style={styles.adminStatCard}>
          <Text style={{fontSize: 12, color: '#8E8E93'}}>Faturação Hoje</Text>
          <Text style={{fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', marginTop: 5}}>R$ 450</Text>
        </View>
        <View style={styles.adminStatCard}>
          <Text style={{fontSize: 12, color: '#8E8E93'}}>Agendamentos</Text>
          <Text style={{fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', marginTop: 5}}>4</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Agenda de Hoje</Text>
      <View style={styles.adminAgendaCard}>
        <Text style={{fontWeight: 'bold'}}>14:00 - 15:30</Text>
        <Text>Marcela Silva • Manutenção</Text>
        <Text style={{color: '#4CAF50', fontWeight: 'bold', marginTop: 5}}>Confirmado</Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContent}>
        {currentScreen === 'Home' && <HomeScreen />}
        {currentScreen === 'Booking' && <BookingScreen />}
        {currentScreen === 'Portfolio' && <PortfolioScreen />}
        {currentScreen === 'Admin' && <AdminScreen />}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Home')}>
          <Ionicons name={currentScreen === 'Home' ? "home" : "home-outline"} size={24} color={currentScreen === 'Home' ? "#2C2C2C" : "#8E8E93"} />
          <Text style={[styles.navText, currentScreen === 'Home' && styles.navTextActive]}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Booking')}>
          <Ionicons name={currentScreen === 'Booking' ? "calendar" : "calendar-outline"} size={24} color={currentScreen === 'Booking' ? "#2C2C2C" : "#8E8E93"} />
          <Text style={[styles.navText, currentScreen === 'Booking' && styles.navTextActive]}>Agendar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Portfolio')}>
          <Ionicons name={currentScreen === 'Portfolio' ? "image" : "image-outline"} size={24} color={currentScreen === 'Portfolio' ? "#2C2C2C" : "#8E8E93"} />
          <Text style={[styles.navText, currentScreen === 'Portfolio' && styles.navTextActive]}>Galeria</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('Admin')}>
          <Ionicons name={currentScreen === 'Admin' ? "settings" : "settings-outline"} size={24} color={currentScreen === 'Admin' ? "#2C2C2C" : "#8E8E93"} />
          <Text style={[styles.navText, currentScreen === 'Admin' && styles.navTextActive]}>Admin</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDFBF7', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  mainContent: { flex: 1 },
  container: { padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, marginTop: 10 },
  pageHeader: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#EBE5DF', backgroundColor: '#FFF' },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#2C2C2C' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#2C2C2C', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8E8E93' },
  profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBE5DF', justifyContent: 'center', alignItems: 'center' },
  profileInitials: { fontSize: 16, fontWeight: '600', color: '#2C2C2C' },
  loyaltyCard: { backgroundColor: '#EBE5DF', borderRadius: 20, padding: 24, marginBottom: 24 },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  loyaltyBrand: { fontSize: 12, letterSpacing: 2, fontWeight: '600', color: '#2C2C2C' },
  pointsValue: { fontSize: 48, fontWeight: '300', color: '#2C2C2C', lineHeight: 52 },
  pointsLabel: { fontSize: 16, fontWeight: '500', color: '#2C2C2C', marginBottom: 24 },
  progressContainer: { marginTop: 8 },
  progressBarBackground: { height: 6, backgroundColor: '#D9D1C7', borderRadius: 3, marginBottom: 8 },
  progressBarFill: { height: 6, backgroundColor: '#2C2C2C', borderRadius: 3 },
  pointsSubtitle: { fontSize: 12, color: '#5C5C5C' },
  primaryButton: { backgroundColor: '#2C2C2C', flexDirection: 'row', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  primaryButtonText: { color: '#FAF9F6', fontSize: 16, fontWeight: '600', marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2C2C2C', marginBottom: 16 },
  servicesGrid: { gap: 12 },
  simpleServiceCard: { padding: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EBE5DF' },
  serviceTitle: { fontSize: 15, fontWeight: '600', color: '#2C2C2C', marginBottom: 4 },
  serviceDetails: { fontSize: 13, color: '#8E8E93' },
  bookingCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#EBE5DF' },
  bookingCardSelected: { borderColor: '#2C2C2C', backgroundColor: '#FAF9F6' },
  radioSelected: { height: 20, width: 20, borderRadius: 10, borderWidth: 1, borderColor: '#2C2C2C', alignItems: 'center', justifyContent: 'center' },
  radioDot: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#2C2C2C' },
  dateBox: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#EBE5DF' },
  dateBoxSelected: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#2C2C2C', borderRadius: 8 },
  timeBox: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#EBE5DF' },
  timeBoxSelected: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#2C2C2C', borderRadius: 8 },
  footerBooking: { padding: 24, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EBE5DF' },
  confirmButton: { backgroundColor: '#2C2C2C', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 },
  imageCard: { width: imageSize, height: imageSize * 1.3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EBE5DF' },
  mockImage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EBE5DF' },
  adminStatCard: { flex: 1, backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EBE5DF' },
  adminAgendaCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EBE5DF' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EBE5DF', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 10, color: '#8E8E93', marginTop: 4 },
  navTextActive: { color: '#2C2C2C', fontWeight: 'bold' }
});
