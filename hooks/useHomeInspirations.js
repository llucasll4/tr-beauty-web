import {useEffect,useState} from 'react';
import {supabase} from '../supabase';

// As imagens vêm exclusivamente do portfólio público, sem exemplos fictícios.
// A variável active impede atualizar o estado após sair da Home.
export function useHomeInspirations({currentScreen,isAdmin}) {
  const [homeInspirations, setHomeInspirations] = useState([]);
  const [homeInspirationsLoading, setHomeInspirationsLoading] = useState(false);
  const [homeInspirationsError, setHomeInspirationsError] = useState('');

  // Home carrega apenas seis prévias para reduzir imagens de rede em celulares.
  // O catálogo completo segue disponível na tela Galeria.
  useEffect(() => {
    if (currentScreen !== 'Home' || isAdmin) return;
    let active = true;
    setHomeInspirationsLoading(true);
    setHomeInspirationsError('');
    supabase.from('portfolio_photos')
      .select('id,title,image_path')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(6)
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
  return {homeInspirations,homeInspirationsLoading,homeInspirationsError};
}
