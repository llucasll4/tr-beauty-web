import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './appStyles';
import { brandColors as colors, homeColors } from './theme/tokens';
import AdminCalendar from './AdminCalendar';
import AdminCalendarBlocks from './AdminCalendarBlocks';
import AdminAccountRequests from './AdminAccountRequests';
import AdminClients from './AdminClients';
import PortfolioScreen from './PortfolioScreen';
import FinancialDashboard from './FinancialDashboard';
import AdminPointsPrices from './AdminPointsPrices';
import AdminWhatsApp from './AdminWhatsApp';
import NailBook from './NailBook';
import ProfileScreen from './ProfileScreen';

// O painel administrativo é um componente estável. MainApp continua
// responsável por dados, alterações de agendamento e ações administrativas.
export default function AdminScreen({
  adminSection, setAdminSection, goToAdminSection, user, onLogout, setHomeAvatar, setHomeName, unreadAdminCount, setAdminQuickOpen, setCurrentScreen, loadAdminTodayStats, adminStatsLoading, adminTodayStats, adminStatsError, adminCalendarRefresh, services, loadServices, servicesLoading, serviceError, showServiceForm, beginNewService, beginEditService, toggleService, money, saveService, closeServiceForm, savingService, editingId, serviceForm, setServiceForm
}) {
  return adminSection === 'nailbook' ? (
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
          ['solicitacoes','trash-outline','Exclusão de contas','Pedidos das clientes aguardando análise'],
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
      {adminSection === 'solicitacoes' && <AdminAccountRequests onBack={() => goToAdminSection('configuracoes')}/>}
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
}
