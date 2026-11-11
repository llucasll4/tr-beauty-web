import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

// Notificações visíveis das clientes: leitura, contador, Realtime e
// atualização periódica preservam a semântica original do aplicativo.
export function useClientNotifications({user,isAdmin,currentScreen}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [appAlertsEnabled, setAppAlertsEnabled] = useState(true);
  const [notificationReturnScreen, setNotificationReturnScreen] = useState('Home');
  const [notificationsLoading, setNotificationsLoading] = useState(!!user);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationActionSaving, setNotificationActionSaving] = useState(false);

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
    // O painel Admin usa uma caixa de alertas própria; não consulta o feed de clientes.
    if (!user?.id || isAdmin) return;
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
  }, [user?.id,isAdmin]);

  useEffect(() => {
    if (!user?.id || isAdmin) {
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
  }, [user?.id, isAdmin, loadNotifications]);

  useEffect(() => {
    if (!isAdmin && user?.id && (currentScreen === 'Home' || currentScreen === 'Notifications'))
      loadNotifications();
  }, [currentScreen, user?.id, isAdmin, loadNotifications]);

  async function markNotificationRead(id = null) {
    if (!user?.id || isAdmin || notificationActionSaving) return;
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

  return {
    notifications, unreadNotifications, appAlertsEnabled, setAppAlertsEnabled,
    notificationReturnScreen, setNotificationReturnScreen, notificationsLoading,
    notificationsError, notificationActionSaving, loadNotifications,
    markNotificationRead,
  };
}
