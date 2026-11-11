import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabase';
import {localDateKey} from '../utils/calendar';

// Mantém os indicadores administrativos atuais; receita aqui representa
// o valor de serviços concluídos, não comprovação de pagamentos recebidos.
export function useAdminTodayStats({user,isAdmin,currentScreen,adminSection}) {
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

  return {
    adminTodayStats, adminStatsError, adminStatsLoading, loadAdminTodayStats,
  };
}
