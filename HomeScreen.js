import React from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import { brandColors as colors, homeColors } from './theme/tokens';
import styles from './appStyles';
import { emojiForHomeService } from './utils/services';
import LoyaltyCard from './LoyaltyCard';
import NextSelfCareCard from './NextSelfCareCard';
import ClientMaintenanceSuggestion from './ClientMaintenanceSuggestion';
import ClientCampaignCard from './ClientCampaignCard';

// Componente estável: não é recriado a cada render de MainApp.
// O estado e os callbacks continuam no controlador; a Home só apresenta dados.
export default function HomeScreen({
  user, isAdmin, homeAvatar, displayName, appAlertsEnabled,
  unreadAdminCount, unreadNotifications, myAppointmentsRefresh,
  activeServices, servicesLoading, serviceError, homeInspirations,
  homeInspirationsLoading, homeInspirationsError, onLogout, onRequestAuth,
  setCurrentScreen, setAdminSection, setNotificationReturnScreen,
  setBookingView, setBookingSuccess, setPointsInitialTab,
  setPointsReturnScreen, setShowAdminBookingModal, setSelectedServiceId,
  setSelectedTime, setPaymentMethod, setBookingStartStep, setPrivacyVisible,
  money
}) {
  return (
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
          onPress={() => {
            if(user) { setNotificationReturnScreen('Home'); setCurrentScreen('Notifications'); }
            else onRequestAuth('Home');
          }}>
          <Ionicons name="notifications-outline" size={29} color={homeColors.brown}/>
          {user && (isAdmin || appAlertsEnabled) && (isAdmin ? unreadAdminCount : unreadNotifications) > 0 && (
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
        <ClientMaintenanceSuggestion userId={user.id}
          refreshSignal={myAppointmentsRefresh}
          onStartBooking={()=>{
            setSelectedTime(null);
            setPaymentMethod('cash');
            setBookingStartStep(1);
            setBookingSuccess('');
            setBookingView('new');
            setCurrentScreen('Booking');
          }}
        />
        <ClientCampaignCard userId={user.id}
          onStartBooking={()=>{
            setSelectedTime(null);
            setPaymentMethod('cash');
            setBookingStartStep(1);
            setBookingSuccess('');
            setBookingView('new');
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
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ler aviso de privacidade"
        onPress={()=>setPrivacyVisible(true)} style={{alignSelf:'center',paddingVertical:14}}>
        <Text style={{color:colors.mocha,fontSize:12,fontWeight:'700',textDecorationLine:'underline'}}>
          Aviso de Privacidade
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
