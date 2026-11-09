import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

// Mesmo padrão de cores do TR Beauty Concept; pontuação e nível são reais.
const C = {
  ink: '#2C2C2C',
  mocha: '#7A655B',
  muted: '#717680',
  nude: '#F2EAE4',
  white: '#FFFFFF',
  gold: '#C99B68',
  border: '#EAE1D9',
};

export default function ProfilePointsBanner({ userId, onOpenRules }) {
  const [loyalty, setLoyalty] = useState(null);
  const [vip, setVip] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!userId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    Promise.all([
      supabase.rpc('get_my_loyalty'),
      supabase.rpc('get_my_vip_summary'),
      supabase.from('vip_settings').select('silver_points,gold_points').eq('id', 1).maybeSingle(),
    ]).then(([pointsResponse, vipResponse, settingsResponse]) => {
      const failed = [pointsResponse, vipResponse, settingsResponse].find(result => result.error);
      if (failed) throw failed.error;
      if (!active) return;
      setLoyalty(pointsResponse.data);
      setVip(vipResponse.data);
      setSettings(settingsResponse.data);
      setError('');
    }).catch(err => {
      if (active) {
        setError('Não foi possível consultar seus TR Points.');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [userId]);

  const valid = !!(loyalty && vip && settings);
  const lifetime = Number(vip?.lifetime_points || 0);
  const silver = Number(settings?.silver_points || 500);
  const gold = Number(settings?.gold_points || 1500);
  const tier = lifetime >= gold ? 'OURO' : lifetime >= silver ? 'PRATA' : 'BRONZE';
  const balance = Number(loyalty?.balance || 0);

  return <View style={s.banner}>
    <View style={s.starCircle}>
      <Ionicons name="star" size={25} color={C.gold}/>
    </View>
    <View style={s.texts}>
      <Text style={s.tier} numberOfLines={1}>
        {loading ? 'TR POINTS' : valid ? 'NÍVEL ' + tier : 'MEU TR POINTS'}
      </Text>
      {loading ? <ActivityIndicator color={C.mocha} style={{ alignSelf: 'flex-start', marginTop: 7 }}/> :
        <Text style={s.points} numberOfLines={1} adjustsFontSizeToFit>
          {valid ? balance.toLocaleString('pt-BR') + ' Pontos TR' : 'Saldo indisponível'}
        </Text>}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
    <TouchableOpacity style={s.rulesButton} onPress={onOpenRules}
      accessibilityRole="button" accessibilityLabel="Ver regras do Clube TR Points">
      <Text style={s.rulesText}>Ver regras</Text>
    </TouchableOpacity>
  </View>;
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: C.nude,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 17,
    paddingVertical: 19,
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  starCircle: {
    width: 51,
    height: 51,
    borderRadius: 26,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.ink,
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  texts: { flex: 1, minWidth: 0 },
  tier: { color: C.muted, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  points: { color: C.ink, fontSize: 19, fontWeight: '700', marginTop: 5 },
  error: { color: C.mocha, fontSize: 10, marginTop: 4, lineHeight: 14 },
  rulesButton: {
    backgroundColor: C.white,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 30,
    flexShrink: 0,
  },
  rulesText: { color: C.ink, fontSize: 12, fontWeight: '700' },
});
