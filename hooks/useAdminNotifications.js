import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

// Alerta operacional da profissional e decisões sobre pedidos pendentes.
// A atualização da agenda fica sob responsabilidade do controlador pai.
export function useAdminNotifications({user,isAdmin,currentScreen,onAppointmentChanged}) {
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [adminNotificationLoading, setAdminNotificationLoading] = useState(!!isAdmin);
  const [adminNotificationError, setAdminNotificationError] = useState('');
  const [adminNotificationBusy, setAdminNotificationBusy] = useState(null);

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
      await onAppointmentChanged();
    }finally{
      setAdminNotificationBusy(null);
      await loadAdminNotifications();
    }
  }

  return {
    adminNotifications, unreadAdminCount, adminNotificationLoading,
    adminNotificationError, adminNotificationBusy,
    loadAdminNotifications, markAdminNotificationRead, decideAdminNotification,
  };
}
