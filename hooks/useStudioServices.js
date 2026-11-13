import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

// Fonte única para o catálogo de serviços da Home, agendamentos e painel Admin.
// Mantém a consulta real, a validação do formulário e as atualizações anteriores.
export function useStudioServices({isAdmin}) {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');

  const [savingService, setSavingService] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '', description: '', price: '',
    duration_minutes: '', redeem_points: '300', maintenance_interval_days: '', active: true,
  });

  async function loadServices() {
    setServicesLoading(true);
    setServiceError('');
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id,name,description,category,price,duration_minutes,active,redeem_points,maintenance_interval_days')
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
    setServiceForm({ name: '', description: '', price: '', duration_minutes: '', redeem_points: String(300+100*services.length), maintenance_interval_days: '', active: true });
    setShowServiceForm(true);
    setServiceError('');
  }

  function beginEditService(service) {
    setEditingId(service.id);
    setServiceForm({
      name: service.name || '', description: service.description || '',
      price: String(service.price),
      duration_minutes: String(service.duration_minutes), redeem_points: String(service.redeem_points || 300),
      maintenance_interval_days: service.maintenance_interval_days == null ? '' : String(service.maintenance_interval_days), active: service.active,
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
    const cadenceText=String(serviceForm.maintenance_interval_days ?? '').trim();
    const maintenanceDays=cadenceText ? Number(cadenceText) : null;
    if (!serviceForm.name.trim() || !serviceForm.price.trim() ||
        !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(duration) || duration <= 0 ||
        !Number.isSafeInteger(redeemPoints) || redeemPoints < 1 ||
        (maintenanceDays !== null && (!Number.isSafeInteger(maintenanceDays) || maintenanceDays < 14 || maintenanceDays > 90))) {
      setServiceError('Preencha nome, preço, duração e pontos; manutenção é opcional, entre 14 e 90 dias inteiros.');
      return;
    }
    setSavingService(true);
    setServiceError('');
    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      // Categoria é opcional no Supabase e não é solicitada no formulário.
      // Para serviços já existentes, não alterar a categoria previamente salva.
      price, duration_minutes: duration, redeem_points: redeemPoints,
      maintenance_interval_days: maintenanceDays, active: serviceForm.active,
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


  const activeServices = services.filter(service => service.active);
  return {
    services, servicesLoading, serviceError, activeServices,
    savingService, editingId, showServiceForm, serviceForm, setServiceForm,
    loadServices, beginNewService, beginEditService, closeServiceForm,
    saveService, toggleService,
  };
}
