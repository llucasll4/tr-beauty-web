import {useEffect,useState} from 'react';
import {supabase} from '../supabase';

// As imagens vêm exclusivamente do portfólio público, sem exemplos fictícios.
// A variável active impede atualizar o estado após sair da Home.
export function useHomeInspirations({currentScreen,isAdmin}) {
  const [homeInspirations, setHomeInspirations] = useState([]);
  const [homeInspirationsLoading, setHomeInspirationsLoading] = useState(false);
  const [homeInspirationsError, setHomeInspirationsError] = useState('');

  // Utiliza o mesmo portfólio público da galeria, sem fotos de exemplo nem dados fictícios.
  useEffect(() => {
    if (currentScreen !== 'Home' || isAdmin) return;
    let active = true;
    setHomeInspirationsLoading(true);
    setHomeInspirationsError('');
    supabase.from('portfolio_photos')
      .select('id,title,image_path')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(12)
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
